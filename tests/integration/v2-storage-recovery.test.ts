import { afterAll, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import { PrismaResearchEvidenceStore } from "@/modules/evidence/infrastructure/prisma-research-evidence-store";
import { promoteReviewedEvidence } from "@/modules/evidence/infrastructure/evidence-promotion";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import type { EvidenceStorage } from "@/modules/evidence/application/storage";
import { activeStorageKey } from "@/modules/evidence/domain/evidence";
import { assertEvidenceNotReferenced } from "@/modules/evidence/infrastructure/evidence-retention";
const client = createTestClient();
afterAll(() => client.$disconnect());
it("retries promotion from a retained original and preserves reviewed version relationships", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const body = Buffer.from("Reviewed supplied log");
    const checksum = createHash("sha256").update(body).digest("hex");
    const e = await tx.evidence.create({
      data: {
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        title: "Validated log",
        fileName: "log.txt",
        evidenceType: "LOG",
        mimeType: "text/plain",
        fileSize: body.length,
        checksum,
        quarantineKey: "quarantine/log",
        uploadValidatedAt: new Date(),
        uploadedBy: t.user.id,
      },
    });
    const store = new PrismaEvidenceStore(tx);
    const destination = activeStorageKey(t.workspace.id, t.investigation.id, e.id, 1);
    const intent = await store.prepareActivation(actor, e.id, {
      expectedChecksum: checksum,
      expectedVersion: 1,
      storageKey: destination,
      redactionStatus: "VERIFIED_SAFE",
      redactionMethod: "HUMAN_REVIEW",
      redactionReviewedBy: t.user.id,
      redactionReviewedAt: new Date(),
      activatedAt: new Date(),
    });
    const objects = new Map<string, Buffer>([["quarantine/log", body]]);
    let failCopy = true;
    let failDelete = true;
    let copyCount = 0;
    const storage: EvidenceStorage = {
      kind: "MEMORY",
      async createUploadTarget() {
        throw new Error("Unused");
      },
      async createDownloadTarget() {
        throw new Error("Unused");
      },
      async statObject(key) {
        const b = objects.get(key);
        return b ? { key, size: b.length, contentType: "text/plain" } : null;
      },
      async getObject(key) {
        const b = objects.get(key);
        return b ? { body: b, contentType: "text/plain" } : null;
      },
      async copyObject(from, to) {
        if (failCopy) throw new Error("Injected storage failure");
        copyCount += 1;
        objects.set(to, objects.get(from)!);
      },
      async deleteObject(key) {
        if (failDelete) throw new Error("Injected cleanup failure");
        objects.delete(key);
      },
    };
    const jobs = new PrismaJobStore(tx);
    const job = await jobs.claim();
    if (!job || job.id !== intent.id) throw new Error("Missing promotion job");
    await expect(promoteReviewedEvidence(tx, storage, job)).rejects.toThrow(
      "Injected storage failure",
    );
    expect(objects.has("quarantine/log")).toBe(true);
    expect((await store.findEvidence(t.workspace.id, e.id))?.storageKey).toBeNull();
    failCopy = false;
    await expect(promoteReviewedEvidence(tx, storage, job)).rejects.toThrow(
      "Injected cleanup failure",
    );
    expect((await store.findEvidence(t.workspace.id, e.id))?.storageKey).toBe(destination);
    expect(objects.has("quarantine/log")).toBe(true);
    failDelete = false;
    const result = await promoteReviewedEvidence(tx, storage, job);
    expect(result.promoted).toBe(true);
    expect(objects.has("quarantine/log")).toBe(false);
    expect(objects.has(destination)).toBe(true);
    expect(copyCount).toBe(1);
    await jobs.finish(job, result);
    const previous = await tx.evidence.create({
      data: {
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        title: "Original log",
        fileName: "original.txt",
        evidenceType: "LOG",
        mimeType: "text/plain",
        fileSize: body.length,
        checksum,
        storageKey: "original/log",
        redactionStatus: "VERIFIED_SAFE",
        uploadValidatedAt: new Date(),
        activatedAt: new Date(),
        uploadedBy: t.user.id,
      },
    });
    const versions = new PrismaResearchEvidenceStore(tx);
    await versions.replace(actor, {
      evidenceId: e.id,
      supersedesId: previous.id,
      rationale: "Reviewed a correction to the original supplied log",
    });
    expect(await store.findEvidence(t.workspace.id, e.id)).toMatchObject({
      version: 2,
      supersedesId: previous.id,
    });
    await expect(
      assertEvidenceNotReferenced(tx, t.workspace.id, previous.id),
    ).rejects.toMatchObject({ code: "EVIDENCE_IN_USE" });
  }));
