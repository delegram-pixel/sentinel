import { z } from "zod";

import type { AiTaskType } from "./ai-config";
import {
  agentClaimSchema,
  evidenceAnalysisOutputSchema,
  independentVerificationOutputSchema,
  patternAnalysisOutputSchema,
} from "./agent-output";

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const textList = (maxItems: number, maxLength = 500) =>
  z.array(boundedText(maxLength)).max(maxItems);

const evidenceIds = z.array(z.string().uuid()).max(50);

export const conversationOutputSchema = z.object({
  referencedEvidenceIds: evidenceIds.default([]),
  message: boundedText(8_000),
  suggestedNextSteps: textList(8),
  referencedObservationIds: evidenceIds,
  referencedHypothesisIds: evidenceIds,
  warnings: textList(8),
});

export const reconAnalysisOutputSchema = z.object({
  relevantHistoryIds: evidenceIds.default([]),
  referencedKnowledgeIds: evidenceIds.default([]),
  contextConfidence: z.enum(["low", "medium", "high"]).default("low"),
  missingContext: textList(20).default([]),
  referencedEvidenceIds: evidenceIds.default([]),
  summary: boundedText(4_000),
  knownInformation: textList(30),
  unknownInformation: textList(30),
  observations: z
    .array(
      z.object({
        title: boundedText(150),
        description: boundedText(2_000),
        source: z.string().trim().max(200).optional(),
        confidence: z.enum(["low", "medium", "high"]),
        requiresReview: z.literal(true),
      }),
    )
    .max(20),
  recommendedActions: textList(15),
  referencedObservationIds: evidenceIds,
  referencedHypothesisIds: evidenceIds,
  uncertaintyNotes: textList(15),
});

export const hypothesisGenerationOutputSchema = z.object({
  hypotheses: z
    .array(
      z.object({
        title: boundedText(150),
        description: boundedText(2_000),
        vulnerabilityCategory: z.string().trim().max(80),
        rationale: boundedText(1_500),
        missingInformation: boundedText(1_500),
        supportingObservationIds: evidenceIds,
        confidence: z.enum(["low", "medium", "high"]),
        assumptions: textList(10).default([]),
        expectedBehaviour: z.string().max(2000).default("Not established"),
        observedBehaviour: z.string().max(2000).default("Not established"),
        alternativeExplanations: textList(10).default([]),
        evidenceRequirements: textList(10).default([]),
      }),
    )
    .max(12),
  duplicateRiskNotes: textList(12),
  nextActions: textList(12),
});

export const sessionSummaryOutputSchema = z.object({
  summary: boundedText(4_000),
  completedWork: textList(20),
  rejectedHypotheses: textList(20),
  unresolvedQuestions: textList(20),
  nextActions: textList(20),
});

export const verificationReviewOutputSchema = z.object({
  referencedEvidenceIds: evidenceIds.default([]),
  conclusion: z.enum([
    "NEEDS_MORE_EVIDENCE",
    "NOT_REPRODUCIBLE",
    "FALSE_POSITIVE",
    "REVIEW_SUPPORTS_CONFIRMATION",
  ]),
  reviewSummary: boundedText(4_000),
  supportingEvidence: textList(20),
  contradictoryEvidence: textList(20),
  missingEvidence: textList(20),
  impactAssessment: boundedText(2_000),
  referencedObservationIds: evidenceIds,
  referencedHypothesisIds: evidenceIds,
});

export const findingSummaryOutputSchema = z.object({
  title: boundedText(150),
  summary: boundedText(3_000),
  impact: boundedText(2_000),
  remediation: boundedText(2_000),
  missingSections: textList(20),
});

export const reportGenerationOutputSchema = z
  .object({
    referencedFindingIds: z.array(z.uuid()).min(1).max(10),
    referencedEvidenceIds: z.array(z.uuid()).max(50),
    claims: z.array(agentClaimSchema).min(1).max(30),
    assumptions: textList(20),
    missingInformation: textList(20),
    title: boundedText(200),
    summary: boundedText(4_000),
    description: boundedText(8_000),
    affectedAsset: boundedText(300),
    preconditions: textList(20),
    reproduction: textList(30),
    expectedBehaviour: boundedText(2_000),
    actualBehaviour: boundedText(2_000),
    impact: boundedText(4_000),
    remediation: boundedText(4_000),
    evidenceReferences: textList(30),
  })
  .strict();

