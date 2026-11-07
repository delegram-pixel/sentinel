import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AI_TASK_TYPES, AI_TASK_PROFILES } from "../domain/ai-config";
import { estimateCostUsd } from "../domain/ai-budgets";
import {
  runAiTask,
  validateOutput,
  formatAssistantMessage,
  type AiServiceDependencies,
} from "../application/task-service";
import type { AiProviderResponse } from "../application/provider";
import type { SessionSummaryOutput } from "../domain/structured-output";
import type { JobRow } from "@/modules/tasks";
import { ResearchOperationError } from "@/modules/shared/domain/result";
export const aiJobInputSchema = z.object({
  investigationId: z.uuid(),
  conversationId: z.uuid().optional(),
  taskType: z.enum(AI_TASK_TYPES),
  instruction: z.string().trim().max(8000).optional(),
  workflow: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["CONTEXT_HYPOTHESES", "EVIDENCE_VERIFICATION"]).optional(),
  ),
  mode: z.enum(["GUIDED", "DELEGATED"]).default("GUIDED"),
});

export async function executeAiJob(
  db: Prisma.TransactionClient,
  deps: AiServiceDependencies,
  job: JobRow,
  stage?: string,
): Promise<{ taskId?: string; recovered?: boolean; stages?: Array<{ taskId?: string }> }> {
  const input = aiJobInputSchema.parse(job.payload);
  if (input.workflow) {
    const stages =
      input.workflow === "CONTEXT_HYPOTHESES"
        ? ["RECON_ANALYSIS", "PATTERN_ANALYSIS", "HYPOTHESIS_GENERATION"]
        : ["EVIDENCE_REVIEW", "FALSE_POSITIVE_REVIEW"];
    const results = [];
    for (const taskType of stages)
      results.push(
        await executeAiJob(
          db,
          deps,
          { ...job, payload: { ...input, workflow: undefined, taskType } },
          taskType,
        ),
      );
    return { stages: results };
  }
  const baseKey = `job:${job.id}${stage ? `:${stage}` : ""}`;
  let key = baseKey;
  let old = await deps.store.findTaskByIdempotency(job.workspaceId, key);
  let parentTaskId: string | undefined;
  // Only explicit rate-limit/overload responses are safe to repeat automatically.
  // Each repeat has its own task, immutable request and usage accounting.
  for (let attempt = 2; attempt <= job.attempts; attempt++) {
    if (old?.status !== "FAILED" || old.failureCode !== "AI_RATE_LIMITED" || old.usageUncertain)
      break;
    parentTaskId = old.id;
    key = `${baseKey}:retry:${attempt}`;
    old = await deps.store.findTaskByIdempotency(job.workspaceId, key);
  }
  if (!old || old.status === "PENDING") {
    const result = await runAiTask(
      deps,
      { workspaceId: job.workspaceId, userId: job.requestedBy },
      {
        ...input,
        parentTaskId,
        operationKey: key,
        executionLease: { jobId: job.id, token: job.leaseToken! },
      },
    );
    if (!result.ok) throw new ResearchOperationError(result.code, result.message);
    return { taskId: result.value.task.id };
  }
  if (old.status === "COMPLETED") return { taskId: old.id };
  if (old.status !== "RUNNING")
    throw new ResearchOperationError(
      old.failureCode ?? "AI_TASK_FAILED",
      "The analytical task failed. Request a new analysis to retry.",
    );
  // Recover a received provider result without another paid provider request.
  const fenced = await db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${job.id}::uuid FOR UPDATE`,
    );
    if (
      !(await tx.backgroundJob.findFirst({
        where: {
          id: job.id,
          status: "RUNNING",
          leaseToken: job.leaseToken,
          leaseUntil: { gt: new Date() },
          cancelRequestedAt: null,
        },
      }))
    )
      return false;
    return (
      (
        await tx.aITask.updateMany({
          where: {
            id: old.id,
            workspaceId: job.workspaceId,
            status: "RUNNING",
            executionJobId: job.id,
          },
          data: { executorToken: job.leaseToken },
        })
      ).count === 1
    );
  });
  if (!fenced)
    throw new ResearchOperationError(
      "JOB_CANCELLED",
      "The work was cancelled or its lease expired.",
    );
  const attempt = await db.aIExecutionAttempt.findFirst({
    where: { taskId: old.id, workspaceId: job.workspaceId },
    orderBy: { sequence: "desc" },
  });
  const snapshot = old.inputContext as { sourceManifest?: Record<string, string[]> } | null;
  const sources = snapshot?.sourceManifest;
  if (attempt?.status === "FAILED" && attempt.failureCode === "AI_RATE_LIMITED") {
    await deps.store.updateTask(job.workspaceId, old.id, {
      status: "FAILED",
      failureCode: "AI_RATE_LIMITED",
      completedAt: new Date(),
    });
    throw new ResearchOperationError(
      "AI_RATE_LIMITED",
      "The captured provider rate limit will be retried with bounded backoff.",
    );
  }
  if (!attempt?.response || !sources) {
    await deps.store.updateTask(job.workspaceId, old.id, {
      status: "FAILED",
      failureCode: "AI_INTERRUPTED_UNCERTAIN",
      errorMessage: "Execution was interrupted before its response was captured.",
      completedAt: new Date(),
    });
    throw new ResearchOperationError(
      "AI_INTERRUPTED_UNCERTAIN",
      "The response was not captured. The original attempt remains recorded.",
    );
  }
  const response = attempt.response as unknown as AiProviderResponse;
  const selected = (key: string) => new Set(sources[key] ?? []);
  const validated = validateOutput(old.taskType, response.structured, {
    observationIds: selected("observationIds"),
    hypothesisIds: selected("hypothesisIds"),
    evidenceIds: selected("evidenceIds"),
    findingIds: selected("findingIds"),
    decisionIds: selected("decisionIds"),
    knowledgeIds: selected("knowledgeIds"),
    historyIds: selected("historyIds"),
  });
  if (!validated.ok) {
    await deps.store.updateTask(job.workspaceId, old.id, {
      status: "FAILED",
      failureCode: "AI_OUTPUT_VALIDATION_FAILED",
      errorMessage: "The recovered response failed source validation.",
      completedAt: new Date(),
    });
    throw new ResearchOperationError(
      "AI_OUTPUT_VALIDATION_FAILED",
      "The recovered response failed source validation.",
    );
  }
  const all = await db.aIExecutionAttempt.findMany({
    where: { taskId: old.id, workspaceId: job.workspaceId },
    select: { inputTokens: true, outputTokens: true },
  });
  const usage = all.reduce(
    (sum, a) => ({
      inputTokens: sum.inputTokens + a.inputTokens,
      outputTokens: sum.outputTokens + a.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
  const summary =
    old.taskType === "SESSION_SUMMARY" ? (validated.output as SessionSummaryOutput) : null;
  const completed = await deps.store.completeTask(
    job.workspaceId,
    old.id,
    {
      ...usage,
      estimatedCostUsd: estimateCostUsd(
        AI_TASK_PROFILES[old.taskType].tier,
        usage.inputTokens,
        usage.outputTokens,
      ),
      output: validated.output,
      executionJobId: job.id,
      executorToken: job.leaseToken!,
      completedAt: new Date(),
    },
    {
      ...(summary
        ? {
            summary: {
              ...summary,
              investigationId: old.investigationId,
              sourceTaskId: old.id,
              createdBy: job.requestedBy,
              model: old.model,
              promptVersion: old.promptVersion,
            },
          }
        : {}),
      ...(old.conversationId && !summary
        ? {
            message: {
              conversationId: old.conversationId,
              role: "ASSISTANT",
              content: formatAssistantMessage(old.taskType, validated.output),
              structuredContent: validated.output,
              ...usage,
            },
          }
        : {}),
    },
  );
  if (!completed)
    throw new ResearchOperationError(
      "JOB_CANCELLED",
      "Access or task state changed before the result was saved.",
    );
  return { taskId: completed.task.id, recovered: true };
}
