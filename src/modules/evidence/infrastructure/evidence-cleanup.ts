import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { JobRow } from "@/modules/tasks";
import type { EvidenceStorage } from "../application/storage";
import { assertEvidenceNotReferenced } from "./evidence-retention";
import { ResearchOperationError } from "@/modules/shared/domain/result";
export async function cleanupDeletedEvidence(
  db: Prisma.TransactionClient,
  storage: EvidenceStorage,
  job: JobRow,
) {
  const { evidenceId } = z.object({ evidenceId: z.uuid() }).parse(job.payload);
  const evidence = await db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Evidence" WHERE id = ${evidenceId}::uuid AND "workspaceId" = ${job.workspaceId}::uuid FOR UPDATE`,
    );
    await assertEvidenceNotReferenced(tx, job.workspaceId, evidenceId);
    return tx.evidence.findFirst({
      where: { id: evidenceId, workspaceId: job.workspaceId, deletedAt: { not: null } },
      select: { storageKey: true, quarantineKey: true },
    });
  });
  if (!evidence)
    throw new ResearchOperationError(
      "EVIDENCE_NOT_DELETED",
      "Only deleted, unreferenced evidence can be cleaned up.",
    );
  if (
    !(await db.backgroundJob.findFirst({
      where: { id: job.id, leaseToken: job.leaseToken, status: "RUNNING", cancelRequestedAt: null },
    }))
  )
    throw new ResearchOperationError("JOB_CANCELLED", "Cleanup was cancelled.");
  if (evidence.storageKey) await storage.deleteObject(evidence.storageKey);
  if (evidence.quarantineKey) await storage.deleteObject(evidence.quarantineKey);
  return { evidenceId, cleaned: true };
}
