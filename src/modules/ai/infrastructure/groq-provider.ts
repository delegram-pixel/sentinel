import "server-only";
import { z } from "zod";
import { encode } from "gpt-tokenizer/encoding/o200k_harmony";

import { AiError } from "../domain/ai-errors";
import type { AIProvider, AiProviderRequest, AiProviderResponse } from "../application/provider";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const envelopeSchema = z.object({
  id: z.string(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
          refusal: z.string().nullable().optional(),
        }),
        finish_reason: z.string().nullable(),
      }),
    )
    .length(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
  }),
});

import {
  strictJsonSchema as groqJsonSchema,
  restoreOptionalFields,
} from "./json-schema-adaptation";
export {
  strictJsonSchema as groqJsonSchema,
  restoreOptionalFields,
} from "./json-schema-adaptation";

/** GPT-OSS Harmony encoding plus conservative allowance for server/schema framing. */
export function groqInputTokens(request: AiProviderRequest): number {
  const count = (text: string) => encode(text, { disallowedSpecial: new Set() }).length;
  return (
    count(request.system) +
    request.messages.reduce((sum, m) => sum + count(m.content) + 24, 0) +
    (request.structuredOutput
      ? count(JSON.stringify(groqJsonSchema(request.structuredOutput.schema)))
      : 0) +
    256
  );
}

function retryAfter(response: Response): number {
  const value = response.headers.get("retry-after");
  if (value && Number.isFinite(Number(value))) return Math.max(1000, Number(value) * 1000);
  if (value && Number.isFinite(Date.parse(value)))
    return Math.max(1000, Date.parse(value) - Date.now());
  const reset = response.headers.get("x-ratelimit-reset-tokens") ?? "";
  const seconds = /^(\d+(?:\.\d+)?)s$/.exec(reset);
  return seconds ? Math.max(1000, Number(seconds[1]) * 1000) : 61000;
}

export class GroqProvider implements AIProvider {
  readonly name = "GROQ";
  readonly executionPolicy;
  readonly countInputTokens = groqInputTokens;
  private readonly fetchImpl: typeof fetch;
  constructor(
    private readonly options: {
      apiKey: string;
      tokensPerMinute?: number;
      fetchImpl?: typeof fetch;
    },
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.executionPolicy = {
      maxRequestTokens: Math.floor((options.tokensPerMinute ?? 8000) * 0.875),
      intermediateMaxTokens: 1500,
      countInputTokens: groqInputTokens,
    };
  }
  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    if (!request.model.trim()) throw new AiError("AI_NOT_CONFIGURED");
    if (groqInputTokens(request) + request.maxTokens > this.executionPolicy.maxRequestTokens)
      throw new AiError(
        "AI_CONTEXT_TOO_LARGE",
        "This provider request exceeds the configured free quota.",
      );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await this.fetchImpl(GROQ_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: "system", content: request.system }, ...request.messages],
          max_completion_tokens: request.maxTokens,
          reasoning_effort: "low",
          stream: false,
          ...(request.structuredOutput
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: request.structuredOutput.toolName,
                    strict: true,
                    schema: groqJsonSchema(request.structuredOutput.schema),
                  },
                },
              }
            : {}),
        }),
      });
      if (!response.ok) {
        if (response.status === 429)
          throw new AiError("AI_RATE_LIMITED", undefined, true, retryAfter(response));
        if ([401, 403].includes(response.status))
          throw new AiError("AI_NOT_CONFIGURED", "Groq rejected the server credential.");
        if (response.status === 413) throw new AiError("AI_CONTEXT_TOO_LARGE");
        throw new AiError(
          "AI_PROVIDER_ERROR",
          undefined,
          response.status >= 500,
          undefined,
          response.status >= 500 ? "UNCERTAIN" : "REJECTED",
        );
      }
      const parsed = envelopeSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new AiError(
          "AI_INVALID_OUTPUT",
          "Groq returned an invalid response envelope or usage.",
        );
      const payload = parsed.data;
      const mismatch = Boolean(payload.model && payload.model !== request.model);
      const choice = payload.choices[0]!;
      const text = choice.message.content ?? "";
      let structured: unknown = null;
      try {
        structured = JSON.parse(text);
      } catch {
        /* Captured usage survives malformed JSON. */
      }
      if (request.structuredOutput)
        structured = restoreOptionalFields(structured, request.structuredOutput.schema);
      const refused = Boolean(choice.message.refusal) || choice.finish_reason === "content_filter";
      return {
        providerRequestId: payload.id,
        model: payload.model ?? request.model,
        text,
        structured: choice.finish_reason === "length" || refused || mismatch ? null : structured,
        usage: {
          inputTokens: payload.usage.prompt_tokens,
          outputTokens: payload.usage.completion_tokens,
        },
        stopReason: mismatch ? "model_mismatch" : refused ? "refusal" : choice.finish_reason,
      };
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new AiError("AI_TIMEOUT", undefined, true);
      throw new AiError("AI_PROVIDER_ERROR", undefined, true);
    } finally {
      clearTimeout(timer);
    }
  }
}
