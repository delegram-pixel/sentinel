import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { JobRow } from "@/modules/tasks";
import { JobContinuation } from "@/modules/tasks/domain/job";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import type { AiProviderRequest, AiProviderResponse } from "../application/provider";
import type { AiTaskRow } from "../application/ports";
import {
  failTask,
  formatAssistantMessage,
  validateTaskResponse,
  type AiServiceDependencies,
} from "../application/task-service";
import {
  createBatchState,
  nextBatchRequest,
  planSourceChecks,
  batchNoteSchema,
  sourceCheckSchema,
  batchProgress,
  type BatchState,
} from "../application/batch-planner";
import { AiError, aiErrorFromUnknown, AI_ERROR_CODES, type AiErrorCode } from "../domain/ai-errors";
import { estimateTokens, estimateCostUsd } from "../domain/ai-budgets";
import { AI_TASK_PROFILES, type AiProviderName } from "../domain/ai-config";
import { estimateModelCost } from "../domain/model-registry";
import { routeModel } from "../application/model-router";
import { ProviderQuotaStore } from "./groq-quota-store";
import { recordProviderHealth } from "./provider-health";
import { getServerEnv } from "@/config/env.server";
import type { SessionSummaryOutput } from "../domain/structured-output";

type Pending = {
  sequence: number;
  request: AiProviderRequest;
  sourceIds: string[];
  mergeCount: number;
  quota?: { tokens: number; windowStartedAt: string; bucket: string };
};
type ExecutionState = {
  version: 1;
  base: AiProviderRequest;
  sequence: number;
  retries: number;
  correctionUsed: boolean;
  pending?: Pending;
  batch?: BatchState;
  final?: unknown;
  excluded: string[];
  fallbackFrom?: string;
};
type Snapshot = {
  request: AiProviderRequest;
  sourceManifest: Record<string, string[]>;
  contextRecords?: string[];
  reviewClaims?: Record<string, string[]>;
  executor?: ExecutionState;
  excludedModels?: string[];
};

