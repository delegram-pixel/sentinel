import "server-only";
import { z } from "zod";
import type { AIProvider, AiProviderRequest, AiProviderResponse } from "../application/provider";
import { AiError } from "../domain/ai-errors";
import { providerFetch, parseStructured } from "./provider-http";

const envelope = z
  .object({
    id: z.string(),
    model: z.string(),
    status: z.string(),
    steps: z.array(
      z
        .object({
          type: z.string(),
          content: z
            .array(
              z
                .object({
                  type: z.string(),
                  text: z.string().optional(),
                })
                .passthrough(),
            )
            .optional(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        total_input_tokens: z.number().int().nonnegative(),
        total_output_tokens: z.number().int().nonnegative(),
        total_thought_tokens: z.number().int().nonnegative().optional(),
        total_tokens: z.number().int().nonnegative(),
        total_cached_tokens: z.number().int().nonnegative().optional(),
      })
      .passthrough(),
  })
  .passthrough();
/** Stateless Interactions API. Sentinel owns history, storage, and execution. */
export class GeminiProvider implements AIProvider {
  readonly name = "GEMINI";
  constructor(private readonly options: { apiKey: string; fetchImpl?: typeof fetch }) {}
  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const payload = await providerFetch(
      this.options.fetchImpl ?? fetch,
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      this.options.apiKey,
      {
        model: request.model,
        system_instruction: request.system,
        input: request.messages.map((message) => ({
          type: message.role === "user" ? "user_input" : "model_output",
          content: [{ type: "text", text: message.content }],
        })),
        store: false,
        background: false,
        stream: false,
        generation_config: {
          max_output_tokens: request.maxTokens,
          thinking_level: "low",
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        },
        ...(request.structuredOutput
          ? {
              response_format: {
                type: "text",
                mime_type: "application/json",
                schema: request.structuredOutput.schema,
              },
            }
          : {}),
      },
      request.timeoutMs,
      "x-goog-api-key",
    );
    const parsed = envelope.safeParse(payload);
    if (!parsed.success) throw new AiError("AI_INVALID_OUTPUT");
    const p = parsed.data;
    const text = p.steps
      .filter((s) => s.type === "model_output")
      .flatMap((s) => s.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    // The total includes internal thinking. Never add thought tokens a second time.
    const outputTokens = Math.max(
      p.usage.total_output_tokens,
      p.usage.total_tokens - p.usage.total_input_tokens,
    );
    const valid = p.status === "completed" && p.model === request.model;
    return {
      providerRequestId: p.id,
      model: p.model,
      text,
      structured: valid ? parseStructured(text) : null,
      usage: {
        inputTokens: p.usage.total_input_tokens,
        outputTokens,
        reasoningTokens: p.usage.total_thought_tokens,
        cachedInputTokens: p.usage.total_cached_tokens,
      },
      stopReason:
        p.model !== request.model
          ? "model_mismatch"
          : p.status === "completed"
            ? "stop"
            : p.status === "incomplete"
              ? "length"
              : "refusal",
    };
  }
}
