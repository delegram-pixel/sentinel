import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AI_TASK_PROFILES } from "../domain/ai-config";
import { estimateCostUsd } from "../domain/ai-budgets";
import {
  ResearchOperationError,
  researchOperation,
  type ResearchActor,
} from "@/modules/shared/application/actor";
import {
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
export const aiUsageReconciliationSchema = z.object({
  taskId: z.uuid(),
  inputTokens: z.coerce.number().int().min(0).max(10000000),
  outputTokens: z.coerce.number().int().min(0).max(10000000),
  providerReference: z.string().trim().min(3).max(300),
  rationale: z.string().trim().min(10).max(8000),
});
export function reconcileAiUsage(
  db: Prisma.TransactionClient,
  actor: ResearchActor,
  input: z.infer<typeof aiUsageReconciliationSchema>,
) {
  return researchOperation(() =>
    db.$transaction(async (tx) => {
      const role = await requireResearchMember(tx, actor);
      if (role !== "OWNER" && role !== "ADMIN")
        throw new ResearchOperationError(
          "FORBIDDEN",
          "A workspace owner or administrator must reconcile provider usage.",
        );
      const candidate = await tx.aITask.findFirst({
        where: { id: input.taskId, workspaceId: actor.workspaceId },
        select: { requestedBy: true },
      });
      if (!candidate) throw new ResearchOperationError("NOT_FOUND", "The task is unavailable.");
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${candidate.requestedBy}::uuid FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "AITask" WHERE id = ${input.taskId}::uuid FOR UPDATE`,
      );
      const task = await tx.aITask.findUniqueOrThrow({ where: { id: input.taskId } });
      if (!task.usageUncertain || !["FAILED", "CANCELLED", "TIMED_OUT"].includes(task.status))
        throw new ResearchOperationError(
          "CONFLICT",
          "Only terminal tasks with uncertain provider usage can be reconciled.",
        );
      const attempts = await tx.aIExecutionAttempt.findMany({ where: { taskId: task.id } });
      if (
        attempts.some((a) => a.status === "STARTED") &&
        (!task.completedAt || Date.now() - task.completedAt.getTime() < 120000)
      )
        throw new ResearchOperationError(
          "PROVIDER_SETTLING",
          "Wait for the provider timeout window to settle before reconciling an interrupted request.",
        );
      const known = attempts.reduce(
        (v, a) => ({ input: v.input + a.inputTokens, output: v.output + a.outputTokens }),
        { input: 0, output: 0 },
      );
      if (input.inputTokens < known.input || input.outputTokens < known.output)
        throw new ResearchOperationError(
          "INVALID_USAGE",
          "Reconciled usage cannot be lower than the captured provider usage.",
        );
      await tx.aITask.update({
        where: { id: task.id },
        data: {
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          estimatedCostUsd: estimateCostUsd(
            AI_TASK_PROFILES[task.taskType].tier,
            input.inputTokens,
            input.outputTokens,
          ),
          usageUncertain: false,
          usageReconciledAt: new Date(),
          reservedTokens: 0,
        },
      });
      await researchAudit(tx, actor, "AITask", task.id, "AI_USAGE_RECONCILED", {
        providerReference: input.providerReference,
        rationale: input.rationale,
        previousReservation: task.reservedTokens,
        previousInputTokens: task.inputTokens,
        previousOutputTokens: task.outputTokens,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      });
      return { id: task.id };
    }),
  );
}

/** Cancels/fails owned tasks atomically with job termination; captured usage remains attributable. */
export async function settleInterruptedAiTasks(
  tx: Prisma.TransactionClient,
  jobId: string,
  status: "FAILED" | "CANCELLED",
  failureCode: string,
) {
  const tasks = await tx.aITask.findMany({
    where: { executionJobId: jobId, status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { id: "asc" },
  });
  for (const candidate of tasks) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "AITask" WHERE id = ${candidate.id}::uuid FOR UPDATE`,
    );
    const task = await tx.aITask.findUniqueOrThrow({ where: { id: candidate.id } });
    if (!["PENDING", "RUNNING"].includes(task.status)) continue;
    const attempts = await tx.aIExecutionAttempt.findMany({ where: { taskId: task.id } });
    const unknown = attempts.some(
      (a) =>
        a.status === "STARTED" ||
        (a.status === "FAILED" &&
          ["AI_TIMEOUT", "AI_PROVIDER_ERROR", "AI_INVALID_OUTPUT"].includes(a.failureCode ?? "")),
    );
    const usage = attempts.reduce(
      (v, a) => ({
        inputTokens: v.inputTokens + a.inputTokens,
        outputTokens: v.outputTokens + a.outputTokens,
      }),
      { inputTokens: 0, outputTokens: 0 },
    );
    await tx.aITask.update({
      where: { id: task.id },
      data: {
        status,
        failureCode,
        completedAt: new Date(),
        ...usage,
        estimatedCostUsd: estimateCostUsd(
          AI_TASK_PROFILES[task.taskType].tier,
          usage.inputTokens,
          usage.outputTokens,
        ),
        usageUncertain: unknown,
        reservedTokens: unknown ? task.reservedTokens : 0,
        executorToken: null,
      },
    });
    await tx.aITaskEvent.create({
      data: {
        taskId: task.id,
        eventType: status === "CANCELLED" ? "TASK_CANCELLED" : "TASK_FAILED",
        description:
          status === "CANCELLED"
            ? "Associated background work was cancelled; any uncertain provider usage remains reserved."
            : "Background retries exhausted; captured attempts remain recorded.",
        metadata: { failureCode, status, usageUncertain: unknown },
      },
    });
  }
}
