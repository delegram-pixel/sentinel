import { z } from "zod";

import type { FindingStatus } from "@/modules/findings/domain/finding-status";

/**
 * AI and human conclusions are deliberately different vocabularies. An AI
 * review can recommend confirmation, but only a human can record CONFIRMED
 * (ADR-005, PRD §4.8).
 */
export const AI_VERIFICATION_CONCLUSIONS = [
  "NEEDS_MORE_EVIDENCE",
  "NOT_REPRODUCIBLE",
  "FALSE_POSITIVE",
  "REVIEW_SUPPORTS_CONFIRMATION",
] as const;

export const HUMAN_VERIFICATION_CONCLUSIONS = [
  "NEEDS_MORE_EVIDENCE",
  "NOT_REPRODUCIBLE",
  "FALSE_POSITIVE",
  "CONFIRMED",
  "REJECTED",
] as const;

export type AiVerificationConclusion = (typeof AI_VERIFICATION_CONCLUSIONS)[number];
export type HumanVerificationConclusion = (typeof HUMAN_VERIFICATION_CONCLUSIONS)[number];
export type VerificationConclusion = AiVerificationConclusion | HumanVerificationConclusion;

export const VERIFICATION_CONCLUSION_LABELS: Record<VerificationConclusion, string> = {
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
  NOT_REPRODUCIBLE: "Not reproducible",
  FALSE_POSITIVE: "False positive",
  REVIEW_SUPPORTS_CONFIRMATION: "Review supports confirmation",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

export const aiVerificationConclusionSchema = z.enum(AI_VERIFICATION_CONCLUSIONS);
export const humanVerificationConclusionSchema = z.enum(HUMAN_VERIFICATION_CONCLUSIONS);

export type VerificationReviewerType = "AI" | "HUMAN";

export function isAiConclusion(value: string): value is AiVerificationConclusion {
  return (AI_VERIFICATION_CONCLUSIONS as readonly string[]).includes(value);
}

export function isHumanConclusion(value: string): value is HumanVerificationConclusion {
  return (HUMAN_VERIFICATION_CONCLUSIONS as readonly string[]).includes(value);
}

/**
 * The mapping a human decision applies to a finding. AI conclusions never
 * change finding status directly.
 */
export function findingStatusForHumanConclusion(
  conclusion: HumanVerificationConclusion,
): FindingStatus {
  switch (conclusion) {
    case "NEEDS_MORE_EVIDENCE":
      return "NEEDS_VALIDATION";
    case "NOT_REPRODUCIBLE":
      return "REJECTED";
    case "FALSE_POSITIVE":
      return "FALSE_POSITIVE";
    case "CONFIRMED":
      return "CONFIRMED";
    case "REJECTED":
      return "REJECTED";
  }
}

/**
 * Guard for any persistence layer that stores a single conclusion column.
 */
export function assertConclusionMatchesReviewer(
  reviewerType: VerificationReviewerType,
  conclusion: string,
): boolean {
  if (reviewerType === "AI") {
    return isAiConclusion(conclusion);
  }

  return isHumanConclusion(conclusion);
}
