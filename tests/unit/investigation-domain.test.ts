import { describe, expect, it } from "vitest";

import {
  canEditInvestigation,
  canTransitionInvestigation,
  INVESTIGATION_STATUSES,
  type InvestigationStatus,
} from "@/modules/research/domain/investigation";

const expected: Record<InvestigationStatus, InvestigationStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  UNDER_REVIEW: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

describe("investigation domain", () => {
  it("only exposes the canonical status vocabulary", () => {
    expect(INVESTIGATION_STATUSES).toEqual([
      "DRAFT",
      "ACTIVE",
      "PAUSED",
      "UNDER_REVIEW",
      "COMPLETED",
      "ARCHIVED",
    ]);
  });

  it("allows exactly the ADR-024 transitions", () => {
    for (const from of INVESTIGATION_STATUSES) {
      for (const to of INVESTIGATION_STATUSES) {
        expect(canTransitionInvestigation(from, to)).toBe(expected[from].includes(to));
      }
    }
  });

  it("does not let a draft skip directly to completed", () => {
    expect(canTransitionInvestigation("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransitionInvestigation("DRAFT", "PAUSED")).toBe(false);
    expect(canTransitionInvestigation("DRAFT", "UNDER_REVIEW")).toBe(false);
  });

  it("treats archived as terminal", () => {
    for (const to of INVESTIGATION_STATUSES) {
      expect(canTransitionInvestigation("ARCHIVED", to)).toBe(false);
    }
  });

  it("only locks editing for archived investigations", () => {
    expect(canEditInvestigation("DRAFT")).toBe(true);
    expect(canEditInvestigation("COMPLETED")).toBe(true);
    expect(canEditInvestigation("ARCHIVED")).toBe(false);
  });
});
