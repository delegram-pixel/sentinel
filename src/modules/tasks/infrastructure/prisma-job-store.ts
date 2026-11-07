import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { canonicalJson } from "@/modules/shared/domain/json";
import { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import type { JobStore } from "../application/job-service";
import { retryDelay, type JobKind, type JobRow } from "../domain/job";
import { settleInterruptedAiTasks } from "@/modules/ai/infrastructure/ai-usage-reconciliation";
const LEASE_MS = 120000;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export class PrismaJobStore implements JobStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  async enqueue(actor: ResearchActor, kind: JobKind, operationKey: string, payload: unknown) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Workspace" WHERE id = ${actor.workspaceId}::uuid FOR UPDATE`,
      );
      const old = await tx.backgroundJob.findUnique({
        where: { workspaceId_operationKey: { workspaceId: actor.workspaceId, operationKey } },
      });
      if (old) {
        if (
          old.kind !== kind ||
          old.requestedBy !== actor.userId ||
          createHash("sha256").update(canonicalJson(old.payload)).digest("hex") !==
            createHash("sha256")
              .update(canonicalJson(json(payload)))
              .digest("hex")
        )
          throw new ResearchOperationError(
            "CONFLICT",
            "This request identifier belongs to different work.",
          );
        return { id: old.id };
      }
      const queued = await tx.backgroundJob.count({
        where: { requestedBy: actor.userId, status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (queued >= 20)
        throw new ResearchOperationError(
          "QUEUE_LIMIT",
          "Finish or cancel outstanding work before requesting more.",
        );
      const row = await tx.backgroundJob.create({
        data: {
          workspaceId: actor.workspaceId,
          requestedBy: actor.userId,
          kind,
          operationKey,
          payload: json(payload),
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "BackgroundJob", row.id, "RESEARCH_JOB_QUEUED", { kind });
      return row;
    });
  }
  find(workspaceId: string, id: string) {
    return this.db.backgroundJob.findFirst({ where: { id, workspaceId } });
  }
  list(workspaceId: string) {
    return this.db.backgroundJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async cancel(actor: ResearchActor, id: string) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      const changed = await tx.backgroundJob.updateMany({
        where: { id, workspaceId: actor.workspaceId, status: { in: ["QUEUED", "RUNNING"] } },
        data: {
          status: "CANCELLED",
          cancelRequestedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (changed.count) {
        await settleInterruptedAiTasks(tx, id, "CANCELLED", "AI_JOB_CANCELLED");
        await researchAudit(tx, actor, "BackgroundJob", id, "RESEARCH_JOB_CANCELLED", {});
      }
      return changed.count === 1;
    });
  }
  async claim(): Promise<JobRow | null> {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const exhausted = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`UPDATE "BackgroundJob" SET status = 'FAILED', "failureCode" = 'LEASE_RETRIES_EXHAUSTED', "leaseToken" = NULL, "leaseUntil" = NULL WHERE status = 'RUNNING' AND "leaseUntil" < ${now} AND attempts >= "maxAttempts" RETURNING id`,
      );
      for (const job of exhausted)
        await settleInterruptedAiTasks(tx, job.id, "FAILED", "AI_LEASE_RETRIES_EXHAUSTED");
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "BackgroundJob" WHERE "cancelRequestedAt" IS NULL AND attempts < "maxAttempts" AND ((status = 'QUEUED' AND "availableAt" <= ${now}) OR (status = 'RUNNING' AND "leaseUntil" < ${now})) ORDER BY "availableAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      const id = rows[0]?.id;
      if (!id) return null;
      return tx.backgroundJob.update({
        where: { id },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          leaseToken: randomUUID(),
          leaseUntil: new Date(now.getTime() + LEASE_MS),
          heartbeatAt: now,
        },
      });
    });
  }
  async heartbeat(job: JobRow, progress = job.progress) {
    return (
      (
        await this.db.backgroundJob.updateMany({
          where: {
            id: job.id,
            workspaceId: job.workspaceId,
            status: "RUNNING",
            leaseToken: job.leaseToken,
            leaseUntil: { gt: new Date() },
            cancelRequestedAt: null,
          },
          data: {
            leaseUntil: new Date(Date.now() + LEASE_MS),
            heartbeatAt: new Date(),
            progress: Math.max(0, Math.min(99, progress)),
          },
        })
      ).count === 1
    );
  }
  async finish(job: JobRow, result: unknown) {
    return (
      (
        await this.db.backgroundJob.updateMany({
          where: {
            id: job.id,
            workspaceId: job.workspaceId,
            status: "RUNNING",
            leaseToken: job.leaseToken,
            leaseUntil: { gt: new Date() },
            cancelRequestedAt: null,
          },
          data: {
            status: "SUCCEEDED",
            failureCode: null,
            result: json(result),
            progress: 100,
            leaseToken: null,
            leaseUntil: null,
          },
        })
      ).count === 1
    );
  }
  async fail(job: JobRow, failureCode: string, retryable: boolean) {
    return this.db.$transaction(async (tx) => {
      const status = retryable && job.attempts < job.maxAttempts ? "QUEUED" : "FAILED";
      const changed = await tx.backgroundJob.updateMany({
        where: {
          id: job.id,
          workspaceId: job.workspaceId,
          status: "RUNNING",
          leaseToken: job.leaseToken,
          leaseUntil: { gt: new Date() },
          cancelRequestedAt: null,
        },
        data: {
          status,
          failureCode,
          availableAt: new Date(Date.now() + retryDelay(job.attempts)),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (changed.count && status === "FAILED")
        await settleInterruptedAiTasks(tx, job.id, "FAILED", failureCode);
      return changed.count === 1;
    });
  }
}
