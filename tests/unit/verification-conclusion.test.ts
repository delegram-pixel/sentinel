import { describe, expect, it } from "vitest";

import {
  AI_VERIFICATION_CONCLUSIONS,
  assertConclusionMatchesReviewer,
  findingStatusForHumanConclusion,
  HUMAN_VERIFICATION_CONCLUSIONS,
  isAiConclusion,
  isHumanConclusion,
} from "@/modules/verification/domain/verification-conclusion";

describe("verification conclusions", () => {
  it("never lets an AI review record confirmation", () => {
    expect(AI_VERIFICATION_CONCLUSIONS).not.toContain("CONFIRMED");
    expect(isAiConclusion("CONFIRMED")).toBe(false);
    expect(assertConclusionMatchesReviewer("AI", "CONFIRMED")).toBe(false);
  });

  it("lets an AI review recommend confirmation without applying it", () => {
    expect(assertConclusionMatchesReviewer("AI", "REVIEW_SUPPORTS_CONFIRMATION")).toBe(true);
  });

  it("allows a human reviewer to confirm or reject", () => {
    expect(HUMAN_VERIFICATION_CONCLUSIONS).toContain("CONFIRMED");
    expect(HUMAN_VERIFICATION_CONCLUSIONS).toContain("REJECTED");
    expect(assertConclusionMatchesReviewer("HUMAN", "CONFIRMED")).toBe(true);
  });

  it("rejects conclusions from the wrong reviewer vocabulary", () => {
    expect(isHumanConclusion("REVIEW_SUPPORTS_CONFIRMATION")).toBe(false);
    expect(assertConclusionMatchesReviewer("HUMAN", "REVIEW_SUPPORTS_CONFIRMATION")).toBe(false);
  });

  it("maps human conclusions onto finding statuses", () => {
    expect(findingStatusForHumanConclusion("CONFIRMED")).toBe("CONFIRMED");
    expect(findingStatusForHumanConclusion("FALSE_POSITIVE")).toBe("FALSE_POSITIVE");
    expect(findingStatusForHumanConclusion("REJECTED")).toBe("REJECTED");
    expect(findingStatusForHumanConclusion("NOT_REPRODUCIBLE")).toBe("REJECTED");
    expect(findingStatusForHumanConclusion("NEEDS_MORE_EVIDENCE")).toBe("NEEDS_VALIDATION");
  });
});
