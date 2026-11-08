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
  AI_NOT_CONFIGURED:
    "AI isn't set up here yet. Ask the person managing this deployment to configure the provider.",
  AI_PROVIDER_ERROR:
    "The AI provider couldn't finish this request. Check task history before trying again.",
  AI_RATE_LIMITED:
    "The AI provider is receiving too many requests. Give it a moment, then try again.",
  AI_TIMEOUT:
    "This AI request ran out of time. Check task history for its status before trying again.",
  AI_BUDGET_EXCEEDED:
    "You've reached today's AI usage budget. You can continue recording research and return to AI when the budget resets.",
  AI_INVALID_OUTPUT:
    "The AI reply wasn't in the format this task needs. Check task history before trying another request.",
  AI_OUTPUT_VALIDATION_FAILED:
    "The AI reply didn't pass the result checks. Review the task details before using it or trying again.",
  AI_REFUSAL:
    "The AI provider declined this request. Review the question and supplied context before deciding what to ask next.",
  AI_CONTEXT_UNAVAILABLE:
    "We couldn't prepare this investigation's saved context. Reopen the investigation and check its records before trying again.",
  AI_CONTEXT_TOO_LARGE:
    "This investigation has more context than the task's input budget allows. Review the saved material before trying again.",
  AI_TASK_NOT_FOUND:
    "We can't find that AI task in this workspace. Open the investigation's task history to choose an available one.",
  AI_TASK_NOT_SUPPORTED:
    "This AI task isn't available in this version. Choose one of the supported analyses.",
  AI_CONVERSATION_NOT_FOUND:
    "We can't find that conversation in this workspace. Open Research assistance to choose an available conversation.",
  AI_INVESTIGATION_NOT_FOUND:
    "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
  AI_PERMISSION_DENIED:
    "This investigation doesn't permit the requested AI task. Check its project, target, and permission details before continuing.",
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
