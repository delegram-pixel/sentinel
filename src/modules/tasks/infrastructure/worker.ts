import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AiServiceDependencies } from "@/modules/ai/application/task-service";
import { executeAiJob } from "@/modules/ai/infrastructure/ai-job-executor";
import { processKnowledgeDocument } from "@/modules/knowledge/infrastructure/prisma-knowledge-retrieval";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import { PrismaJobStore } from "./prisma-job-store";
import { cleanupDeletedEvidence } from "@/modules/evidence/infrastructure/evidence-cleanup";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";
import { processToolImport } from "@/modules/imports/infrastructure/prisma-import-store";
import { promoteReviewedEvidence } from "@/modules/evidence/infrastructure/evidence-promotion";

export async function processNextResearchJob(
  db: Prisma.TransactionClient,
  ai: AiServiceDependencies,
) {
  const store = new PrismaJobStore(db);
  const job = await store.claim();
  if (!job) return false;
  let leaseHealthy = true;
  let heartbeatWork = Promise.resolve();
  const heartbeat = setInterval(() => {
    heartbeatWork = heartbeatWork
      .then(async () => {
        if (leaseHealthy) leaseHealthy = await store.heartbeat(job);
      })
      .catch(() => {
        leaseHealthy = false;
      });
  }, 20000);
  try {
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: job.workspaceId, userId: job.requestedBy } },
      select: { role: true },
    });
    if (!member)
      throw new ResearchOperationError(
        "FORBIDDEN",
        "The requesting user no longer belongs to this workspace.",
      );
    const actor = { workspaceId: job.workspaceId, userId: job.requestedBy, role: member.role };
    let result: unknown;
    if (job.kind === "AI_TASK") result = await executeAiJob(db, ai, job);
    else if (job.kind === "KNOWLEDGE_INDEX")
      result = await processKnowledgeDocument(
        db,
        actor,
        z.object({ documentId: z.uuid() }).parse(job.payload).documentId,
        job,
      );
    else if (job.kind === "EVIDENCE_CLEANUP")
      result = await cleanupDeletedEvidence(db, createEvidenceStorage(), job);
    else if (job.kind === "TOOL_IMPORT")
      result = await processToolImport(
        db,
        actor,
        z.object({ importId: z.uuid() }).parse(job.payload).importId,
        job,
      );
    else if (job.kind === "EVIDENCE_PROMOTION")
      result = await promoteReviewedEvidence(db, createEvidenceStorage(), job);
    else
      throw new ResearchOperationError(
        "JOB_NOT_SUPPORTED",
        "No processor is registered for this work.",
      );
    await heartbeatWork;
    if (!leaseHealthy || !(await store.finish(job, result)))
      throw new ResearchOperationError(
        "JOB_LEASE_LOST",
        "The worker lost its lease before completion.",
      );
  } catch (error) {
    const code = error instanceof ResearchOperationError ? error.code : "JOB_PROCESSING_FAILED";
    await store.fail(
      job,
      code,
      !(error instanceof ResearchOperationError) || code === "AI_RATE_LIMITED",
    );
  } finally {
    clearInterval(heartbeat);
    await heartbeatWork;
  }
  return true;
}
