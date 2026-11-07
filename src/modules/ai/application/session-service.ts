import { z } from "zod";
import { failure } from "@/modules/shared/domain/result";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
export const aiSessionModeSchema = z.object({
  conversationId: z.uuid(),
  expectedMode: z.enum(["GUIDED", "DELEGATED"]),
  mode: z.enum(["GUIDED", "DELEGATED"]),
});
export interface AiSessionStore {
  changeMode(
    actor: ResearchActor,
    input: z.infer<typeof aiSessionModeSchema>,
  ): Promise<{ id: string }>;
}
export function changeAiSessionMode(s: AiSessionStore, a: ResearchActor, input: unknown) {
  const p = aiSessionModeSchema.safeParse(input);
  return p.success
    ? researchOperation(() => s.changeMode(a, p.data))
    : Promise.resolve(failure("VALIDATION_FAILED", "Choose a valid research session mode."));
}
