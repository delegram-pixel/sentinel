import { z } from "zod";

import { failure, type DomainResult } from "@/modules/shared/domain/result";

export const FINDING_STATUSES = [
  "DRAFT",
  "NEEDS_VALIDATION",
  "UNDER_REVIEW",
  "CONFIRMED",
  "FALSE_POSITIVE",
  "REJECTED",
  "REPORTABLE",
  "CLOSED",
] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const findingStatusSchema = z.enum(FINDING_STATUSES);

export const FINDING_ACTORS = ["RESEARCHER", "REVIEWER"] as const;

export type FindingActor = (typeof FINDING_ACTORS)[number];

const FINDING_TRANSITIONS: Record<
  FindingStatus,
  Partial<Record<FindingStatus, readonly FindingActor[]>>
> = {
  DRAFT: {
    NEEDS_VALIDATION: ["RESEARCHER"],
  },
  NEEDS_VALIDATION: {
    UNDER_REVIEW: ["RESEARCHER"],
  },
  UNDER_REVIEW: {
    NEEDS_VALIDATION: ["RESEARCHER", "REVIEWER"],
    CONFIRMED: ["REVIEWER"],
    REJECTED: ["REVIEWER"],
    FALSE_POSITIVE: ["REVIEWER"],
  },
  CONFIRMED: {
    REPORTABLE: ["REVIEWER"],
    CLOSED: ["REVIEWER"],
  },
  REPORTABLE: {
    CLOSED: ["REVIEWER"],
  },
  REJECTED: {
    CLOSED: ["REVIEWER"],
  },
  FALSE_POSITIVE: {
    CLOSED: ["REVIEWER"],
  },
  CLOSED: {},
};

/**
 * Pure transition guard for ADR-005. The database and UI must call this rather
 * than duplicating status rules.
 */
export function transitionFinding(
  current: FindingStatus,
  next: FindingStatus,
  actor: FindingActor,
): DomainResult<FindingStatus> {
  const allowedActors = FINDING_TRANSITIONS[current][next];

  if (!allowedActors) {
    return failure("INVALID_FINDING_TRANSITION", `Finding cannot move from ${current} to ${next}.`);
  }

  if (!allowedActors.includes(actor)) {
    return failure(
      "FORBIDDEN_FINDING_ACTOR",
      `A ${actor.toLowerCase()} cannot move a finding from ${current} to ${next}.`,
    );
  }

  return { ok: true, value: next };
}

export function canTransitionFinding(
  current: FindingStatus,
  next: FindingStatus,
  actor: FindingActor,
): boolean {
  return transitionFinding(current, next, actor).ok;
}

export function isTerminalFindingStatus(status: FindingStatus): boolean {
  return Object.keys(FINDING_TRANSITIONS[status]).length === 0;
}

/**
 * Only a human reviewer may establish these states. AI-authored records must
 * never carry them (ADR-005).
 */
export function isHumanConfirmedFindingStatus(status: FindingStatus): boolean {
  return status === "CONFIRMED" || status === "REPORTABLE";
}
