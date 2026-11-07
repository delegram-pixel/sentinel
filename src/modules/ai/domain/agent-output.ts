import { z } from "zod";
const text = (max = 2000) => z.string().trim().min(1).max(max);
const list = z.array(text()).max(20);
export const agentSourceSchema = z.object({
  kind: z.enum([
    "OBSERVATION",
    "HYPOTHESIS",
    "EVIDENCE",
    "FINDING",
    "DECISION",
    "KNOWLEDGE",
    "HISTORY",
  ]),
  id: z.uuid(),
  relationship: z.enum(["SUPPORTS", "CONTRADICTS", "CONTEXT"]),
});
export const agentClaimSchema = z
  .object({
    id: z.string().regex(/^claim-[a-z0-9-]{1,40}$/),
    statement: text(),
    basis: z.enum(["OBSERVED", "HYPOTHESIS", "RECOMMENDATION", "UNKNOWN"]),
    sources: z.array(agentSourceSchema).max(30),
    confidence: z.enum(["low", "medium", "high"]),
    limitations: list,
  })
  .refine(
    (c) => c.basis !== "OBSERVED" || c.sources.some((s) => s.relationship === "SUPPORTS"),
    "An observed claim requires a supporting source.",
  );
export const patternAnalysisOutputSchema = z
  .object({
    patterns: z
      .array(
        z.object({
          name: text(150),
          relevance: text(),
          relatedObservationIds: z.array(z.uuid()).max(30),
          referenceChunkIds: z.array(z.uuid()).max(20),
          alternativeExplanations: list,
          notEstablished: list,
          evidenceNeeded: list,
        }),
      )
      .max(12),
    claims: z.array(agentClaimSchema).max(30),
    uncertaintyNotes: list,
  })
  .strict();
export const evidenceAnalysisOutputSchema = z
  .object({
    assessments: z
      .array(
        z.object({
          evidenceId: z.uuid(),
          relevance: text(),
          directEvidence: z.boolean(),
          provenanceGaps: list,
          contradictions: list,
          missingMaterial: list,
          redactionConcerns: list,
          confidence: z.enum(["low", "medium", "high"]),
        }),
      )
      .max(20),
    claims: z.array(agentClaimSchema).max(30),
    uncertaintyNotes: list,
  })
  .strict();
export const independentVerificationOutputSchema = z
  .object({
    findings: z
      .array(
        z.object({
          findingId: z.uuid(),
          conclusion: z.enum([
            "NEEDS_MORE_EVIDENCE",
            "NOT_REPRODUCIBLE",
            "FALSE_POSITIVE",
            "REVIEW_SUPPORTS_CONFIRMATION",
          ]),
          reasoning: text(4000),
          alternativeExplanations: list,
          unsupportedImpact: list,
          unsupportedSeverity: list,
          supportingEvidenceIds: z.array(z.uuid()).max(30),
          contradictoryEvidenceIds: z.array(z.uuid()).max(30),
        }),
      )
      .max(10),
    claims: z.array(agentClaimSchema).max(30),
    uncertaintyNotes: list,
  })
  .strict();
export function invalidAgentSources(
  output: unknown,
  known: Partial<Record<z.infer<typeof agentSourceSchema>["kind"], ReadonlySet<string>>>,
) {
  const problems: string[] = [];
  const record = output as Record<string, unknown>;
  const check = (kind: keyof typeof known, id: unknown) => {
    if (typeof id === "string" && !known[kind]?.has(id))
      problems.push(`Unknown ${kind.toLowerCase()} reference: ${id}.`);
  };
  if (Array.isArray(record.claims))
    for (const claim of record.claims as Array<{
      sources: Array<{ kind: keyof typeof known; id: string }>;
    }>)
      for (const source of claim.sources) check(source.kind, source.id);
  if (Array.isArray(record.patterns))
    for (const pattern of record.patterns as Array<{
      relatedObservationIds: string[];
      referenceChunkIds: string[];
    }>) {
      pattern.relatedObservationIds.forEach((id) => check("OBSERVATION", id));
      pattern.referenceChunkIds.forEach((id) => check("KNOWLEDGE", id));
    }
  if (Array.isArray(record.assessments))
    for (const assessment of record.assessments as Array<{ evidenceId: string }>)
      check("EVIDENCE", assessment.evidenceId);
  if (Array.isArray(record.findings))
    for (const finding of record.findings as Array<{
      findingId: string;
      supportingEvidenceIds: string[];
      contradictoryEvidenceIds: string[];
    }>) {
      check("FINDING", finding.findingId);
      [...finding.supportingEvidenceIds, ...finding.contradictoryEvidenceIds].forEach((id) =>
        check("EVIDENCE", id),
      );
    }
  return [...new Set(problems)];
}
