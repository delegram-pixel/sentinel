import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import {
  PrismaImportStore,
  processToolImport,
} from "@/modules/imports/infrastructure/prisma-import-store";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { PrismaRemediationStore } from "@/modules/remediation/infrastructure/prisma-remediation-store";
const client = createTestClient();
afterAll(() => client.$disconnect());
async function engagement(
  tx: Parameters<Parameters<typeof withRollback>[1]>[0],
  t: Awaited<ReturnType<typeof createTenancy>>,
) {
  const e = await tx.engagement.create({
    data: {
      workspaceId: t.workspace.id,
      projectId: t.project.id,
      name: "Engagement",
      engagementType: "LEARNING_LAB",
      createdBy: t.user.id,
    },
  });
  const a = await tx.engagementAsset.create({
    data: { workspaceId: t.workspace.id, engagementId: e.id, targetId: t.target.id },
  });
  await tx.investigation.update({
    where: { id: t.investigation.id },
    data: { engagementId: e.id },
  });
  await tx.engagementAuthorization.create({
    data: {
      workspaceId: t.workspace.id,
      assetId: a.id,
      scopeVersionId: t.scope.id,
      source: "Self-attested lab",
      recordedBy: t.user.id,
    },
  });
  return { e, a };
}
it("processes originals idempotently, retains duplicate candidates and adopts only human-reviewed drafts", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const foreign = await createTenancy(tx);
    const { e, a } = await engagement(tx, t);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const store = new PrismaImportStore(tx);
    const jobs = new PrismaJobStore(tx);
    const input = {
      engagementId: e.id,
      operationKey: randomUUID(),
      fileName: "scanner.json",
      format: "JSON" as const,
      sourceTool: "scanner",
      fieldMapping: {},
      rawContent: JSON.stringify([
        {
          title: "Unverified alert",
          sourceRecordId: "a",
          severity: "critical",
          assetReference: t.target.assetIdentifier,
        },
        {
          title: "Unverified alert",
          sourceRecordId: "a",
          severity: "critical",
          assetReference: t.target.assetIdentifier,
        },
      ]),
    };
    const imported = await store.create(actor, input);
    expect(await store.create(actor, input)).toEqual(imported);
    const job = await jobs.claim();
    if (!job) throw new Error("No import job claimed");
    await processToolImport(tx, actor, imported.id, job);
    await processToolImport(tx, actor, imported.id, job);
    const records = await tx.importedResult.findMany({
      where: { importId: imported.id },
      orderBy: { recordIndex: "asc" },
    });
    expect(records).toHaveLength(2);
    expect(records[1]?.duplicateCandidates).not.toEqual([]);
    const record = records[0]!;
    const review = {
      recordId: record.id,
      action: "ADOPT_FINDING" as const,
      investigationId: t.investigation.id,
      assetId: a.id,
      rationale: "Adopt for further human validation",
    };
    const adopted = await store.review(actor, review);
    expect(await store.review(actor, review)).toEqual(adopted);
    expect(await tx.finding.findUnique({ where: { id: adopted.id } })).toMatchObject({
      status: "DRAFT",
      severity: "UNASSESSED",
    });
    expect(await store.find(foreign.workspace.id, imported.id)).toBeNull();
    expect((await store.find(t.workspace.id, imported.id))?.rawContent).toBe(input.rawContent);
  }));
it("documents authorized manual retests, records evidence-backed human closure and never submits automatically", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const { a } = await engagement(tx, t);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    await tx.scopeActivityRule.create({
      data: { scopeVersionId: t.scope.id, activity: "ACTIVE_TEST", effect: "PERMITTED" },
    });
    await tx.finding.update({
      where: { id: t.finding.id },
      data: {
        status: "CONFIRMED",
        severity: "LOW",
        severityRationale: "Reviewed observed output behavior",
        affectedAsset: t.target.assetIdentifier,
        affectedAssetType: "DOMAIN",
        impact: "Unencoded reflected input",
        remediation: "Encode output",
        approvedBy: t.user.id,
        approvedAt: new Date(),
        verifiedAt: new Date(),
      },
    });
    const store = new PrismaRemediationStore(tx);
    const p = await store.create(actor, {
      findingId: t.finding.id,
      title: "Encode output",
      description: "Apply contextual output encoding",
    });
    await store.changeStatus(actor, {
      planId: p.id,
      expectedStatus: "PLANNED",
      status: "READY_FOR_RETEST",
      rationale: "The fix is ready for manual verification",
    });
    const r = await store.requestRetest(actor, {
      planId: p.id,
      assetId: a.id,
      scopeVersionId: t.scope.id,
      activity: "ACTIVE_TEST",
      rationale: "Verify the documented encoding fix",
    });
    const evidence = await tx.evidence.create({
      data: {
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        evidenceType: "LOG",
        title: "Retest log",
        fileName: "retest.txt",
        mimeType: "text/plain",
        fileSize: 20,
        checksum: "a".repeat(64),
        storageKey: "reviewed/retest",
        redactionStatus: "VERIFIED_SAFE",
        redactionReviewedBy: t.user.id,
        redactionReviewedAt: new Date(),
        uploadValidatedAt: new Date(),
        activatedAt: new Date(),
        uploadedBy: t.user.id,
      },
    });
    await store.reviewRetest(actor, {
      retestId: r.id,
      suppliedResults: "Contextual encoding now matches the documented expected result.",
      evidenceIds: [evidence.id],
      conclusion: "RESOLVED",
      rationale: "Reviewed the supplied approved retest log",
    });
    const f = await tx.finding.findUniqueOrThrow({ where: { id: t.finding.id } });
    await store.close(actor, {
      planId: p.id,
      expectedUpdatedAt: f.updatedAt.toISOString(),
      rationale: "Human-reviewed remediation and retest support closure",
    });
    expect((await tx.finding.findUniqueOrThrow({ where: { id: f.id } })).status).toBe("CLOSED");
    expect(
      await tx.researchDecision.count({ where: { findingId: f.id, kind: "CLOSE_FINDING" } }),
    ).toBe(1);
    expect(await tx.submissionEvent.count({ where: { workspaceId: actor.workspaceId } })).toBe(0);
    await store.recordSubmission(actor, {
      findingId: f.id,
      outcome: "ACCEPTED",
      destination: "Human managed programme",
      occurredAt: new Date().toISOString(),
      rationale: "The researcher recorded the actual external acceptance",
    });
    expect(await tx.submissionEvent.count({ where: { workspaceId: actor.workspaceId } })).toBe(1);
  }));
