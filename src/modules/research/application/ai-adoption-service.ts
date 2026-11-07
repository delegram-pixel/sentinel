import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
export const aiAdoptionSchema = z.object({
  taskId: z.uuid(),
  index: z.coerce.number().int().min(0).max(19),
  kind: z.enum(["HYPOTHESIS", "OBSERVATION"]),
  rationale: z.string().trim().min(3).max(2000),
});
export type AiAdoptionInput = z.infer<typeof aiAdoptionSchema>;
export interface AiAdoptionStore {
  adopt(actor: ResearchActor, input: AiAdoptionInput): Promise<{ id: string }>;
}
export async function adoptAiSuggestion(
  store: AiAdoptionStore,
  actor: ResearchActor,
  raw: unknown,
) {
  const parsed = aiAdoptionSchema.safeParse(raw);
  if (!parsed.success)
    return failure("VALIDATION_FAILED", "Select a suggestion and explain the adoption decision.");
  return researchOperation(() => store.adopt(actor, parsed.data));
}
