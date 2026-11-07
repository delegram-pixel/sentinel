import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { reportGenerationOutputSchema } from "@/modules/ai/domain/structured-output";
import { validateOutput } from "@/modules/ai/application/task-service";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import { buildSnapshots } from "../application/report-service";
import {
  renderAiReportDraft,
  type AiReportAdoption,
  type AiReportStore,
} from "../application/ai-report-service";
import { PrismaReportStore } from "./prisma-report-store";
import { guardReportSnapshot } from "./report-snapshot-guard";
export class PrismaAiReportStore implements AiReportStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  listDraftTasks(workspaceId: string, investigationId: string) {
    return this.db.aITask.findMany({
      where: { workspaceId, investigationId, taskType: "REPORT_GENERATION", status: "COMPLETED" },
      select: { id: true, createdAt: true, model: true, promptVersion: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }
  adopt(actor: ResearchActor, input: AiReportAdoption) {
    return this.db.$transaction(async (tx) => {
      const store = new PrismaReportStore(tx);
      const report = await store.findReport(actor.workspaceId, input.reportId);
      if (!report) throw new ResearchOperationError("NOT_FOUND", "The report is unavailable.");
      await lockResearchInvestigation(tx, actor, report.investigationId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Report" WHERE id = ${report.id}::uuid FOR UPDATE`,
      );
      const prior = await tx.reportRevision.findFirst({
        where: { reportId: report.id, sourceTaskId: input.taskId },
      });
      if (prior) return { id: report.id };
      const task = await tx.aITask.findFirst({
        where: {
          id: input.taskId,
          workspaceId: actor.workspaceId,
          investigationId: report.investigationId,
          status: "COMPLETED",
          taskType: "REPORT_GENERATION",
        },
      });
      if (!task)
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Choose a completed Reporting Agent draft from this investigation.",
        );
      const p = reportGenerationOutputSchema.safeParse(task.output);
      if (!p.success)
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "This older draft does not have the required source provenance. Request a new report analysis.",
        );
      const manifest = (task.inputContext as { sourceManifest?: Record<string, string[]> } | null)
        ?.sourceManifest;
      const set = (k: string) => new Set(manifest?.[k] ?? []);
      if (
        !validateOutput("REPORT_GENERATION", p.data, {
          observationIds: set("observationIds"),
          hypothesisIds: set("hypothesisIds"),
          evidenceIds: set("evidenceIds"),
          findingIds: set("findingIds"),
          decisionIds: set("decisionIds"),
          knowledgeIds: set("knowledgeIds"),
          historyIds: set("historyIds"),
        }).ok
      )
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "The draft cites sources outside its original context.",
        );
      const selected = report.findings.map((f) => f.findingId);
      if (p.data.referencedFindingIds.some((id) => !selected.includes(id)))
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Every cited finding must be selected in this report.",
        );
      const findings = await store.listReportFindings(actor.workspaceId, selected);
      const snapshots = buildSnapshots(findings);
      if (
        p.data.referencedEvidenceIds.some(
          (id) => !snapshots.evidenceSnapshot.some((e) => e.evidenceId === id),
        )
      )
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "The draft's cited evidence must be approved and linked to the report findings.",
        );
      if (
        !(await guardReportSnapshot(
          tx,
          actor,
          report.investigationId,
          snapshots.findingSnapshot,
          snapshots.evidenceSnapshot,
        ))
      )
        throw new ResearchOperationError(
          "REPORT_SOURCE_CHANGED",
          "Review the current report sources before adopting this draft.",
        );
      const saved = await store.addRevision(
        actor.workspaceId,
        report.id,
        {
          expectedRevision: input.expectedRevision,
          expectedStatus: "DRAFT",
          content: renderAiReportDraft(p.data),
          ...snapshots,
          createdBy: actor.userId,
          generatedByType: "AI_ASSISTED",
          sourceTaskId: task.id,
          model: task.model,
          promptVersion: task.promptVersion,
        },
        {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          action: "REPORT_REVISION_SAVED",
          entityType: "Report",
          metadata: { sourceTaskId: task.id },
        },
      );
      if (!saved)
        throw new ResearchOperationError(
          "CONFLICT",
          "The report changed. Refresh before adopting a draft.",
        );
      const decision = await tx.researchDecision.create({
        data: {
          workspaceId: actor.workspaceId,
          investigationId: report.investigationId,
          sourceTaskId: task.id,
          kind: "ADOPT_AI_RESULT",
          rationale: input.rationale,
          sourceRefs: [{ kind: "REPORT", id: report.id, relationship: "CONTEXT" }],
          createdBy: actor.userId,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "Report", report.id, "AI_REPORT_DRAFT_ADOPTED", {
        taskId: task.id,
        decisionId: decision.id,
      });
      return { id: report.id };
    });
  }
}
