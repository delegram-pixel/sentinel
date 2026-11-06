import { describe, expect, it } from "vitest";

import {
  canTransitionFinding,
  FINDING_STATUSES,
  isHumanConfirmedFindingStatus,
  isTerminalFindingStatus,
  transitionFinding,
} from "@/modules/findings/domain/finding-status";

describe("finding status transitions", () => {
  it("allows a researcher to submit a draft for validation", () => {
    expect(transitionFinding("DRAFT", "NEEDS_VALIDATION", "RESEARCHER")).toEqual({
      ok: true,
      value: "NEEDS_VALIDATION",
    });
  });

  it("rejects skipping straight from draft to confirmation", () => {
    const result = transitionFinding("DRAFT", "CONFIRMED", "REVIEWER");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_FINDING_TRANSITION");
    }
  });

  it("does not let a researcher confirm a finding", () => {
    const result = transitionFinding("UNDER_REVIEW", "CONFIRMED", "RESEARCHER");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN_FINDING_ACTOR");
    }
  });

  it("lets a reviewer confirm a finding under review", () => {
    expect(canTransitionFinding("UNDER_REVIEW", "CONFIRMED", "REVIEWER")).toBe(true);
  });

  it("reserves reportability for a reviewer", () => {
    expect(canTransitionFinding("CONFIRMED", "REPORTABLE", "REVIEWER")).toBe(true);
    expect(canTransitionFinding("CONFIRMED", "REPORTABLE", "RESEARCHER")).toBe(false);
  });

  it("allows closing from every resolved state", () => {
    const resolvable = ["CONFIRMED", "REPORTABLE", "REJECTED", "FALSE_POSITIVE"] as const;

    for (const status of resolvable) {
      expect(canTransitionFinding(status, "CLOSED", "RESEARCHER")).toBe(true);
    }
  });

  it("never moves out of a closed finding", () => {
    for (const next of FINDING_STATUSES) {
      expect(canTransitionFinding("CLOSED", next, "REVIEWER")).toBe(false);
    }
  });

  it("keeps idea and observed out of the finding vocabulary", () => {
    expect(FINDING_STATUSES).not.toContain("IDEA");
    expect(FINDING_STATUSES).not.toContain("OBSERVED");
  });

  it("identifies terminal and human-confirmed states", () => {
    expect(isTerminalFindingStatus("CLOSED")).toBe(true);
    expect(isTerminalFindingStatus("CONFIRMED")).toBe(false);
    expect(isHumanConfirmedFindingStatus("CONFIRMED")).toBe(true);
    expect(isHumanConfirmedFindingStatus("REPORTABLE")).toBe(true);
    expect(isHumanConfirmedFindingStatus("FALSE_POSITIVE")).toBe(false);
  });
});
