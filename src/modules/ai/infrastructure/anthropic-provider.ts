import "server-only";
import { z } from "zod";

import { AiError } from "../domain/ai-errors";

import type { AIProvider, AiProviderRequest, AiProviderResponse } from "../application/provider";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const responseSchema = z
  .object({
    id: z.string().optional(),
    content: z.array(
      z
        .object({
          type: z.string(),
          text: z.string().optional(),
          id: z.string().optional(),
          name: z.string().optional(),
          input: z.unknown().optional(),
        })
        .passthrough(),
    ),
    stop_reason: z.string().nullable(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: string };

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
};

export type AnthropicProviderOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
};

/**
 * Anthropic Messages API adapter. Provider-specific request and response
 * shapes stay inside this file (ADR-025 / M-27).
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "ANTHROPIC";
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.structuredOutput
            ? {
                tools: [
                  {
                    name: request.structuredOutput.toolName,
                    description: request.structuredOutput.description,
                    input_schema: request.structuredOutput.schema,
                  },
                ],
                tool_choice: { type: "tool", name: request.structuredOutput.toolName },
              }
            : {}),
        }),
      });

      if (!response.ok) {
        throw await this.errorForResponse(response);
      }

      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new AiError(
          "AI_INVALID_OUTPUT",
          "The provider response envelope or usage was invalid.",
        );
      const payload = parsed.data;

      const text = (payload.content ?? [])
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      const tools = payload.content.filter((block) => block.type === "tool_use");
      if (
        request.structuredOutput &&
        tools.some((block) => block.name !== request.structuredOutput?.toolName)
      )
        throw new AiError("AI_INVALID_OUTPUT", "The provider returned an unexpected tool result.");
      if (tools.length > 1)
        throw new AiError(
          "AI_INVALID_OUTPUT",
          "The provider returned multiple structured results.",
        );
      const toolUse = (payload.content ?? []).find(
        (block): block is { type: "tool_use"; id: string; name: string; input: unknown } =>
          block.type === "tool_use",
      );

      return {
        providerRequestId: payload.id ?? response.headers.get("request-id") ?? undefined,
        text,
        structured: toolUse?.input ?? null,
        usage: {
          inputTokens: payload.usage?.input_tokens ?? 0,
          outputTokens: payload.usage?.output_tokens ?? 0,
        },
        stopReason: payload.stop_reason ?? null,
      };
    } catch (error) {
      if (error instanceof AiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AiError("AI_TIMEOUT", undefined, true);
      }

      throw new AiError("AI_PROVIDER_ERROR", undefined, true);
    } finally {
      clearTimeout(timer);
    }
  }

  private async errorForResponse(response: Response): Promise<AiError> {
    let detail = "";

    try {
      const payload = (await response.json()) as AnthropicResponse;
      detail = payload.error?.message ?? "";
    } catch {
      detail = "";
    }

    if (response.status === 429 || response.status === 529) {
      return new AiError("AI_RATE_LIMITED", undefined, true);
    }

    if (response.status === 400 && /prompt is too long|context length/i.test(detail)) {
      return new AiError("AI_CONTEXT_TOO_LARGE");
    }

    if (response.status === 401 || response.status === 403) {
      return new AiError("AI_PROVIDER_ERROR", "The provider rejected the server credential.");
    }

    if (response.status >= 500) {
      return new AiError("AI_PROVIDER_ERROR", undefined, true);
    }

    return new AiError("AI_PROVIDER_ERROR");
  }
}
