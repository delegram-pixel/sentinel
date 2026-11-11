import type { AiModelTier, AiTaskProfile, AiProviderName } from "./ai-config";

/** ADR-025: total tokens a single user may consume in a rolling 24h window. */
export const AI_DAILY_USER_TOKEN_CAP = 250_000;

/** ADR-025: compress context once estimated input reaches this share of budget. */
export const AI_CONTEXT_COMPRESSION_THRESHOLD = 0.6;

/** Conservative character-to-token estimate used before the provider reports usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function canAffordTask(
  usedTokens: number,
  profile: Pick<AiTaskProfile, "inputTokenBudget" | "outputTokenBudget">,
): boolean {
  return (
    usedTokens + profile.inputTokenBudget + profile.outputTokenBudget <= AI_DAILY_USER_TOKEN_CAP
  );
}

export function remainingDailyTokens(usedTokens: number): number {
  return Math.max(0, AI_DAILY_USER_TOKEN_CAP - usedTokens);
}

/** USD per million tokens. Used for the advisory `estimatedCostUsd` field. */
const MODEL_PRICING: Record<AiModelTier, { input: number; output: number }> = {
  SONNET: { input: 3, output: 15 },
  HAIKU: { input: 1, output: 5 },
};

export function estimateCostUsd(
  tier: AiModelTier,
  inputTokens: number,
  outputTokens: number,
  provider: AiProviderName = "ANTHROPIC",
): number {
  // ADR-033 pins Groq to its free plan; no paid fallback is selected.
  if (provider === "GROQ") return 0;
  const pricing = MODEL_PRICING[tier];

  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
