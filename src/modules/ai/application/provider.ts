import type { AiTaskType } from "../domain/ai-config";

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
};

export type AiProviderResponse = {
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
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}

export const STRUCTURED_OUTPUT_TOOL = "return_structured_output";
