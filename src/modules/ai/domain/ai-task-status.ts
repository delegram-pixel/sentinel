import { z } from "zod";

import { failure, type DomainResult } from "@/modules/shared/domain/result";

export const AI_TASK_STATUSES = [
  "PENDING",
  "RUNNING",
  "AWAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
] as const;

export type AiTaskStatus = (typeof AI_TASK_STATUSES)[number];

export const aiTaskStatusSchema = z.enum(AI_TASK_STATUSES);

/**
 * Lifecycle stages from the architecture are recorded as AITaskEvent rows,
 * not as task statuses (ADR-005).
 */
export const AI_TASK_EVENT_TYPES = [
  "TASK_CREATED",
  "PERMISSION_CHECK",
  "CONTEXT_ASSEMBLY",
  "TASK_ASSIGNMENT",
  "AI_PROCESSING",
  "OUTPUT_VALIDATION",
  "RESULT_STORAGE",
  "HUMAN_REVIEW",
  "TASK_COMPLETED",
  "TASK_FAILED",
  "TASK_CANCELLED",
  "TASK_TIMED_OUT",
] as const;

export type AiTaskEventType = (typeof AI_TASK_EVENT_TYPES)[number];

export const aiTaskEventTypeSchema = z.enum(AI_TASK_EVENT_TYPES);

export const AI_TASK_ACTORS = ["SYSTEM", "USER"] as const;

export type AiTaskActor = (typeof AI_TASK_ACTORS)[number];

const AI_TASK_TRANSITIONS: Record<
  AiTaskStatus,
  Partial<Record<AiTaskStatus, readonly AiTaskActor[]>>
> = {
  PENDING: {
    RUNNING: ["SYSTEM"],
    FAILED: ["SYSTEM"],
    CANCELLED: ["USER", "SYSTEM"],
  },
  RUNNING: {
    AWAITING_APPROVAL: ["SYSTEM"],
    COMPLETED: ["SYSTEM"],
    FAILED: ["SYSTEM"],
    CANCELLED: ["USER", "SYSTEM"],
    TIMED_OUT: ["SYSTEM"],
  },
  AWAITING_APPROVAL: {
    COMPLETED: ["USER"],
    FAILED: ["SYSTEM"],
    CANCELLED: ["USER", "SYSTEM"],
  },
  COMPLETED: {},
  FAILED: {},
  CANCELLED: {},
  TIMED_OUT: {},
};

/**
 * Pure transition guard for AI tasks. Retries create a new task rather than
 * reviving a terminal one, preserving execution history.
 */
export function transitionAiTask(
  current: AiTaskStatus,
  next: AiTaskStatus,
  actor: AiTaskActor,
): DomainResult<AiTaskStatus> {
  const allowedActors = AI_TASK_TRANSITIONS[current][next];

  if (!allowedActors) {
    return failure("INVALID_AI_TASK_TRANSITION", `AI task cannot move from ${current} to ${next}.`);
  }

  if (!allowedActors.includes(actor)) {
    return failure(
      "FORBIDDEN_AI_TASK_ACTOR",
      `A ${actor.toLowerCase()} cannot move an AI task from ${current} to ${next}.`,
    );
  }

  return { ok: true, value: next };
}

export function canTransitionAiTask(
  current: AiTaskStatus,
  next: AiTaskStatus,
  actor: AiTaskActor,
): boolean {
  return transitionAiTask(current, next, actor).ok;
}

export function isTerminalAiTaskStatus(status: AiTaskStatus): boolean {
  return Object.keys(AI_TASK_TRANSITIONS[status]).length === 0;
}

export function requiresHumanApproval(status: AiTaskStatus): boolean {
  return status === "AWAITING_APPROVAL";
}
