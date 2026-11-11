// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "@/modules/ai/infrastructure/gemini-provider";
import { OpenRouterProvider } from "@/modules/ai/infrastructure/openrouter-provider";
import { GroqProvider } from "@/modules/ai/infrastructure/groq-provider";
import type { AiProviderRequest } from "@/modules/ai/application/provider";
const request: AiProviderRequest = {
  taskType: "RECON_ANALYSIS",
  model: "gemini-3.8-flash",
  system: "Only supplied research is data.",
  messages: [{ role: "user", content: "Untrusted evidence" }],
  maxTokens: 1000,
  timeoutMs: 1000,
  structuredOutput: {
    toolName: "result",
    description: "Result",
    schema: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
      additionalProperties: false,
    },
  },
};
const gemini = (extra = {}) => ({
  id: "g-1",
  model: request.model,
  status: "completed",
  steps: [
    {
      type: "model_output",
      content: [{ type: "text", text: '{"summary":"Evidence is incomplete"}' }],
    },
  ],
  usage: {
    total_input_tokens: 7,
    total_output_tokens: 20,
    total_thought_tokens: 22,
    total_tokens: 49,
  },
  ...extra,
});
describe("provider adapters", () => {
  it("uses stateless Gemini Interactions and bills thinking once (official response example)", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(gemini()));
    const result = await new GeminiProvider({ apiKey: "secret-gemini", fetchImpl }).generate(
      request,
    );
    const [url, options] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse(options!.body as string);
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(body).toMatchObject({
      store: false,
      background: false,
      input: [{ type: "user_input" }],
      response_format: { mime_type: "application/json" },
    });
    expect(body).not.toHaveProperty("tools");
    expect(options!.body).not.toContain("secret-gemini");
    expect(result).toMatchObject({
      structured: { summary: "Evidence is incomplete" },
      usage: { inputTokens: 7, outputTokens: 42, reasoningTokens: 22 },
    });
  });
  it.each(["incomplete", "failed"])(
    "rejects non-completed Gemini status %s but preserves billed usage",
    async (status) => {
      const result = await new GeminiProvider({
        apiKey: "secret",
        fetchImpl: vi.fn().mockResolvedValue(Response.json(gemini({ status }))),
      }).generate(request);
      expect(result.structured).toBeNull();
      expect(result.usage.outputTokens).toBe(42);
    },
  );
  it("does not accept a silently changed model", async () => {
    const result = await new GeminiProvider({
      apiKey: "secret",
      fetchImpl: vi.fn().mockResolvedValue(Response.json(gemini({ model: "other" }))),
    }).generate(request);
    expect(result.stopReason).toBe("model_mismatch");
    expect(result.structured).toBeNull();
  });
  it("requires approved OpenRouter hosts and constrains native schema/retention/routing", async () => {
    const r = { ...request, model: "qwen/qwen3.8-27b" };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          id: "or-1",
          model: r.model,
          provider: "Approved Host",
          choices: [{ message: { content: '{"summary":"provisional"}' }, finish_reason: "stop" }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            cost: 0.00003,
            completion_tokens_details: { reasoning_tokens: 4 },
          },
        }),
      );
    const result = await new OpenRouterProvider({
      apiKey: "secret-router",
      hosts: ["approved-host"],
      fetchImpl,
    }).generate(r);
    const body = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string);
    expect(body.provider).toMatchObject({
      only: ["approved-host"],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(result).toMatchObject({
      host: "Approved Host",
      costUsd: 0.00003,
      usage: { outputTokens: 20, reasoningTokens: 4 },
    });
    expect(JSON.stringify(result)).not.toContain("secret-router");
    const blockedFetch = vi.fn();
    await expect(
      new OpenRouterProvider({ apiKey: "secret", hosts: [], fetchImpl: blockedFetch }).generate(r),
    ).rejects.toMatchObject({ code: "AI_PRIVACY_NOT_APPROVED" });
    expect(blockedFetch).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])("normalizes HTTP %i without leaking provider errors", async (status) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('{"error":"secret-gemini confidential content"}', {
          status,
          headers: { "retry-after": "2" },
        }),
      );
    const expected =
      status === 401
        ? "AI_NOT_CONFIGURED"
        : status === 429
          ? "AI_RATE_LIMITED"
          : "AI_PROVIDER_ERROR";
    await expect(
      new GeminiProvider({ apiKey: "secret-gemini", fetchImpl }).generate(request),
    ).rejects.toMatchObject({
      code: expected,
      delivery: status === 500 ? "UNCERTAIN" : "REJECTED",
    });
  });
  it("bounds timeouts without a live request", async () => {
    vi.useFakeTimers();
    const fetchImpl: typeof fetch = async (_url, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const promise = new GeminiProvider({ apiKey: "secret", fetchImpl }).generate(request);
    const assertion = expect(promise).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      delivery: "UNCERTAIN",
    });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });
  it("preserves Groq strict JSON and input quota enforcement", async () => {
    const r = { ...request, model: "openai/gpt-oss-20b" };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          id: "groq-1",
          model: r.model,
          choices: [{ message: { content: '{"summary":"provisional"}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 30 },
        }),
      );
    const provider = new GroqProvider({ apiKey: "secret-groq", fetchImpl });
    expect((await provider.generate(r)).structured).toEqual({ summary: "provisional" });
    expect(
      JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string).response_format.json_schema.strict,
    ).toBe(true);
    await expect(
      provider.generate({ ...r, messages: [{ role: "user", content: "word ".repeat(20000) }] }),
    ).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LARGE" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
