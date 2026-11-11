import type { AiTaskType } from "../domain/ai-config";
import type { AiProviderName } from "../domain/ai-config";

export type AiProviderMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiStructuredOutputRequest = {
  toolName: string;
  description: string;
  schema: Record<string, unknown>;
};

export type AiProviderRequest = {
  provider?: AiProviderName;
  inputTokenEstimate?: number;
  costEstimateUsd?: number | null;
  retryCount?: number;
  fallbackFrom?: string;
  pricing?: { input: number; output: number };
  purpose?: "BATCH_REVIEW" | "BATCH_MERGE" | "FINAL" | "SOURCE_CHECK";
  taskType: AiTaskType;
  model: string;
  system: string;
  messages: readonly AiProviderMessage[];
  maxTokens: number;
  temperature?: number;
  timeoutMs: number;
  structuredOutput?: AiStructuredOutputRequest;
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
};

export type AiProviderResponse = {
  model?: string;
  host?: string;
  costUsd?: number;
  providerRequestId?: string;
  text: string;
  structured: unknown | null;
  usage: AiTokenUsage;
  stopReason: string | null;
};

/**
 * Provider-neutral contract. Business logic never imports a provider-specific
 * client (AI-ARCHITECTURE §9, ADR-025).
 */
export interface AIProvider {
  readonly name: string;
  countInputTokens?(request: AiProviderRequest): number;
  readonly executionPolicy?: {
    maxRequestTokens: number;
    intermediateMaxTokens: number;
    countInputTokens(request: AiProviderRequest): number;
  };
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}

export const STRUCTURED_OUTPUT_TOOL = "return_structured_output";
