import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
import type { ReportGenerationOutput } from "@/modules/ai/domain/structured-output";
export const aiReportAdoptionSchema = z.object({
  reportId: z.uuid(),
  taskId: z.uuid(),
  expectedRevision: z.coerce.number().int().min(1),
  rationale: z.string().trim().min(10).max(8000),
});
export type AiReportAdoption = z.infer<typeof aiReportAdoptionSchema>;
export interface AiReportStore {
  adopt(actor: ResearchActor, input: AiReportAdoption): Promise<{ id: string }>;
}
export function adoptAiReportDraft(store: AiReportStore, actor: ResearchActor, input: unknown) {
  const p = aiReportAdoptionSchema.safeParse(input);
  return p.success
    ? researchOperation(() => store.adopt(actor, p.data))
    : Promise.resolve(
        failure(
          "VALIDATION_FAILED",
          p.error.issues[0]?.message ?? "Choose a completed report draft.",
        ),
      );
}
export function renderAiReportDraft(output: ReportGenerationOutput): string {
  const section = (title: string, value: string | string[]) =>
    [
      `## ${title}`,
      "",
      ...(Array.isArray(value)
        ? value.length
          ? value.map((v) => `- ${v}`)
          : ["Not recorded."]
        : [value]),
      "",
    ].join("\n");
  return [
    `# ${output.title}`,
    "",
    "> AI-assisted draft adopted by a researcher. Human review and approval are required.",
    "",
    section("Summary", output.summary),
    section("Description", output.description),
    section("Affected asset", output.affectedAsset),
    section("Preconditions", output.preconditions),
    section("Supplied reproduction", output.reproduction),
    section("Expected behaviour", output.expectedBehaviour),
    section("Actual behaviour", output.actualBehaviour),
    section("Demonstrated impact", output.impact),
    section("Remediation", output.remediation),
    section("Evidence references", output.referencedEvidenceIds),
    section("Source findings", output.referencedFindingIds),
    section("Assumptions and limitations", output.assumptions),
    section("Missing information", output.missingInformation),
    section(
      "Claim basis",
      output.claims.map(
        (c) =>
          `${c.id}: ${c.statement} (${c.basis}, ${c.confidence}); sources: ${c.sources.map((s) => `${s.kind} ${s.id} ${s.relationship}`).join(", ")}; limitations: ${c.limitations.join("; ") || "None recorded"}`,
      ),
    ),
  ].join("\n");
}
