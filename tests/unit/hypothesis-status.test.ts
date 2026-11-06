import { describe, expect, it } from "vitest";

import {
  canTransitionHypothesis,
  HYPOTHESIS_STATUSES,
  isTerminalHypothesisStatus,
  transitionHypothesis,
} from "@/modules/hypotheses/domain/hypothesis-status";

describe("hypothesis status transitions", () => {
  it("starts an idea by recording an observation", () => {
    expect(transitionHypothesis("IDEA", "OBSERVED", "RESEARCHER")).toEqual({
      ok: true,
      value: "OBSERVED",
    });
  });

  it("does not allow an idea to skip observation", () => {
    expect(canTransitionHypothesis("IDEA", "NEEDS_VALIDATION", "RESEARCHER")).toBe(false);
  });

  it("allows returning to observation while validating", () => {
    expect(canTransitionHypothesis("NEEDS_VALIDATION", "OBSERVED", "RESEARCHER")).toBe(true);
  });

  it("allows either a researcher or reviewer to resolve validation", () => {
    for (const actor of ["RESEARCHER", "REVIEWER"] as const) {
      expect(canTransitionHypothesis("NEEDS_VALIDATION", "CONFIRMED", actor)).toBe(true);
      expect(canTransitionHypothesis("NEEDS_VALIDATION", "NOT_REPRODUCIBLE", actor)).toBe(true);
      expect(canTransitionHypothesis("NEEDS_VALIDATION", "REJECTED", actor)).toBe(true);
    }
  });

  it("does not confirm an unvalidated observation", () => {
    expect(canTransitionHypothesis("OBSERVED", "CONFIRMED", "REVIEWER")).toBe(false);
  });

  it("treats resolved hypotheses as terminal", () => {
    expect(isTerminalHypothesisStatus("CONFIRMED")).toBe(true);
    expect(isTerminalHypothesisStatus("NOT_REPRODUCIBLE")).toBe(true);
    expect(isTerminalHypothesisStatus("REJECTED")).toBe(true);
    expect(isTerminalHypothesisStatus("NEEDS_VALIDATION")).toBe(false);
  });

  it("only exposes the hypothesis vocabulary", () => {
    expect(HYPOTHESIS_STATUSES).toEqual([
      "IDEA",
      "OBSERVED",
      "NEEDS_VALIDATION",
      "CONFIRMED",
      "NOT_REPRODUCIBLE",
      "REJECTED",
    ]);
  });
});