export type ConversationOutput = z.infer<typeof conversationOutputSchema>;
export type ReconAnalysisOutput = z.infer<typeof reconAnalysisOutputSchema>;
export type HypothesisGenerationOutput = z.infer<typeof hypothesisGenerationOutputSchema>;
export type SessionSummaryOutput = z.infer<typeof sessionSummaryOutputSchema>;
export type VerificationReviewOutput = z.infer<typeof verificationReviewOutputSchema>;
export type FindingSummaryOutput = z.infer<typeof findingSummaryOutputSchema>;
export type ReportGenerationOutput = z.infer<typeof reportGenerationOutputSchema>;

export const AI_OUTPUT_KINDS = [
  "conversation",
  "recon_analysis",
  "hypothesis_generation",
  "session_summary",
  "verification_review",
  "finding_summary",
  "report_generation",
] as const;

export type AiOutputKind = (typeof AI_OUTPUT_KINDS)[number];

export const AI_OUTPUT_SCHEMAS: Record<AiOutputKind, z.ZodType> = {
  conversation: conversationOutputSchema,
  recon_analysis: reconAnalysisOutputSchema,
  hypothesis_generation: hypothesisGenerationOutputSchema,
  session_summary: sessionSummaryOutputSchema,
  verification_review: verificationReviewOutputSchema,
  finding_summary: findingSummaryOutputSchema,
  report_generation: reportGenerationOutputSchema,
};

const TASK_OUTPUT_KIND: Partial<Record<AiTaskType, AiOutputKind>> = {
  ATTACK_SURFACE_ANALYSIS: "conversation",
  RECON_ANALYSIS: "recon_analysis",
  HYPOTHESIS_GENERATION: "hypothesis_generation",
  SESSION_SUMMARY: "session_summary",
  EVIDENCE_REVIEW: "verification_review",
  FALSE_POSITIVE_REVIEW: "verification_review",
  FINDING_SUMMARY: "finding_summary",
  REPORT_GENERATION: "report_generation",
};

export function outputKindForTask(taskType: AiTaskType): AiOutputKind | null {
  return TASK_OUTPUT_KIND[taskType] ?? null;
}

export function outputSchemaForTask(taskType: AiTaskType): z.ZodType | null {
  if (taskType === "PATTERN_ANALYSIS") return patternAnalysisOutputSchema;
  if (taskType === "EVIDENCE_REVIEW") return evidenceAnalysisOutputSchema;
  if (taskType === "FALSE_POSITIVE_REVIEW") return independentVerificationOutputSchema;
  const kind = outputKindForTask(taskType);

  return kind ? AI_OUTPUT_SCHEMAS[kind] : null;
}

/**
 * The model may only cite records that were actually supplied in the context
 * (AI-ARCHITECTURE §10). Unknown identifiers fail validation.
 */
export function invalidEvidenceReferences(
  output: unknown,
  knownObservationIds: ReadonlySet<string>,
  knownHypothesisIds: ReadonlySet<string>,
  knownEvidenceIds: ReadonlySet<string> = new Set(),
): string[] {
  const problems: string[] = [];
  const record = output as Record<string, unknown>;

  const observationLists: unknown[] = [
    record.referencedObservationIds,
    ...(Array.isArray(record.hypotheses)
      ? (record.hypotheses as Array<Record<string, unknown>>).map(
          (hypothesis) => hypothesis.supportingObservationIds,
        )
      : []),
  ];

  for (const list of observationLists) {
    if (!Array.isArray(list)) {
      continue;
    }

    for (const value of list) {
      if (typeof value === "string" && !knownObservationIds.has(value)) {
        problems.push(`Unknown observation reference: ${value}.`);
      }
    }
  }

  if (Array.isArray(record.referencedHypothesisIds)) {
    for (const value of record.referencedHypothesisIds) {
      if (typeof value === "string" && !knownHypothesisIds.has(value)) {
        problems.push(`Unknown hypothesis reference: ${value}.`);
      }
    }
  }

  if (Array.isArray(record.referencedEvidenceIds)) {
    for (const value of record.referencedEvidenceIds)
      if (typeof value === "string" && !knownEvidenceIds.has(value))
        problems.push(`Unknown evidence reference: ${value}.`);
  }

  return problems;
}
