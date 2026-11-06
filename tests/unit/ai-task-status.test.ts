import { describe, expect, it } from "vitest";

import {
  AI_TASK_EVENT_TYPES,
  AI_TASK_STATUSES,
  canTransitionAiTask,
  isTerminalAiTaskStatus,
  requiresHumanApproval,
  transitionAiTask,
} from "@/modules/ai/domain/ai-task-status";

describe("AI task lifecycle", () => {
  it("lets the system start a pending task", () => {
    expect(transitionAiTask("PENDING", "RUNNING", "SYSTEM")).toEqual({
      ok: true,
      value: "RUNNING",
    });
  });

  it("does not let a user start a task directly", () => {
    expect(canTransitionAiTask("PENDING", "RUNNING", "USER")).toBe(false);
  });

  it("requires a human to complete a task awaiting approval", () => {
    expect(canTransitionAiTask("RUNNING", "AWAITING_APPROVAL", "SYSTEM")).toBe(true);
    expect(canTransitionAiTask("AWAITING_APPROVAL", "COMPLETED", "USER")).toBe(true);
    expect(canTransitionAiTask("AWAITING_APPROVAL", "COMPLETED", "SYSTEM")).toBe(false);
  });

  it("allows timeout and cancellation while running", () => {
    expect(canTransitionAiTask("RUNNING", "TIMED_OUT", "SYSTEM")).toBe(true);
    expect(canTransitionAiTask("RUNNING", "CANCELLED", "USER")).toBe(true);
    expect(canTransitionAiTask("RUNNING", "CANCELLED", "SYSTEM")).toBe(true);
  });

  it("never revives a terminal task", () => {
    for (const status of AI_TASK_STATUSES) {
      expect(canTransitionAiTask("COMPLETED", status, "SYSTEM")).toBe(false);
      expect(canTransitionAiTask("FAILED", status, "SYSTEM")).toBe(false);
      expect(canTransitionAiTask("CANCELLED", status, "USER")).toBe(false);
      expect(canTransitionAiTask("TIMED_OUT", status, "SYSTEM")).toBe(false);
    }
  });

  it("reports terminal states and approval requirements", () => {
    expect(isTerminalAiTaskStatus("COMPLETED")).toBe(true);
    expect(isTerminalAiTaskStatus("AWAITING_APPROVAL")).toBe(false);
    expect(requiresHumanApproval("AWAITING_APPROVAL")).toBe(true);
    expect(requiresHumanApproval("RUNNING")).toBe(false);
  });

  it("records lifecycle stages as events, not statuses", () => {
    for (const stage of [
      "PERMISSION_CHECK",
      "CONTEXT_ASSEMBLY",
      "OUTPUT_VALIDATION",
      "RESULT_STORAGE",
      "HUMAN_REVIEW",
    ]) {
      expect(AI_TASK_EVENT_TYPES).toContain(stage);
      expect(AI_TASK_STATUSES as readonly string[]).not.toContain(stage);
    }
  });
});
