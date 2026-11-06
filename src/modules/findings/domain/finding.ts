import { z } from "zod";

import { assetTypeSchema, type AssetType } from "@/modules/research/domain/target";
import { optionalText } from "@/modules/research/domain/fields";

import { FINDING_STATUSES, type FindingStatus } from "./finding-status";

export const SEVERITIES = [
  "UNASSESSED",
  "INFORMATIONAL",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export type Severity = (typeof SEVERITIES)[number];

export const severitySchema = z.enum(SEVERITIES);

export const SEVERITY_LABELS: Record<Severity, string> = {
  UNASSESSED: "Unassessed",
  INFORMATIONAL: "Informational",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const RESOLUTION_REASONS = [
  "DUPLICATE",
  "OUT_OF_SCOPE",
  "INSUFFICIENT_EVIDENCE",
  "OTHER",
] as const;

export type ResolutionReason = (typeof RESOLUTION_REASONS)[number];

export const resolutionReasonSchema = z.enum(RESOLUTION_REASONS);

export const RESOLUTION_REASON_LABELS: Record<ResolutionReason, string> = {
  DUPLICATE: "Duplicate",
  OUT_OF_SCOPE: "Out of scope",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
  OTHER: "Other",
};

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  DRAFT: "Draft",
  NEEDS_VALIDATION: "Needs validation",
  UNDER_REVIEW: "Under review",
  CONFIRMED: "Confirmed",
  FALSE_POSITIVE: "False positive",
  REJECTED: "Rejected",
  REPORTABLE: "Reportable",
  CLOSED: "Closed",
};

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

export const findingInputSchema = z.object({
  title: z.string().trim().min(2, "Use at least 2 characters.").max(150),
  description: z.string().trim().min(1, "Describe the finding.").max(6000),
  vulnerabilityCategory: optionalText(80),
  hypothesisId: optionalUuid,
  affectedAsset: optionalText(300),
  affectedAssetType: assetTypeSchema.optional(),
  impact: optionalText(4000),
  remediation: optionalText(4000),
});

export type FindingInput = z.infer<typeof findingInputSchema>;

export const findingUpdateSchema = findingInputSchema;

export type FindingUpdateInput = z.infer<typeof findingUpdateSchema>;

export const severityAssessmentSchema = z
  .object({
    severity: severitySchema,
    severityRationale: optionalText(2000),
    affectedAsset: optionalText(300),
    affectedAssetType: assetTypeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.severity !== "UNASSESSED" && !value.severityRationale) {
      ctx.addIssue({
        code: "custom",
        path: ["severityRationale"],
        message: "Explain the severity assessment.",
      });
    }
  });

export type SeverityAssessmentInput = z.infer<typeof severityAssessmentSchema>;

export const findingStatusChangeSchema = z.object({
  status: z.enum(FINDING_STATUSES),
  resolutionReason: resolutionReasonSchema.optional(),
});

export type FindingStatusChangeInput = z.infer<typeof findingStatusChangeSchema>;

export const duplicateConfirmationSchema = z.object({
  canonicalFindingId: z.string().uuid(),
});

export type DuplicateConfirmationInput = z.infer<typeof duplicateConfirmationSchema>;

const reviewListSchema = z.array(z.string().trim().min(1).max(500)).max(30).optional();

export const findingVerificationReviewSchema = z.object({
  conclusion: z.enum([
    "NEEDS_MORE_EVIDENCE",
    "NOT_REPRODUCIBLE",
    "FALSE_POSITIVE",
    "CONFIRMED",
    "REJECTED",
  ]),
  supportingEvidence: reviewListSchema,
  contradictingEvidence: reviewListSchema,
  missingEvidence: reviewListSchema,
  impactAssessment: optionalText(2000),
  reasoningSummary: optionalText(4000),
  resolutionReason: resolutionReasonSchema.optional(),
});

export type FindingVerificationReviewInput = z.infer<typeof findingVerificationReviewSchema>;

/**
 * ADR-015: deterministic, index-friendly normalization. The database stores
 * this value; the application never compares raw titles.
 */
export function normalizeFindingTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export type FindingReadiness = {
  severity: Severity;
  severityRationale: string | null;
  affectedAsset: string | null;
  affectedAssetType: AssetType | null;
  impact: string | null;
  remediation: string | null;
  supportsEvidenceCount: number;
};

/** ADR-016 confirmation preconditions. */
export function confirmationReadiness(finding: FindingReadiness): string[] {
  const problems: string[] = [];

  if (finding.severity === "UNASSESSED") {
    problems.push("Assess severity before confirmation.");
  }

  if (!finding.severityRationale?.trim()) {
    problems.push("Record a severity rationale before confirmation.");
  }

  if (!finding.affectedAsset?.trim()) {
    problems.push("Record the affected asset before confirmation.");
  }

  if (!finding.affectedAssetType) {
    problems.push("Record the affected asset type before confirmation.");
  }

  if (finding.supportsEvidenceCount < 1) {
    problems.push("Link at least one supporting piece of evidence before confirmation.");
  }

  return problems;
}

/** ADR-016 reportability adds impact and remediation. */
export function reportabilityReadiness(finding: FindingReadiness): string[] {
  const problems = confirmationReadiness(finding);

  if (!finding.impact?.trim()) {
    problems.push("Record the impact before a finding becomes reportable.");
  }

  if (!finding.remediation?.trim()) {
    problems.push("Record remediation guidance before a finding becomes reportable.");
  }

  return problems;
}

export function isHumanReviewStatus(status: FindingStatus): boolean {
  return status === "CONFIRMED" || status === "FALSE_POSITIVE" || status === "REJECTED";
}
