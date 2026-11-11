import "server-only";
import { z } from "zod";
import type { AIProvider, AiProviderRequest, AiProviderResponse } from "../application/provider";
import { AiError } from "../domain/ai-errors";
import { providerFetch, parseStructured } from "./provider-http";
import { strictJsonSchema, restoreOptionalFields } from "./json-schema-adaptation";

const envelope = z.object({
  id: z.string(),
  model: z.string(),
  provider: z.string(),
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
    cost: z.number().nonnegative().optional(),
    completion_tokens_details: z
      .object({ reasoning_tokens: z.number().int().nonnegative().optional() })
      .optional(),
    prompt_tokens_details: z
      .object({ cached_tokens: z.number().int().nonnegative().optional() })
      .optional(),
  }),
});
export class OpenRouterProvider implements AIProvider {
  readonly name = "OPENROUTER";
  constructor(
    private readonly options: {
      apiKey: string;
      hosts: readonly string[];
      maxPrice?: { input: number; output: number };
      fetchImpl?: typeof fetch;
    },
  ) {}
  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    if (!this.options.hosts.length) throw new AiError("AI_PRIVACY_NOT_APPROVED");
    const payload = await providerFetch(
      this.options.fetchImpl ?? fetch,
      "https://openrouter.ai/api/v1/chat/completions",
      this.options.apiKey,
      {
        model: request.model,
        messages: [{ role: "system", content: request.system }, ...request.messages],
        max_tokens: request.maxTokens,
        stream: false,
        provider: {
          only: this.options.hosts,
          allow_fallbacks: false,
          require_parameters: true,
          data_collection: "deny",
          zdr: true,
          ...((request.pricing ?? this.options.maxPrice)
            ? {
                max_price: {
                  prompt: (request.pricing ?? this.options.maxPrice)!.input,
                  completion: (request.pricing ?? this.options.maxPrice)!.output,
                },
              }
            : {}),
        },
        reasoning: { effort: "low", exclude: true },
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.structuredOutput
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: request.structuredOutput.toolName,
                  strict: true,
                  schema: strictJsonSchema(request.structuredOutput.schema),
                },
              },
            }
          : {}),
      },
      request.timeoutMs,
    );
    const parsed = envelope.safeParse(payload);
    if (!parsed.success) throw new AiError("AI_INVALID_OUTPUT");
    const p = parsed.data;
    const choice = p.choices[0]!;
    const text = choice.message.content ?? "";
    const refused = Boolean(choice.message.refusal) || choice.finish_reason === "content_filter";
    const sameModel = p.model === request.model;
    // Hosts may return their display name rather than endpoint slug. Routing is enforced server-side by 'only'.
    let structured = parseStructured(text);
    if (request.structuredOutput)
      structured = restoreOptionalFields(structured, request.structuredOutput.schema);
    return {
      providerRequestId: p.id,
      model: p.model,
      host: p.provider,
      text,
      costUsd: p.usage.cost,
      structured: sameModel && !refused && choice.finish_reason === "stop" ? structured : null,
      usage: {
        inputTokens: p.usage.prompt_tokens,
        outputTokens: p.usage.completion_tokens,
        reasoningTokens: p.usage.completion_tokens_details?.reasoning_tokens,
        cachedInputTokens: p.usage.prompt_tokens_details?.cached_tokens,
      },
      stopReason: !sameModel ? "model_mismatch" : refused ? "refusal" : choice.finish_reason,
    };
  }
}
