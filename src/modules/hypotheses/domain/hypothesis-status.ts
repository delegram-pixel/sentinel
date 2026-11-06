import { z } from "zod";

import { failure, type DomainResult } from "@/modules/shared/domain/result";

export const HYPOTHESIS_STATUSES = [
  "IDEA",
  "OBSERVED",
  "NEEDS_VALIDATION",
  "CONFIRMED",
  "NOT_REPRODUCIBLE",
  "REJECTED",
] as const;

export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export const hypothesisStatusSchema = z.enum(HYPOTHESIS_STATUSES);

export const HYPOTHESIS_ACTORS = ["RESEARCHER", "REVIEWER"] as const;

export type HypothesisActor = (typeof HYPOTHESIS_ACTORS)[number];

const HYPOTHESIS_TRANSITIONS: Record<
  HypothesisStatus,
  Partial<Record<HypothesisStatus, readonly HypothesisActor[]>>
> = {
  IDEA: {
    OBSERVED: ["RESEARCHER"],
  },
  OBSERVED: {
    NEEDS_VALIDATION: ["RESEARCHER"],
  },
  NEEDS_VALIDATION: {
    OBSERVED: ["RESEARCHER"],
    CONFIRMED: ["RESEARCHER", "REVIEWER"],
    NOT_REPRODUCIBLE: ["RESEARCHER", "REVIEWER"],
    REJECTED: ["RESEARCHER", "REVIEWER"],
  },
  CONFIRMED: {},
  NOT_REPRODUCIBLE: {},
  REJECTED: {},
};

/**
 * Hypothesis status is distinct from finding status. "Idea" and "Observed"
 * belong here, never on a finding (ADR-005).
 */
export function transitionHypothesis(
  current: HypothesisStatus,
  next: HypothesisStatus,
  actor: HypothesisActor,
): DomainResult<HypothesisStatus> {
  const allowedActors = HYPOTHESIS_TRANSITIONS[current][next];

  if (!allowedActors) {
    return failure(
      "INVALID_HYPOTHESIS_TRANSITION",
      `Hypothesis cannot move from ${current} to ${next}.`,
    );
  }

  if (!allowedActors.includes(actor)) {
    return failure(
      "FORBIDDEN_HYPOTHESIS_ACTOR",
      `A ${actor.toLowerCase()} cannot move a hypothesis from ${current} to ${next}.`,
    );
  }

  return { ok: true, value: next };
}

export function canTransitionHypothesis(
  current: HypothesisStatus,
  next: HypothesisStatus,
  actor: HypothesisActor,
): boolean {
  return transitionHypothesis(current, next, actor).ok;
}

export function isTerminalHypothesisStatus(status: HypothesisStatus): boolean {
  return Object.keys(HYPOTHESIS_TRANSITIONS[status]).length === 0;
}
