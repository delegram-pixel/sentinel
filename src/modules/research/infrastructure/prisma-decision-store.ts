import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import type { DecisionStore } from "../application/decision-service";
import type {
  DecisionInput,
  InvestigationRelationInput,
  ResearchPhaseInput,
} from "../domain/research-decision";

export class PrismaDecisionStore implements DecisionStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  list(workspaceId: string, investigationId: string) {
    return this.db.researchDecision.findMany({
      where: { workspaceId, investigationId },
      select: {
        id: true,
        kind: true,
        rationale: true,
        sourceRefs: true,
        sourceTaskId: true,
        createdAt: true,
        creator: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  record(actor: ResearchActor, input: DecisionInput) {
    return this.db.$transaction(async (tx) => {
      const investigation = await lockResearchInvestigation(tx, actor, input.investigationId);
      if (input.kind === "CLOSE_FINDING")
        throw new ResearchOperationError(
          "REVIEW_REQUIRED",
          "Close findings through the human finding review workflow.",
        );
      if (
        input.findingId &&
        !(await tx.finding.findFirst({
          where: {
            id: input.findingId,
            workspaceId: actor.workspaceId,
            investigationId: investigation.id,
          },
          select: { id: true },
        }))
      )
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "That finding does not belong to this investigation.",
        );
      if (
        input.hypothesisId &&
        !(await tx.hypothesis.findFirst({
          where: { id: input.hypothesisId, investigationId: investigation.id },
          select: { id: true },
        }))
      )
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "That hypothesis does not belong to this investigation.",
        );
      if (
        input.sourceTaskId &&
        !(await tx.aITask.findFirst({
          where: {
            id: input.sourceTaskId,
            workspaceId: actor.workspaceId,
            investigationId: investigation.id,
            status: "COMPLETED",
          },
          select: { id: true },
        }))
      )
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Choose a completed task from this investigation.",
        );
      for (const ref of input.sourceRefs) {
        const found =
          ref.kind === "OBSERVATION"
            ? await tx.investigationObservation.findFirst({
                where: { id: ref.id, investigationId: investigation.id },
                select: { id: true },
              })
            : ref.kind === "HYPOTHESIS"
              ? await tx.hypothesis.findFirst({
                  where: { id: ref.id, investigationId: investigation.id },
                  select: { id: true },
                })
              : ref.kind === "EVIDENCE"
                ? await tx.evidence.findFirst({
                    where: {
                      id: ref.id,
                      workspaceId: actor.workspaceId,
                      investigationId: investigation.id,
                      deletedAt: null,
                      redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
                    },
                    select: { id: true },
                  })
                : ref.kind === "FINDING"
                  ? await tx.finding.findFirst({
                      where: {
                        id: ref.id,
                        workspaceId: actor.workspaceId,
                        investigationId: investigation.id,
                      },
                      select: { id: true },
                    })
                  : await tx.knowledgeDocument.findFirst({
                      where: {
                        id: ref.id,
                        workspaceId: actor.workspaceId,
                        reviewStatus: "REVIEWED",
                        OR: [
                          { investigationId: investigation.id },
                          { investigationId: null, engagementId: investigation.engagementId },
                          { investigationId: null, engagementId: null },
                        ],
                      },
                      select: { id: true },
                    });
        if (!found)
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "A supporting source is unavailable to this investigation.",
          );
      }
      if (input.kind === "REJECT_HYPOTHESIS") {
        const changed = await tx.hypothesis.updateMany({
          where: {
            id: input.hypothesisId,
            investigationId: investigation.id,
            status: { in: ["IDEA", "OBSERVED", "NEEDS_VALIDATION", "NOT_REPRODUCIBLE"] },
          },
          data: { status: "REJECTED" },
        });
        if (!changed.count)
          throw new ResearchOperationError(
            "CONFLICT",
            "This hypothesis cannot be rejected in its current state.",
          );
      }
      if (input.kind === "CLOSE_INVESTIGATION")
        await tx.investigation.update({
          where: { id: investigation.id },
          data: { phase: "CLOSED", status: "COMPLETED", completedAt: new Date() },
        });
      if (input.kind === "MORE_RESEARCH")
        await tx.investigation.update({
          where: { id: investigation.id },
          data: { phase: "ANALYSIS" },
        });
      const row = await tx.researchDecision.create({
        data: { ...input, workspaceId: actor.workspaceId, createdBy: actor.userId },
        select: { id: true },
      });
      await researchAudit(tx, actor, "ResearchDecision", row.id, "RESEARCH_DECISION_RECORDED", {
        kind: input.kind,
        investigationId: investigation.id,
      });
      return row;
    });
  }
  changePhase(actor: ResearchActor, input: ResearchPhaseInput) {
    return this.db.$transaction(async (tx) => {
      const row = await lockResearchInvestigation(tx, actor, input.investigationId);
      if (row.phase !== input.expectedPhase || row.phase === "CLOSED")
        throw new ResearchOperationError(
          "CONFLICT",
          "The research phase changed. Refresh before saving.",
        );
      await tx.investigation.update({ where: { id: row.id }, data: { phase: input.phase } });
      await researchAudit(tx, actor, "Investigation", row.id, "RESEARCH_PHASE_CHANGED", {
        phase: input.phase,
        previousPhase: row.phase,
      });
      return { id: row.id };
    });
  }
  relate(actor: ResearchActor, input: InvestigationRelationInput) {
    return this.db.$transaction(async (tx) => {
      for (const id of [input.fromId, input.toId].sort())
        await lockResearchInvestigation(tx, actor, id);
      const row = await tx.investigationRelation.upsert({
        where: {
          fromId_toId_relationship: {
            fromId: input.fromId,
            toId: input.toId,
            relationship: input.relationship,
          },
        },
        create: { ...input, workspaceId: actor.workspaceId, createdBy: actor.userId },
        update: {},
        select: { id: true },
      });
      await researchAudit(tx, actor, "InvestigationRelation", row.id, "INVESTIGATIONS_RELATED", {
        fromId: input.fromId,
        toId: input.toId,
        relationship: input.relationship,
      });
      return row;
    });
  }
}
