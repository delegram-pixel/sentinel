import { z } from "zod";
import { agentClaimSchema, agentSourceSchema } from "./agent-output";
const text = z.string().trim().min(1).max(4000);
export const conclusionSchema = z
  .object({
    subject: agentSourceSchema.pick({ kind: true, id: true }),
    conclusion: z.enum(["SUPPORTED", "UNSUPPORTED", "INCONCLUSIVE"]),
    reasoning: text,
    sources: z.array(agentSourceSchema).max(30),
  })
  .strict();
export const analysisEnvelopeSchema = (analysis: z.ZodType) =>
  z
    .object({
      version: z.literal(1),
      analysis,
      claims: z.array(agentClaimSchema).min(1).max(30),
      conclusions: z.array(conclusionSchema).max(30),
    })
    .strict();
export const conclusionReviewSchema = z
  .object({
    reviews: z
      .array(
        z
          .object({
            taskId: z.uuid(),
            claimId: z.string(),
            verdict: z.enum(["SUPPORTED", "UNSUPPORTED", "CONTRADICTED", "INSUFFICIENT"]),
            reasoning: text,
            sources: z.array(agentSourceSchema).max(30),
          })
          .strict(),
      )
      .max(60),
    conclusions: z.array(conclusionSchema).max(30),
    missingInformation: z.array(text).max(20),
  })
  .strict();
export const analysisEvaluationSchema = z.object({
  version: z.literal(1),
  claims: z.array(agentClaimSchema).min(1).max(30),
  conclusions: z.array(conclusionSchema).max(30),
});
export type AnalysisEvaluation = z.infer<typeof analysisEvaluationSchema>;
export type ConclusionReview = z.infer<typeof conclusionReviewSchema>;
export function consolidateCollaboration(
  analyses: Array<{
    taskId: string;
    provider: string;
    model: string;
    evaluation: AnalysisEvaluation;
  }>,
  review: { taskId: string; output: ConclusionReview } | null,
  failures: Array<{ stage: string; code: string }>,
) {
  const grouped = new Map<
    string,
    Array<{ taskId: string; conclusion: z.infer<typeof conclusionSchema> }>
  >();
  for (const analysis of analyses)
    for (const conclusion of analysis.evaluation.conclusions) {
      const key = `${conclusion.subject.kind}:${conclusion.subject.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), { taskId: analysis.taskId, conclusion }]);
    }
  for (const conclusion of review?.output.conclusions ?? []) {
    const key = `${conclusion.subject.kind}:${conclusion.subject.id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), { taskId: review!.taskId, conclusion }]);
  }
  const conflicts = [...grouped]
    .filter(([, values]) => new Set(values.map((v) => v.conclusion.conclusion)).size > 1)
    .map(([subject, positions]) => ({ subject, positions }));
  return {
    version: 1,
    status: failures.length || !review || analyses.length < 2 ? "INCOMPLETE" : "COMPLETE",
    analyses,
    review,
    conflicts,
    failures,
    requiresHumanReview: true,
  };
}
export function invalidReviewClaims(
  review: ConclusionReview,
  known: Record<string, readonly string[]>,
): string[] {
  const problems: string[] = [];
  const reviewed = new Set<string>();
  for (const item of review.reviews) {
    const key = `${item.taskId}:${item.claimId}`;
    if (!known[item.taskId]?.includes(item.claimId))
      problems.push("Review references an unknown stage claim.");
    if (reviewed.has(key)) problems.push("Review repeats a stage claim.");
    reviewed.add(key);
  }
  for (const [task, claims] of Object.entries(known))
    for (const claim of claims)
      if (!reviewed.has(`${task}:${claim}`))
        problems.push("Review omitted a supplied stage claim.");
  return [...new Set(problems)];
}
