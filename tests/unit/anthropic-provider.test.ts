import { describe, expect, it } from "vitest";

import type { AiProviderRequest } from "@/modules/ai/application/provider";
import { AiError } from "@/modules/ai/domain/ai-errors";
import { AnthropicProvider } from "@/modules/ai/infrastructure/anthropic-provider";

function request(overrides: Partial<AiProviderRequest> = {}): AiProviderRequest {
  return {
    taskType: "ATTACK_SURFACE_ANALYSIS",
    model: "claude-sonnet-4-5",
    system: "System instructions",
    messages: [{ role: "user", content: "What next?" }],
    maxTokens: 3_000,
    timeoutMs: 10_000,
    structuredOutput: {
      toolName: "return_structured_output",
      description: "Return the result.",
      schema: { type: "object", properties: { message: { type: "string" } } },
    },
    ...overrides,
  };
}

describe("Anthropic provider", () => {
  it("sends a structured-output tool request and parses tool use", async () => {
    const captured: { url?: string; init?: RequestInit } = {};

    const fetchImpl: typeof fetch = async (input, init) => {
      captured.url = String(input);
      captured.init = init ?? {};
      return new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "Here is the result." },
            {
              type: "tool_use",
              id: "tool_1",
              name: "return_structured_output",
              input: { message: "Validated answer" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 120, output_tokens: 30 },
        }),
        { status: 200 },
      );
    };

    const provider = new AnthropicProvider({ apiKey: "test-key", fetchImpl });
    const result = await provider.generate(request());

    expect(result.structured).toEqual({ message: "Validated answer" });
    expect(result.text).toBe("Here is the result.");
    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 30 });
    expect(captured.url).toBe("https://api.anthropic.com/v1/messages");

    const body = JSON.parse(String(captured.init?.body)) as Record<string, unknown>;
    expect(body.model).toBe("claude-sonnet-4-5");
    expect(body.max_tokens).toBe(3_000);
    expect(body.tool_choice).toEqual({
      type: "tool",
      name: "return_structured_output",
    });
    expect(body.tools).toEqual([
      {
        name: "return_structured_output",
        description: "Return the result.",
        input_schema: { type: "object", properties: { message: { type: "string" } } },
      },
    ]);

    const headers = captured.init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("maps rate limiting to a retryable AI error", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 });

    const provider = new AnthropicProvider({ apiKey: "test-key", fetchImpl });

    await expect(provider.generate(request())).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      retryable: true,
    });
  });

  it("maps prompt-too-long responses to a context error", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "prompt is too long" } }), { status: 400 });

    const provider = new AnthropicProvider({ apiKey: "test-key", fetchImpl });

    await expect(provider.generate(request())).rejects.toMatchObject({
      code: "AI_CONTEXT_TOO_LARGE",
    });
  });

  it("maps aborts to a timeout error", async () => {
    const fetchImpl: typeof fetch = async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    };

    const provider = new AnthropicProvider({ apiKey: "test-key", fetchImpl });

    await expect(provider.generate(request())).rejects.toBeInstanceOf(AiError);
    await expect(provider.generate(request())).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      retryable: true,
    });
  });

  it("treats a provider refusal as a refusal", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [],
          stop_reason: "refusal",
          usage: { input_tokens: 10, output_tokens: 0 },
        }),
        { status: 200 },
      );

    const provider = new AnthropicProvider({ apiKey: "test-key", fetchImpl });

    await expect(provider.generate(request())).rejects.toMatchObject({
      code: "AI_REFUSAL",
    });
  });
});
