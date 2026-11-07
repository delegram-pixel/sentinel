import "server-only";

import { getServerEnv } from "@/config/env.server";

import type { AiModelOverrides } from "../domain/ai-config";
import { MockAIProvider } from "../application/mock-provider";
import type { AIProvider } from "../application/provider";
import { AnthropicProvider } from "./anthropic-provider";
import { AiError } from "../domain/ai-errors";

export function createAIProvider(): AIProvider {
  const env = getServerEnv();

  if (
    env.NODE_ENV === "test" ||
    (env.NODE_ENV !== "production" && (env.AI_USE_MOCK_PROVIDER || !env.ANTHROPIC_API_KEY))
  ) {
    return new MockAIProvider();
  }

  if (!env.ANTHROPIC_API_KEY || env.AI_USE_MOCK_PROVIDER)
    return {
      name: "unavailable",
      async generate() {
        throw new AiError("AI_NOT_CONFIGURED");
      },
    };

  return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
}

export function aiModelOverrides(): AiModelOverrides {
  const env = getServerEnv();

  return {
    researchModel: env.AI_RESEARCH_MODEL,
    summaryModel: env.AI_SUMMARY_MODEL,
  };
}
