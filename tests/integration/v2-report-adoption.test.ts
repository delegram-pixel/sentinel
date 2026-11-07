import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { MockAIProvider } from "@/modules/ai/application/mock-provider";
import { runAiTask } from "@/modules/ai/application/task-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";
import { PrismaAiReportStore } from "@/modules/reports/infrastructure/prisma-ai-report-store";
import {
  createReport,
  saveReportRevision,
  submitReport,
  approveReport,
  exportReport,
  readReportExport,
} from "@/modules/reports/application/report-service";
const client = createTestClient();
afterAll(() => client.$disconnect());
it("adopts source-attributed AI drafts, preserves human revisions and audits the first export", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    await tx.finding.update({
      where: { id: t.finding.id },
      data: {
        status: "CONFIRMED",
        severity: "LOW",
        severityRationale: "Reviewed reflected input",
        affectedAsset: t.target.assetIdentifier,
        affectedAssetType: "DOMAIN",
        impact: "Recorded reflected input",
        remediation: "Encode output",
        approvedBy: t.user.id,
        approvedAt: new Date(),
        verifiedAt: new Date(),
      },
    });
    const e = await tx.evidence.create({
      data: {
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        title: "Approved source",
        fileName: "source.txt",
        evidenceType: "LOG",
        checksum: "a".repeat(64),
        mimeType: "text/plain",
        fileSize: 20,
        storageKey: "approved/source",
        redactionStatus: "VERIFIED_SAFE",
        uploadValidatedAt: new Date(),
        activatedAt: new Date(),
        uploadedBy: t.user.id,
      },
    });
    await tx.evidenceLink.create({
      data: { findingId: t.finding.id, evidenceId: e.id, relationshipType: "SUPPORTS" },
    });
    const store = new PrismaReportStore(tx);
    const created = await createReport(store, actor, {
      investigationId: t.investigation.id,
      title: "Verified research",
      findingIds: [t.finding.id],
    });
    if (!created.ok) throw new Error(created.message);
    const analysis = await runAiTask(
      { store: new PrismaAIStore(tx), provider: new MockAIProvider() },
      actor,
      {
        investigationId: t.investigation.id,
        taskType: "REPORT_GENERATION",
        operationKey: randomUUID(),
      },
    );
    if (!analysis.ok) throw new Error(analysis.message);
    const adoption = {
      reportId: created.value.id,
      taskId: analysis.value.task.id,
      expectedRevision: 1,
      rationale: "Adopt the source-linked draft for human editing",
    };
    const aiStore = new PrismaAiReportStore(tx);
    await aiStore.adopt(actor, adoption);
    await aiStore.adopt(actor, adoption);
    let report = await store.findReport(t.workspace.id, created.value.id);
    expect(report?.revisions).toHaveLength(2);
    expect(report?.revisions[0]).toMatchObject({
      generatedByType: "AI_ASSISTED",
      sourceTaskId: analysis.value.task.id,
    });
    expect(
      (
        await saveReportRevision(store, actor, created.value.id, {
          content:
            "# Human-reviewed report\n\nOnly the recorded low-impact reflection is established.",
        })
      ).ok,
    ).toBe(true);
    report = await store.findReport(t.workspace.id, created.value.id);
    expect(report?.revisions[0]?.generatedByType).toBe("HUMAN");
    expect(report?.revisions[1]?.sourceTaskId).toBe(analysis.value.task.id);
    expect((await submitReport(store, actor, created.value.id)).ok).toBe(true);
    expect((await approveReport(store, actor, created.value.id)).ok).toBe(true);
    expect(await readReportExport(store, t.workspace.id, created.value.id)).toBeNull();
    expect((await exportReport(store, actor, created.value.id)).ok).toBe(true);
    expect(await readReportExport(store, t.workspace.id, created.value.id)).not.toBeNull();
    expect(await tx.submissionEvent.count({ where: { workspaceId: t.workspace.id } })).toBe(0);
  }));
