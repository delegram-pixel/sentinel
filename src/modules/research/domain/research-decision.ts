import { z } from "zod";

export const RESEARCH_PHASES = [
  "CONTEXT_GATHERING",
  "ANALYSIS",
  "HYPOTHESIS_DEVELOPMENT",
  "EVIDENCE_REVIEW",
  "HUMAN_REVIEW",
  "REPORTING",
  "CLOSED",
] as const;
export const DECISION_KINDS = [
  "RESEARCH_NOTE",
  "MORE_RESEARCH",
  "REJECT_HYPOTHESIS",
  "ADOPT_AI_RESULT",
  "CLOSE_INVESTIGATION",
  "CLOSE_FINDING",
] as const;
const optionalId = z.preprocess((value) => (value === "" ? undefined : value), z.uuid().optional());
export const sourceRefSchema = z.object({
  kind: z.enum(["OBSERVATION", "HYPOTHESIS", "EVIDENCE", "FINDING", "KNOWLEDGE"]),
  id: z.uuid(),
  relationship: z.enum(["SUPPORTS", "CONTRADICTS", "CONTEXT"]),
});
export const decisionInputSchema = z
  .object({
    investigationId: z.uuid(),
    kind: z.enum(DECISION_KINDS),
    rationale: z.string().trim().min(3).max(6000),
    findingId: optionalId,
    hypothesisId: optionalId,
    sourceTaskId: optionalId,
    sourceRefs: z.array(sourceRefSchema).max(50).default([]),
  })
  .refine((v) => v.kind !== "REJECT_HYPOTHESIS" || !!v.hypothesisId, {
    message: "Select the hypothesis being rejected.",
  })
  .refine((v) => v.kind !== "ADOPT_AI_RESULT" || !!v.sourceTaskId, {
    message: "An AI decision must reference its source task.",
  });
export const researchPhaseSchema = z.object({
  investigationId: z.uuid(),
  expectedPhase: z.enum(RESEARCH_PHASES),
  phase: z.enum(RESEARCH_PHASES).exclude(["CLOSED"]),
});
export const investigationRelationSchema = z
  .object({
    fromId: z.uuid(),
    toId: z.uuid(),
    relationship: z.enum(["RELATED", "CONTINUES", "CONTRADICTS", "DUPLICATE_CANDIDATE"]),
    rationale: z.string().trim().min(3).max(2000),
  })
  .refine((v) => v.fromId !== v.toId, "An investigation cannot relate to itself.");
export type DecisionInput = z.infer<typeof decisionInputSchema>;
export type ResearchPhaseInput = z.infer<typeof researchPhaseSchema>;
export type InvestigationRelationInput = z.infer<typeof investigationRelationSchema>;
