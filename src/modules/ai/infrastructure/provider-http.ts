import "server-only";
import { AiError } from "../domain/ai-errors";

/** Never propagate provider bodies or headers into logs or user-facing errors. */
export function providerHttpError(response: Response): AiError {
  const value = response.headers.get("retry-after");
  const delay = value
    ? Number.isFinite(Number(value))
      ? Number(value) * 1000
      : Math.max(1000, Date.parse(value) - Date.now())
    : 61000;
  if (response.status === 429 || response.status === 529)
    return new AiError(
      "AI_RATE_LIMITED",
      undefined,
      true,
      Number.isFinite(delay) ? Math.max(1000, delay) : 61000,
      "REJECTED",
    );
  if ([401, 403].includes(response.status)) return new AiError("AI_NOT_CONFIGURED");
  if (response.status === 402) return new AiError("AI_COST_LIMIT");
  if (response.status === 413) return new AiError("AI_CONTEXT_TOO_LARGE");
  return new AiError(
    "AI_PROVIDER_ERROR",
    undefined,
    response.status >= 500,
    undefined,
    response.status >= 500 ? "UNCERTAIN" : "REJECTED",
  );
}
export async function providerFetch(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number,
  keyHeader = "authorization",
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        [keyHeader]: keyHeader === "authorization" ? `Bearer ${apiKey}` : apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw providerHttpError(response);
    try {
      return await response.json();
    } catch {
      throw new AiError("AI_INVALID_OUTPUT");
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError(
      error instanceof Error && error.name === "AbortError" ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR",
      undefined,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
export function parseStructured(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