/** Each state transition is fenced. Every external generation has its own immutable attempt. */
export async function executePreparedTask(
  db: Prisma.TransactionClient,
  initialDeps: AiServiceDependencies,
  job: JobRow,
  task: AiTaskRow,
): Promise<{ taskId: string; recovered?: boolean }> {
  let deps = initialDeps;
  const snapshot = task.inputContext as Snapshot;
  if (!snapshot?.request || !snapshot.sourceManifest)
    throw new ResearchOperationError("AI_CONTEXT_UNAVAILABLE", "The saved request is unavailable.");
  const selected = (key: string) => new Set(snapshot.sourceManifest[key] ?? []);
  const context = {
    observationIds: selected("observationIds"),
    hypothesisIds: selected("hypothesisIds"),
    evidenceIds: selected("evidenceIds"),
    findingIds: selected("findingIds"),
    decisionIds: selected("decisionIds"),
    knowledgeIds: selected("knowledgeIds"),
    historyIds: selected("historyIds"),
    reviewClaims: snapshot.reviewClaims,
  };
  const records = snapshot.contextRecords ?? [];
  const ids = [...new Set(Object.values(snapshot.sourceManifest).flat())];
  const latest = await db.aIExecutionAttempt.findFirst({
    where: { taskId: task.id, workspaceId: job.workspaceId },
    orderBy: { sequence: "desc" },
  });
  let state = task.executionState as ExecutionState | null | undefined;
  const recovered = Boolean(latest?.response);
  if (!state) {
    state = {
      version: 1,
      base: snapshot.request,
      sequence: 1,
      retries: 0,
      correctionUsed: false,
      excluded: [],
    };
    if (latest)
      state.pending = {
        sequence: latest.sequence,
        request: latest.request as unknown as AiProviderRequest,
        sourceIds: ids,
        mergeCount: 0,
      };
    else if (deps.provider.executionPolicy)
      state.batch = createBatchState(records, ids, state.base, deps.provider.executionPolicy);
  }
  const execution = state;
  async function save() {
    const changed = await db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${job.id}::uuid FOR UPDATE`,
      );
      if (
        !(await tx.backgroundJob.findFirst({
          where: {
            id: job.id,
            workspaceId: job.workspaceId,
            status: "RUNNING",
            leaseToken: job.leaseToken,
            cancelRequestedAt: null,
            leaseUntil: { gt: new Date() },
          },
        }))
      )
        throw new ResearchOperationError("JOB_CANCELLED", "The worker lease expired.");
      return tx.aITask.updateMany({
        where: {
          id: task.id,
          workspaceId: job.workspaceId,
          status: "RUNNING",
          executorToken: job.leaseToken,
          executionJobId: job.id,
        },
        data: { executionState: JSON.parse(JSON.stringify(execution)) as Prisma.InputJsonValue },
      });
    });
    if (!changed.count)
      throw new ResearchOperationError(
        "JOB_CANCELLED",
        "The task is no longer owned by this worker.",
      );
  }
  async function abort(error: AiError): Promise<never> {
    await failTask(deps, task, error.code, error.message);
    throw new ResearchOperationError(error.code, error.message);
  }
  let final: ReturnType<typeof validateTaskResponse> | undefined;
  try {
    for (;;) {
      if (execution.final !== undefined) {
        final = validateTaskResponse(task, execution.final, context);
        if (!final.ok) return await abort(new AiError("AI_OUTPUT_VALIDATION_FAILED"));
        break;
      }
      if (!execution.pending) {
        const next =
          execution.batch && deps.provider.executionPolicy
            ? nextBatchRequest(execution.batch, execution.base, deps.provider.executionPolicy)
            : { request: execution.base, sourceIds: ids, mergeCount: 0 };
        if (!next) {
          execution.final = execution.batch?.draft;
          await save();
          continue;
        }
        execution.pending = { ...next, sequence: execution.sequence };
        await save();
      }
      const pending = execution.pending;
      const provider = (execution.base.provider ?? task.provider) as AiProviderName;
      const model = deps.route?.model;
      const inputTokens =
        deps.provider.countInputTokens?.(pending.request) ??
        deps.provider.executionPolicy?.countInputTokens(pending.request) ??
        estimateTokens(
          pending.request.system +
            JSON.stringify(pending.request.messages) +
            JSON.stringify(pending.request.structuredOutput),
        ) + 256;
      if (inputTokens > task.inputTokenBudget)
        return await abort(new AiError("AI_CONTEXT_TOO_LARGE"));
      const price = model?.pricing;
      const nextPrice = price?.effectiveUntil && new Date() >= new Date(price.effectiveUntil);
      const request: AiProviderRequest = {
        ...pending.request,
        provider,
        inputTokenEstimate: inputTokens,
        retryCount: execution.retries,
        fallbackFrom:
          execution.fallbackFrom ?? snapshot.request.fallbackFrom ?? deps.route?.fallbackFrom,
        costEstimateUsd: model
          ? estimateModelCost(model, inputTokens, pending.request.maxTokens)
          : provider === "GROQ"
            ? 0
            : undefined,
        ...(price
          ? {
              pricing: {
                input: nextPrice ? price.nextInput! : price.input,
                output: nextPrice ? price.nextOutput! : price.output,
              },
            }
          : {}),
      };
      const env = getServerEnv();
      const limits =
        deps.runtime?.config.quotas[provider] ??
        (provider === "GROQ"
          ? {
              tokensPerMinute: env.GROQ_TOKENS_PER_MINUTE,
              tokensPerDay: env.GROQ_TOKENS_PER_DAY,
              requestsPerDay: env.GROQ_REQUESTS_PER_DAY,
              requestsPerMinute: 1,
            }
          : {
              tokensPerMinute: 128000,
              tokensPerDay: 1000000,
              requestsPerDay: 1000,
              requestsPerMinute: 10,
            });
      const quota = new ProviderQuotaStore(db, limits, () => new Date(), provider);
      const bucket = provider === "OPENROUTER" ? "" : request.model;
      let attempt = await db.aIExecutionAttempt.findUnique({
        where: { taskId_sequence: { taskId: task.id, sequence: pending.sequence } },
      });
      if (!attempt && !pending.quota) {
        const reservation = await quota.reserve(bucket, inputTokens + request.maxTokens);
        if (!reservation.ready)
          throw new JobContinuation(
            reservation.availableAt,
            execution.batch ? batchProgress(execution.batch) : 10,
          );
        pending.quota = {
          tokens: inputTokens + request.maxTokens,
          windowStartedAt: reservation.windowStartedAt.toISOString(),
          bucket,
        };
        await save();
      }
      let response: AiProviderResponse | null =
        (attempt?.response as unknown as AiProviderResponse | null) ?? null;
      let error: AiError | undefined;
      if (attempt && !response) {
        if (attempt.status === "FAILED" && attempt.delivery === "REJECTED")
          error = new AiError(
            AI_ERROR_CODES.includes(attempt.failureCode as AiErrorCode)
              ? (attempt.failureCode as AiErrorCode)
              : "AI_PROVIDER_ERROR",
            undefined,
            attempt.failureCode === "AI_RATE_LIMITED",
            61000,
            "REJECTED",
          );
        else
          return await abort(
            new AiError(
              "AI_PROVIDER_ERROR",
              "Execution was interrupted with uncertain delivery. Reconcile its usage before retrying.",
            ),
          );
      }
      if (!attempt) {
        const admitted = await deps.store.startAttempt(
          job.workspaceId,
          task.id,
          pending.sequence,
          request,
          { jobId: job.id, token: job.leaseToken! },
        );
        try {
          response = await deps.provider.generate(request);
        } catch (caught) {
          error = aiErrorFromUnknown(caught);
        }
        if (error) {
          await deps.store.finishAttempt(
            job.workspaceId,
            admitted.id,
            null,
            error.code,
            error.delivery,
          );
          await recordProviderHealth(db, provider, request.model, error);
        } else if (response) {
          await deps.store.finishAttempt(job.workspaceId, admitted.id, response);
          await recordProviderHealth(db, provider, request.model);
        }
        attempt = await db.aIExecutionAttempt.findUniqueOrThrow({ where: { id: admitted.id } });
      }
      if (pending.quota && (response || error?.delivery === "REJECTED"))
        await quota.settle(
          job.workspaceId,
          attempt!.id,
          pending.quota.bucket,
          pending.quota.tokens,
          response ? response.usage.inputTokens + response.usage.outputTokens : 0,
          new Date(pending.quota.windowStartedAt),
        );
      if (error) {
        if (error.delivery === "UNCERTAIN") return await abort(error);
        execution.pending = undefined;
        execution.sequence = pending.sequence + 1;
        if (error.retryable && execution.retries < (deps.runtime?.config.maxRetries ?? 2)) {
          execution.retries++;
          await save();
          throw new JobContinuation(
            new Date(
              Date.now() + Math.max(error.retryAfterMs ?? 1000, 1000 * 2 ** execution.retries),
            ),
            10,
          );
        }
        if (deps.runtime) {
          execution.excluded.push(request.model);
          try {
            const route = await routeModel(
              deps.runtime,
              task.taskType,
              task.collaborationStage === "REVIEW"
                ? "REVIEW"
                : task.collaborationStage === "SECONDARY"
                  ? "SECONDARY"
                  : "PRIMARY",
              {
                excludedModels: [...execution.excluded, ...(snapshot.excludedModels ?? [])],
                inputTokens,
              },
            );
            route.fallbackFrom = request.model;
            deps = { ...deps, route, provider: route.provider };
            execution.base = {
              ...execution.base,
              provider: route.model.provider,
              model: route.model.modelId,
            };
            execution.fallbackFrom = request.model;
            execution.retries = 0;
            execution.batch = route.provider.executionPolicy
              ? createBatchState(records, ids, execution.base, route.provider.executionPolicy)
              : undefined;
            await deps.store.recordTaskEvent(
              task.id,
              "TASK_ASSIGNMENT",
              "Compatible fallback selected.",
              {
                from: request.model,
                provider: route.model.provider,
                model: route.model.modelId,
                reason: error.code,
              },
            );
            await save();
            continue;
          } catch (fallbackError) {
            if (fallbackError instanceof JobContinuation) throw fallbackError;
          }
        }
        return await abort(error);
      }
      if (!response) return await abort(new AiError("AI_INVALID_OUTPUT"));
      if (["refusal", "model_mismatch", "length"].includes(response.stopReason ?? ""))
        return await abort(
          new AiError(response.stopReason === "refusal" ? "AI_REFUSAL" : "AI_INVALID_OUTPUT"),
        );
      const batch = execution.batch;
      let problems: string[] = [];
      if (batch && ["BATCH_REVIEW", "BATCH_MERGE"].includes(request.purpose ?? "")) {
        const note = batchNoteSchema.safeParse(response.structured);
        if (!note.success) problems = ["Invalid batch notes."];
        else if (note.data.sourceIds.some((id) => !pending.sourceIds.includes(id)))
          problems = ["Batch notes cite a source not supplied in this batch."];
        else if (request.purpose === "BATCH_REVIEW") {
          batch.notes.push(note.data);
          batch.reviewed++;
        } else {
          batch.nextNotes.push(note.data);
          batch.mergeCursor += pending.mergeCount;
        }
      } else if (batch && request.purpose === "SOURCE_CHECK") {
        const check = sourceCheckSchema.safeParse(response.structured);
        if (!check.success) problems = ["Invalid source check."];
        else if (check.data.problems.length) {
          if (execution.correctionUsed)
            return await abort(new AiError("AI_OUTPUT_VALIDATION_FAILED"));
          execution.correctionUsed = true;
          batch.phase = "FINAL";
          batch.checked = 0;
          batch.correctionProblems = check.data.problems;
        } else batch.checked++;
      } else {
        const validation = validateTaskResponse(task, response.structured, context);
        if (!validation.ok) problems = validation.problems;
        else if (batch && deps.provider.executionPolicy) {
          batch.draft = response.structured;
          batch.correctionProblems = [];
          planSourceChecks(batch, records, ids, execution.base, deps.provider.executionPolicy);
        } else execution.final = response.structured;
      }
      execution.pending = undefined;
      execution.sequence = pending.sequence + 1;
      execution.retries = 0;
      if (problems.length) {
        if (execution.correctionUsed)
          return await abort(new AiError("AI_OUTPUT_VALIDATION_FAILED"));
        execution.correctionUsed = true;
        if (batch) batch.correctionProblems = problems;
        else
          execution.base = {
            ...execution.base,
            messages: [
              ...execution.base.messages,
              { role: "assistant", content: response.text || JSON.stringify(response.structured) },
              {
                role: "user",
                content:
                  "Correct these validation errors without inventing sources: " +
                  problems.join("; "),
              },
            ],
          };
      }
      await save();
    }
    if (!final?.ok) return await abort(new AiError("AI_OUTPUT_VALIDATION_FAILED"));
    const attempts = await db.aIExecutionAttempt.findMany({ where: { taskId: task.id } });
    const usage = attempts.reduce(
      (s, a) => ({
        inputTokens: s.inputTokens + a.inputTokens,
        outputTokens: s.outputTokens + a.outputTokens,
      }),
      { inputTokens: 0, outputTokens: 0 },
    );
    const cost = attempts.some((a) => a.estimatedCostUsd !== null)
      ? attempts.reduce((s, a) => s + Number(a.estimatedCostUsd ?? 0), 0)
      : estimateCostUsd(
          AI_TASK_PROFILES[task.taskType].tier,
          usage.inputTokens,
          usage.outputTokens,
          task.provider,
        );
    const summary =
      task.taskType === "SESSION_SUMMARY" ? (final.output as SessionSummaryOutput) : null;
    const completed = await deps.store.completeTask(
      job.workspaceId,
      task.id,
      {
        ...usage,
        output: final.output,
        ...("evaluation" in final ? { evaluation: final.evaluation } : {}),
        model: execution.base.model,
        provider: execution.base.provider ?? task.provider,
        estimatedCostUsd: cost,
        completedAt: new Date(),
        executionJobId: job.id,
        executorToken: job.leaseToken!,
      },
      {
        ...(summary
          ? {
              summary: {
                ...summary,
                investigationId: task.investigationId,
                sourceTaskId: task.id,
                createdBy: job.requestedBy,
                model: execution.base.model,
                promptVersion: task.promptVersion,
              },
            }
          : {}),
        ...(task.conversationId &&
        !summary &&
        task.collaborationStage !== "SECONDARY" &&
        task.collaborationStage !== "REVIEW"
          ? {
              message: {
                conversationId: task.conversationId,
                role: "ASSISTANT" as const,
                content: formatAssistantMessage(task.taskType, final.output),
                structuredContent: final.output,
                ...usage,
              },
            }
          : {}),
      },
    );
    if (!completed)
      throw new ResearchOperationError(
        "JOB_CANCELLED",
        "The task was cancelled or its access changed.",
      );
    return { taskId: task.id, ...(recovered ? { recovered: true } : {}) };
  } catch (error) {
    if (error instanceof JobContinuation || error instanceof ResearchOperationError) throw error;
    if (error instanceof AiError) return await abort(error);
    // A persistence interruption resumes from the saved attempt; it is not a provider rejection.
    throw error;
  }
}