it("blocks immediate activation after its recorded promotion is cancelled", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const evidence = await tx.evidence.create({
      data: {
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        title: "Cancelled promotion",
        fileName: "cancel.txt",
        evidenceType: "LOG",
        mimeType: "text/plain",
        fileSize: 20,
        checksum: "c".repeat(64),
        quarantineKey: "quarantine/cancelled",
        uploadValidatedAt: new Date(),
        uploadedBy: t.user.id,
      },
    });
    const store = new PrismaEvidenceStore(tx);
    const data = {
      expectedChecksum: evidence.checksum,
      expectedVersion: 1,
      storageKey: activeStorageKey(t.workspace.id, t.investigation.id, evidence.id, 1),
      redactionStatus: "VERIFIED_SAFE" as const,
      redactionMethod: "HUMAN_REVIEW" as const,
      redactionReviewedBy: t.user.id,
      redactionReviewedAt: new Date(),
      activatedAt: new Date(),
    };
    const intent = await store.prepareActivation(actor, evidence.id, data);
    expect(await new PrismaJobStore(tx).cancel(actor, intent.id)).toBe(true);
    expect(
      await store.activateEvidence(t.workspace.id, evidence.id, data, {
        workspaceId: t.workspace.id,
        userId: t.user.id,
        action: "EVIDENCE_REDACTION_REVIEWED",
        entityType: "Evidence",
      }),
    ).toBeNull();
    expect(await store.findEvidence(t.workspace.id, evidence.id)).toMatchObject({
      storageKey: null,
      quarantineKey: "quarantine/cancelled",
    });
  }));
it("retains evidence cited by a historical human verification after its live link is removed", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const evidence = await tx.evidence.create({
      data: {
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        title: "Historical source",
        fileName: "history.txt",
        evidenceType: "LOG",
        mimeType: "text/plain",
        fileSize: 20,
        checksum: "b".repeat(64),
        storageKey: "approved/history",
        uploadValidatedAt: new Date(),
        redactionStatus: "VERIFIED_SAFE",
        uploadedBy: t.user.id,
      },
    });
    const review = await tx.verificationReview.create({
      data: {
        findingId: t.finding.id,
        reviewerType: "HUMAN",
        reviewerUserId: t.user.id,
        conclusion: "NEEDS_MORE_EVIDENCE",
        supportingEvidence: [evidence.id],
        reasoningSummary: "The original log is retained as a historical review source.",
      },
    });
    await expect(
      assertEvidenceNotReferenced(tx, t.workspace.id, evidence.id),
    ).rejects.toMatchObject({ code: "EVIDENCE_IN_USE" });
    await tx.verificationReview.update({
      where: { id: review.id },
      data: {
        supportingEvidence: [],
        basis: {
          availableApprovedLinkedEvidence: [
            {
              relationshipType: "CONTRADICTS",
              evidence: { id: evidence.id, version: 1, checksum: evidence.checksum },
            },
          ],
        },
      },
    });
    await expect(
      assertEvidenceNotReferenced(tx, t.workspace.id, evidence.id),
    ).rejects.toMatchObject({ code: "EVIDENCE_IN_USE" });
  }));
