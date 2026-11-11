import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { EvidenceStorage } from "../application/storage";
import { ResearchOperationError, canReviewResearch } from "@/modules/shared/application/actor";
import { requireResearchMember } from "@/modules/shared/infrastructure/research-transaction";
import type { JobRow } from "@/modules/tasks/domain/job";
import { PrismaEvidenceStore } from "./prisma-evidence-store";
import { activeStorageKey } from "../domain/evidence";
const inputSchema = z.object({
  evidenceId: z.uuid(),
  sourceKey: z.string().min(1),
  destinationKey: z.string().min(1),
  decision: z.enum(["REDACTED", "VERIFIED_SAFE"]),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.number().int().min(1),
  fileSize: z.number().int().min(1),
  mimeType: z.string(),
  reviewedAt: z.iso.datetime(),
});
export async function promoteReviewedEvidence(
  db: Prisma.TransactionClient,
  storage: EvidenceStorage,
  job: JobRow,
) {
  const input = inputSchema.parse(job.payload);
  const actor = {
    workspaceId: job.workspaceId,
    userId: job.requestedBy,
    role: "REVIEWER" as const,
  };
  if (!canReviewResearch(await requireResearchMember(db, actor)))
    throw new ResearchOperationError(
      "FORBIDDEN",
      "The original reviewer no longer has evidence approval permission.",
    );
  const row = await db.evidence.findFirst({
    where: { id: input.evidenceId, workspaceId: job.workspaceId, deletedAt: null },
  });
  if (
    !row ||
    row.version !== input.version ||
    row.checksum !== input.checksum ||
    !row.uploadValidatedAt
  )
    throw new ResearchOperationError("CONFLICT", "The reviewed upload is unavailable or changed.");
  const inPlace = storage.promotionMode === "IN_PLACE";

  if (row.storageKey) {
    const expected = inPlace
      ? row.storageKey
      : activeStorageKey(job.workspaceId, row.investigationId, row.id, row.version);

    if (
      row.storageKey !== input.destinationKey ||
      row.storageKey !== expected ||
      row.redactionStatus !== input.decision ||
      row.redactionReviewedBy !== job.requestedBy
    )
      throw new ResearchOperationError(
        "CONFLICT",
        "A different evidence promotion is already active.",
      );
  } else {
    const expectedDestination = inPlace
      ? row.quarantineKey
      : activeStorageKey(job.workspaceId, row.investigationId, row.id, row.version);

    if (!expectedDestination || input.destinationKey !== expectedDestination)
      throw new ResearchOperationError(
        "INVALID_SOURCE",
        "The promotion destination does not match the evidence identity.",
      );
    if (row.quarantineKey !== input.sourceKey)
      throw new ResearchOperationError(
        "INVALID_SOURCE",
        "The original quarantined upload is unavailable.",
      );
    if (
      !(await db.backgroundJob.findFirst({
        where: {
          id: job.id,
          status: "RUNNING",
          leaseToken: job.leaseToken,
          leaseUntil: { gt: new Date() },
          cancelRequestedAt: null,
        },
      }))
    )
      throw new ResearchOperationError("JOB_CANCELLED", "Evidence promotion lost its lease.");

    if (!inPlace) {
      await storage.copyObject(input.sourceKey, input.destinationKey);
    }

    const object = await storage.getObject(input.destinationKey);
    if (
      !object ||
      object.body.length !== input.fileSize ||
      createHash("sha256").update(object.body).digest("hex") !== input.checksum
    )
      throw new ResearchOperationError(
        "EVIDENCE_ACTIVATION_FAILED",
        inPlace
          ? "The uploaded evidence did not pass checksum and size verification."
          : "The copied evidence did not pass checksum and size verification. Its original is retained.",
      );
    const store = new PrismaEvidenceStore(db);
    const activated = await store.activateEvidence(
      job.workspaceId,
      row.id,
      {
        executionLease: { jobId: job.id, token: job.leaseToken! },
        expectedChecksum: input.checksum,
        expectedVersion: input.version,
        storageKey: input.destinationKey,
        redactionStatus: input.decision,
        redactionMethod: "HUMAN_REVIEW",
        redactionReviewedBy: job.requestedBy,
        redactionReviewedAt: new Date(input.reviewedAt),
        activatedAt: new Date(),
      },
      {
        workspaceId: job.workspaceId,
        userId: job.requestedBy,
        action: "EVIDENCE_REDACTION_REVIEWED",
        entityType: "Evidence",
        metadata: { promotionJobId: job.id },
      },
    );
    if (!activated)
      throw new ResearchOperationError(
        "JOB_CANCELLED",
        "Evidence or promotion state changed before activation.",
      );
  }
  if (!inPlace) {
    // The original remains until the verified active copy and its metadata exist.
    await storage.deleteObject(input.sourceKey);
  }
  return { evidenceId: row.id, promoted: true };
}
