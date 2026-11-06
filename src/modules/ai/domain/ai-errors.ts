/**
 * Stable AI failure codes. User-facing messages may change, but these codes
 * are persisted on `AITask.failureCode` and must remain stable for tests,
 * reporting, and retry decisions (ADR-025).
 */
export const AI_ERROR_CODES = [
  "AI_NOT_CONFIGURED",
  "AI_PROVIDER_ERROR",
  "AI_RATE_LIMITED",
  "AI_TIMEOUT",
  "AI_BUDGET_EXCEEDED",
  "AI_INVALID_OUTPUT",
  "AI_OUTPUT_VALIDATION_FAILED",
  "AI_REFUSAL",
  "AI_CONTEXT_UNAVAILABLE",
  "AI_CONTEXT_TOO_LARGE",
  "AI_TASK_NOT_FOUND",
  "AI_TASK_NOT_SUPPORTED",
  "AI_CONVERSATION_NOT_FOUND",
  "AI_INVESTIGATION_NOT_FOUND",
  "AI_PERMISSION_DENIED",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: "The AI provider is not configured on this deployment.",
  AI_PROVIDER_ERROR: "The AI provider could not complete the request.",
  AI_RATE_LIMITED: "The AI provider is rate limiting requests. Try again later.",
  AI_TIMEOUT: "The AI request exceeded its time limit.",
  AI_BUDGET_EXCEEDED: "The AI usage budget is exhausted for today.",
  AI_INVALID_OUTPUT: "The AI response was not valid structured output.",
  AI_OUTPUT_VALIDATION_FAILED: "The AI response did not pass validation.",
  AI_REFUSAL: "The AI provider refused to answer this request.",
  AI_CONTEXT_UNAVAILABLE: "The investigation context could not be assembled.",
  AI_CONTEXT_TOO_LARGE: "The investigation context exceeds the task input budget.",
  AI_TASK_NOT_FOUND: "That AI task does not exist in this workspace.",
  AI_TASK_NOT_SUPPORTED: "That AI task is not available in this release.",
  AI_CONVERSATION_NOT_FOUND: "That AI conversation does not exist in this workspace.",
  AI_INVESTIGATION_NOT_FOUND: "That investigation does not exist in this workspace.",
  AI_PERMISSION_DENIED: "The AI task is not permitted for this investigation.",
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message?: string, retryable = false) {
    super(message ?? AI_ERROR_MESSAGES[code]);
    this.name = "AiError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

export function aiErrorFromUnknown(error: unknown): AiError {
  if (isAiError(error)) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new AiError("AI_TIMEOUT", undefined, true);
  }

  return new AiError("AI_PROVIDER_ERROR", undefined, true);
}
