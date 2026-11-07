import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
export const evidenceResearchRelationSchema = z.object({
  evidenceId: z.uuid(),
  subjectKind: z.enum(["OBSERVATION", "HYPOTHESIS"]),
  subjectId: z.uuid(),
  relationship: z.enum(["SUPPORTS", "CONTRADICTS", "CONTEXT"]),
  rationale: z.string().trim().min(3).max(2000),
});
export const evidenceProvenanceSchema = z.object({
  evidenceId: z.uuid(),
  collectedAt: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional()),
  collector: z.string().trim().min(2).max(300),
  source: z.string().trim().min(2).max(2000),
});
export const assessmentReviewSchema = z.object({
  assessmentId: z.uuid(),
  status: z.enum(["REVIEWED", "WITHDRAWN"]),
  rationale: z.string().trim().min(3).max(2000),
});
export const evidenceReplacementSchema = z
  .object({
    evidenceId: z.uuid(),
    supersedesId: z.uuid(),
    rationale: z.string().trim().min(10).max(8000),
  })
  .refine((v) => v.evidenceId !== v.supersedesId, "Choose a different evidence item to replace.");
export interface ResearchEvidenceStore {
  replace(
    actor: ResearchActor,
    input: z.infer<typeof evidenceReplacementSchema>,
  ): Promise<{ id: string }>;
  relate(
    actor: ResearchActor,
    input: z.infer<typeof evidenceResearchRelationSchema>,
  ): Promise<{ id: string }>;
  recordProvenance(
    actor: ResearchActor,
    input: z.infer<typeof evidenceProvenanceSchema>,
  ): Promise<{ id: string }>;
  reviewAssessment(
    actor: ResearchActor,
    input: z.infer<typeof assessmentReviewSchema>,
  ): Promise<{ id: string }>;
  listAssessments(
    workspaceId: string,
    evidenceId: string,
  ): Promise<
    Array<{
      id: string;
      sourceTaskId: string | null;
      assessorType: string;
      reviewStatus: string;
      assessment: unknown;
      basis: unknown;
      createdAt: Date;
    }>
  >;
}
function operation<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  run: (input: T) => Promise<{ id: string }>,
) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return Promise.resolve(
      failure(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Check the evidence details.",
      ),
    );
  return researchOperation(() => run(parsed.data));
}
export const relateResearchEvidence = (
  store: ResearchEvidenceStore,
  actor: ResearchActor,
  input: unknown,
) => operation(evidenceResearchRelationSchema, input, (data) => store.relate(actor, data));
export const recordEvidenceProvenance = (
  store: ResearchEvidenceStore,
  actor: ResearchActor,
  input: unknown,
) => operation(evidenceProvenanceSchema, input, (data) => store.recordProvenance(actor, data));
export const reviewEvidenceAssessment = (
  store: ResearchEvidenceStore,
  actor: ResearchActor,
  input: unknown,
) => operation(assessmentReviewSchema, input, (data) => store.reviewAssessment(actor, data));
export const reviewEvidenceReplacement = (
  store: ResearchEvidenceStore,
  actor: ResearchActor,
  input: unknown,
) => operation(evidenceReplacementSchema, input, (data) => store.replace(actor, data));
