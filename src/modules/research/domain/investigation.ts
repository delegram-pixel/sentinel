import { z } from "zod";

import {
  HYPOTHESIS_STATUSES,
  hypothesisStatusSchema,
  type HypothesisStatus,
} from "@/modules/hypotheses/domain/hypothesis-status";

import { optionalText } from "./fields";

export { HYPOTHESIS_STATUSES, hypothesisStatusSchema };
export type { HypothesisStatus };

export const INVESTIGATION_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "UNDER_REVIEW",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export const investigationStatusSchema = z.enum(INVESTIGATION_STATUSES);

export const INVESTIGATION_STATUS_LABELS: Record<InvestigationStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  UNDER_REVIEW: "Under review",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const investigationTransitions: Record<InvestigationStatus, readonly InvestigationStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  UNDER_REVIEW: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionInvestigation(
  from: InvestigationStatus,
  to: InvestigationStatus,
): boolean {
  return investigationTransitions[from].includes(to);
}

export function canEditInvestigation(status: InvestigationStatus): boolean {
  return status !== "ARCHIVED";
}

export const investigationInputSchema = z.object({
  targetId: z.string().trim().min(1, "Choose a target."),
  title: z.string().trim().min(2, "Use at least 2 characters.").max(150),
  description: optionalText(4000),
  objective: optionalText(4000),
  category: optionalText(80),
});

export type InvestigationInput = z.infer<typeof investigationInputSchema>;

export const investigationUpdateSchema = investigationInputSchema.omit({ targetId: true });

export type InvestigationUpdateInput = z.infer<typeof investigationUpdateSchema>;

export const OBSERVATION_TYPES = [
  "APPLICATION_BEHAVIOUR",
  "ROUTE_INFORMATION",
  "HTTP_METADATA",
  "USER_NOTE",
  "AI_OBSERVATION",
  "OTHER",
] as const;

export type ObservationType = (typeof OBSERVATION_TYPES)[number];

export const OBSERVATION_TYPE_LABELS: Record<ObservationType, string> = {
  APPLICATION_BEHAVIOUR: "Application behaviour",
  ROUTE_INFORMATION: "Route information",
  HTTP_METADATA: "HTTP metadata",
  USER_NOTE: "User note",
  AI_OBSERVATION: "AI observation",
  OTHER: "Other",
};

export const CONFIDENCE_LABELS = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"] as const;

export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export const CONFIDENCE_LABEL_LABELS: Record<ConfidenceLabel, string> = {
  UNKNOWN: "Unknown",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const observationInputSchema = z.object({
  title: z.string().trim().min(2, "Use at least 2 characters.").max(150),
  description: z.string().trim().min(1, "Describe what you observed.").max(5000),
  observationType: z.enum(OBSERVATION_TYPES),
  source: optionalText(200),
  confidenceLabel: z.enum(CONFIDENCE_LABELS),
});

export type ObservationInput = z.infer<typeof observationInputSchema>;

export const HYPOTHESIS_STATUS_LABELS: Record<HypothesisStatus, string> = {
  IDEA: "Idea",
  OBSERVED: "Observed",
  NEEDS_VALIDATION: "Needs validation",
  CONFIRMED: "Confirmed",
  NOT_REPRODUCIBLE: "Not reproducible",
  REJECTED: "Rejected",
};

export const HYPOTHESIS_OBSERVATION_RELATIONSHIPS = ["SUPPORTS", "CONTRADICTS", "CONTEXT"] as const;

export type HypothesisObservationRelationship =
  (typeof HYPOTHESIS_OBSERVATION_RELATIONSHIPS)[number];

export const HYPOTHESIS_OBSERVATION_RELATIONSHIP_LABELS: Record<
  HypothesisObservationRelationship,
  string
> = {
  SUPPORTS: "Supports",
  CONTRADICTS: "Contradicts",
  CONTEXT: "Context",
};

export const hypothesisObservationLinkSchema = z.object({
  observationId: z.string().trim().min(1),
  relationshipType: z.enum(HYPOTHESIS_OBSERVATION_RELATIONSHIPS),
});

export const hypothesisInputSchema = z.object({
  title: z.string().trim().min(2, "Use at least 2 characters.").max(150),
  description: z.string().trim().min(1, "Describe the suspected issue.").max(5000),
  vulnerabilityCategory: optionalText(80),
  missingInformation: optionalText(2000),
  observationLinks: z.array(hypothesisObservationLinkSchema).max(50).optional(),
});

export type HypothesisInput = z.infer<typeof hypothesisInputSchema>;

export const hypothesisUpdateSchema = hypothesisInputSchema.omit({ observationLinks: true });

export type HypothesisUpdateInput = z.infer<typeof hypothesisUpdateSchema>;

const summaryListSchema = z.array(z.string().trim().min(1).max(500)).max(30).optional();

export const sessionSummaryInputSchema = z.object({
  summary: z.string().trim().min(1, "Summarise the session.").max(6000),
  completedWork: summaryListSchema,
  rejectedHypotheses: summaryListSchema,
  unresolvedQuestions: summaryListSchema,
  nextActions: summaryListSchema,
});

export type SessionSummaryInput = z.infer<typeof sessionSummaryInputSchema>;
