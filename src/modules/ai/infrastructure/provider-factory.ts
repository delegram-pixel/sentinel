import "server-only";

import { getServerEnv } from "@/config/env.server";

import type { AiModelOverrides } from "../domain/ai-config";
import { MockAIProvider } from "../application/mock-provider";
import type { AIProvider } from "../application/provider";
import { AnthropicProvider } from "./anthropic-provider";
import { GroqProvider } from "./groq-provider";
import { AiError } from "../domain/ai-errors";
import type { Prisma } from "@/generated/prisma/client";
import { GeminiProvider } from "./gemini-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import {
  DEFAULT_MODEL_REGISTRY,
  routingConfigSchema,
  type ModelEntry,
} from "../domain/model-registry";
import type { AiRuntime } from "../application/model-router";

export function createAiRuntime(db?: Prisma.TransactionClient): AiRuntime | undefined {
  const env = getServerEnv();
  if (env.AI_ROUTING_MODE !== "MULTI_MODEL") return undefined;
  const parsed = (() => {
    try {
      return routingConfigSchema.safeParse(
        env.AI_ROUTING_CONFIG ? JSON.parse(env.AI_ROUTING_CONFIG) : {},
      );
    } catch {
      return routingConfigSchema.safeParse(null);
    }
  })();
  const config = parsed.success ? parsed.data : routingConfigSchema.parse({});
  const models = parsed.success ? [...DEFAULT_MODEL_REGISTRY] : [];
  for (const custom of config.models) {
    const index = models.findIndex((m) => m.key === custom.key);
    if (index >= 0) models[index] = custom;
    else models.push(custom);
  }
  const overrides = {
    research: env.GEMINI_RESEARCH_MODEL,
    summary: env.GROQ_SUMMARY_MODEL,
    review: env.OPENROUTER_REVIEW_MODEL,
    secondary: env.OPENROUTER_SECONDARY_MODEL,
  };
  for (const [key, id] of Object.entries(overrides)) {
    const index = models.findIndex((m) => m.key === key);
    if (id && index >= 0 && models[index]!.modelId !== id) {
      const verified = models.find(
        (m) => m.provider === models[index]!.provider && m.modelId === id,
      );
      models[index] = verified
        ? { ...verified, key }
        : { ...models[index]!, modelId: id, availability: "UNVERIFIED" };
    }
  }
  const hosts =
    env.OPENROUTER_ALLOWED_PROVIDERS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const mock =
    env.NODE_ENV === "test" || (env.NODE_ENV !== "production" && env.AI_USE_MOCK_PROVIDER);
  if (mock)
    for (let i = 0; i < models.length; i++)
      models[i] = { ...models[i]!, free: true, pricing: { input: 0, output: 0 } };
  const providerFor = (model: ModelEntry): AIProvider | null => {
    if (mock) return new MockAIProvider();
    // Confidential Gemini/OpenRouter routes use paid accounts. A custom entry cannot bypass paid opt-in.
    if (model.free && ["GEMINI", "OPENROUTER", "ANTHROPIC"].includes(model.provider)) return null;
    if (model.provider === "GROQ" && env.GROQ_API_KEY)
      return new GroqProvider({
        apiKey: env.GROQ_API_KEY,
        tokensPerMinute: env.GROQ_TOKENS_PER_MINUTE,
      });
    if (model.provider === "GEMINI" && env.GEMINI_API_KEY)
      return new GeminiProvider({ apiKey: env.GEMINI_API_KEY });
    if (model.provider === "OPENROUTER" && env.OPENROUTER_API_KEY)
      return new OpenRouterProvider({
        apiKey: env.OPENROUTER_API_KEY,
        hosts,
        maxPrice: model.pricing ?? undefined,
      });
    if (model.provider === "ANTHROPIC" && env.ANTHROPIC_API_KEY)
      return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
    return null;
  };
  return {
    models,
    config,
    providerFor,
    allowPaid: Boolean(env.AI_ALLOW_PAID_MODELS),
    maxTaskCostUsd: env.AI_MAX_TASK_COST_USD,
    maxDailyCostUsd: env.AI_MAX_DAILY_COST_USD,
    privacyApproved(model) {
      if (mock) return true;
      if (model.provider === "GROQ") return Boolean(env.GROQ_ZDR_ENABLED);
      if (model.provider === "GEMINI")
        return Boolean(env.GEMINI_PAID_API_ENABLED && env.GEMINI_CONFIDENTIAL_DATA_APPROVED);
      if (model.provider === "OPENROUTER")
        return Boolean(
          env.OPENROUTER_PRIVACY_APPROVED &&
          env.OPENROUTER_ZDR_ENABLED &&
          hosts.length &&
          !model.modelId.endsWith(":free"),
        );
      return true; // Explicit legacy Anthropic use retains its existing policy.
    },
    ...(db
      ? {
          async health(model: ModelEntry) {
            const state = await db.aIProviderQuota.findUnique({
              where: { provider_model: { provider: model.provider, model: model.modelId } },
            });
            return {
              available:
                !state?.disabled && (!state?.cooldownUntil || state.cooldownUntil <= new Date()),
              retryAt: state?.cooldownUntil ?? undefined,
            };
          },
        }
      : {}),
  };
}

export function createAIProvider(): AIProvider {
  const env = getServerEnv();
  const apiKey = env.AI_PROVIDER === "GROQ" ? env.GROQ_API_KEY : env.ANTHROPIC_API_KEY;

  if (
    env.NODE_ENV === "test" ||
    (env.NODE_ENV !== "production" && (env.AI_USE_MOCK_PROVIDER || !apiKey))
  ) {
    return new MockAIProvider();
  }

  if (!apiKey || env.AI_USE_MOCK_PROVIDER || (env.AI_PROVIDER === "GROQ" && !env.GROQ_ZDR_ENABLED))
    return {
      name: "unavailable",
      async generate() {
        throw new AiError("AI_NOT_CONFIGURED");
      },
    };

  return env.AI_PROVIDER === "GROQ"
    ? new GroqProvider({ apiKey, tokensPerMinute: env.GROQ_TOKENS_PER_MINUTE })
    : new AnthropicProvider({ apiKey });
}

export function aiModelOverrides(): AiModelOverrides {
  const env = getServerEnv();

  return {
    provider: env.AI_PROVIDER,
    researchModel: env.AI_RESEARCH_MODEL,
    summaryModel: env.AI_SUMMARY_MODEL,
  };
}
