import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AiServiceDependencies } from "@/modules/ai/application/task-service";
import { routeModel } from "@/modules/ai/application/model-router";
import { modelForTask, type AiProviderName } from "@/modules/ai/domain/ai-config";
import {
  AI_DAILY_USER_TOKEN_CAP,
  estimateCostUsd,
  estimateTokens,
} from "@/modules/ai/domain/ai-budgets";
import { estimateModelCost } from "@/modules/ai/domain/model-registry";
import { AiError, aiErrorFromUnknown } from "@/modules/ai/domain/ai-errors";
import { ProviderQuotaStore } from "@/modules/ai/infrastructure/groq-quota-store";
import type { AiProviderRequest } from "@/modules/ai/application/provider";
import { getServerEnv } from "@/config/env.server";
import { JobContinuation, type JobRow } from "@/modules/tasks/domain/job";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import { bountySourceInputSchema, type BountyDraft } from "../domain/bounty-import";
import { bountyExtractionRequest, validateBountyExtraction } from "../application/extract-bounty";
import { readProgramPage } from "./program-page-reader";
import { requireResearchMember } from "@/modules/shared/infrastructure/research-transaction";
import { bountyUsage } from "./bounty-usage";

type ImportExecution = {
  request: AiProviderRequest;
  page: { url: string; text: string } | null;
  reservedTokens: number;
  reservedCostUsd: number;
  started?: boolean;
  responseReceived?: boolean;
  draft?: BountyDraft;
  savedProjectId?: string;
  sourceWarning?: string;
};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

// Reservations are retained after uncertain delivery. A reclaimed lease never
// repeats a model call whose delivery cannot be established.
export async function executeBountyImport(
  db: Prisma.TransactionClient,
  ai: AiServiceDependencies,
  job: JobRow,
) {
  const input = bountySourceInputSchema.parse(job.payload);
  const env = getServerEnv();
  let state = job.result as ImportExecution | null;
  if (state?.draft) return state;
  if (state?.responseReceived)
    throw new ResearchOperationError(
      "BOUNTY_INVALID_OUTPUT",
      "This import needs a new request; its previous response did not complete validation.",
    );
  if (state?.started)
    throw new AiError(
      "AI_PROVIDER_ERROR",
      "The previous import was interrupted. Start a new import after checking provider usage.",
    );
  let provider = ai.provider;
  let providerName: AiProviderName =
    ai.modelOverrides?.provider ?? (provider.name === "GROQ" ? "GROQ" : "ANTHROPIC");
  let model = modelForTask("RECON_ANALYSIS", ai.modelOverrides);
  let route;
  let page = state?.page ?? null;
  let sourceWarning = state?.sourceWarning;
  if (!state && input.readUrl && input.programUrl) {
    try {
      page = await readProgramPage(input.programUrl);
    } catch (error) {
      if (!input.details) throw error;
      sourceWarning =
        "The program URL could not be read. These suggestions use only the details you pasted; check that the scope is complete.";
    }
  }
  if (ai.runtime) {
    route = await routeModel(ai.runtime, "RECON_ANALYSIS", "PRIMARY", {
      inputTokens: estimateTokens(JSON.stringify(input) + (page?.text ?? "")) + 1200,
    });
    provider = route.provider;
    model = route.model.modelId;
    providerName = route.model.provider;
  }
  if (state && (state.request.model !== model || state.request.provider !== providerName))
    throw new AiError(
      "AI_NO_COMPATIBLE_MODEL",
      "The model selected for this import is no longer available.",
    );
  const request = state?.request ?? {
    ...bountyExtractionRequest(input, page, model),
    provider: providerName,
  };
  const inputTokens =
    provider.countInputTokens?.(request) ?? estimateTokens(JSON.stringify(request)) + 256;
  const reservation = inputTokens + request.maxTokens;
  if (provider.executionPolicy && reservation > provider.executionPolicy.maxRequestTokens)
    throw new AiError("AI_CONTEXT_TOO_LARGE");
  const cost =
    provider.name === "MOCK"
      ? 0
      : route
        ? estimateModelCost(route.model, inputTokens, request.maxTokens)
        : estimateCostUsd("SONNET", inputTokens, request.maxTokens, providerName);
  if (cost === null) throw new AiError("AI_COST_LIMIT");
  const actor = {
    userId: job.requestedBy,
    workspaceId: job.workspaceId,
    role: "RESEARCHER" as const,
  };
  const fence = {
    id: job.id,
    workspaceId: job.workspaceId,
    status: "RUNNING" as const,
    leaseToken: job.leaseToken,
    cancelRequestedAt: null,
    leaseUntil: { gt: new Date() },
  };
  if (!state) {
    state = { request, page, sourceWarning, reservedTokens: reservation, reservedCostUsd: cost };
    const prepared = state;
    await db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${job.requestedBy}::uuid FOR UPDATE`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('sentinel-ai-spending'))`,
      );
      const since = new Date(Date.now() - 86400000);
      const tasks = await tx.aITask.findMany({
        where: {
          requestedBy: job.requestedBy,
          OR: [
            { createdAt: { gte: since } },
            { completedAt: { gte: since } },
            { usageReconciledAt: { gte: since } },
            { reservedTokens: { gt: 0 } },
          ],
        },
        select: { inputTokens: true, outputTokens: true, reservedTokens: true },
      });
      const imports = await bountyUsage(tx, job.requestedBy, job.id);
      const used =
        tasks.reduce(
          (total, task) => total + task.inputTokens + task.outputTokens + task.reservedTokens,
          0,
        ) + imports.tokens;
      if (used + reservation > AI_DAILY_USER_TOKEN_CAP) throw new AiError("AI_BUDGET_EXCEEDED");
      const spending = await tx.aIExecutionAttempt.findMany({
        where: { OR: [{ startedAt: { gte: since } }, { reservedCostUsd: { gt: 0 } }] },
        select: { estimatedCostUsd: true, reservedCostUsd: true },
      });
      const spent =
        spending.reduce(
          (total, attempt) =>
            total + Number(attempt.estimatedCostUsd ?? 0) + Number(attempt.reservedCostUsd),
          0,
        ) + (await bountyUsage(tx, undefined, job.id)).costUsd;
      if (
        ai.runtime &&
        cost > 0 &&
        (cost > ai.runtime.maxTaskCostUsd || spent + cost > ai.runtime.maxDailyCostUsd)
      )
        throw new AiError("AI_COST_LIMIT");
      if (
        !(
          await tx.backgroundJob.updateMany({
            where: fence,
            data: { result: json(prepared), progress: 20 },
          })
        ).count
      )
        throw new ResearchOperationError(
          "JOB_LEASE_LOST",
          "The import was cancelled or its lease expired.",
        );
    });
  }
  const limits =
    ai.runtime?.config.quotas[providerName] ??
    (providerName === "GROQ"
      ? {
          tokensPerMinute: env.GROQ_TOKENS_PER_MINUTE,
          tokensPerDay: env.GROQ_TOKENS_PER_DAY,
          requestsPerDay: env.GROQ_REQUESTS_PER_DAY,
        }
      : { tokensPerMinute: 128000, tokensPerDay: 1000000, requestsPerDay: 1000 });
  if (provider.name !== "MOCK") {
    const quota = await new ProviderQuotaStore(db, limits, undefined, providerName).reserve(
      providerName === "OPENROUTER" ? "" : model,
      reservation,
    );
    if (!quota.ready) throw new JobContinuation(quota.availableAt, 20);
  }
  state.started = true;
  if (
    !(
      await db.backgroundJob.updateMany({
        where: { ...fence, leaseUntil: { gt: new Date() } },
        data: { result: json(state), progress: 40 },
      })
    ).count
  )
    throw new ResearchOperationError("JOB_LEASE_LOST", "The import was cancelled.");
  try {
    const response = await provider.generate(request);
    state.reservedTokens = response.usage.inputTokens + response.usage.outputTokens;
    state.reservedCostUsd = response.costUsd ?? cost;
    state.started = false;
    state.responseReceived = true;
    if (
      !(
        await db.backgroundJob.updateMany({
          where: { ...fence, leaseUntil: { gt: new Date() } },
          data: { result: json(state), progress: 80 },
        })
      ).count
    )
      throw new ResearchOperationError("JOB_LEASE_LOST", "The import was cancelled.");
    if (["length", "refusal", "model_mismatch"].includes(response.stopReason ?? ""))
      throw new AiError("AI_INVALID_OUTPUT");
    state.draft = validateBountyExtraction(response.structured, input, page);
    if (state.sourceWarning) state.draft.warnings.push(state.sourceWarning);
    if (
      !(
        await db.backgroundJob.updateMany({
          where: { ...fence, leaseUntil: { gt: new Date() } },
          data: { result: json(state), progress: 95 },
        })
      ).count
    )
      throw new ResearchOperationError("JOB_LEASE_LOST", "The import was cancelled.");
    return state;
  } catch (caught) {
    if (caught instanceof ResearchOperationError) throw caught;
    const error = aiErrorFromUnknown(caught);
    if (error.delivery === "REJECTED") {
      state.started = false;
      if (!error.retryable) {
        state.reservedTokens = 0;
        state.reservedCostUsd = 0;
      }
      await db.backgroundJob.updateMany({
        where: { ...fence, leaseUntil: { gt: new Date() } },
        data: { result: json(state) },
      });
    }
    throw error;
  }
}
