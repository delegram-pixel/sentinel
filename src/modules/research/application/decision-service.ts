import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
import {
  decisionInputSchema,
  investigationRelationSchema,
  researchPhaseSchema,
  type DecisionInput,
  type InvestigationRelationInput,
  type ResearchPhaseInput,
} from "../domain/research-decision";

export type DecisionRow = {
  id: string;
  kind: string;
  rationale: string;
  sourceRefs: unknown;
  createdAt: Date;
  creator: { displayName: string };
  sourceTaskId: string | null;
};
export interface DecisionStore {
  list(workspaceId: string, investigationId: string): Promise<DecisionRow[]>;
  record(actor: ResearchActor, input: DecisionInput): Promise<{ id: string }>;
  changePhase(actor: ResearchActor, input: ResearchPhaseInput): Promise<{ id: string }>;
  relate(actor: ResearchActor, input: InvestigationRelationInput): Promise<{ id: string }>;
}
function operation<T>(
  schema: z.ZodType<T>,
  input: unknown,
  run: (data: T) => Promise<{ id: string }>,
) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return Promise.resolve(
      failure(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Check the research decision.",
      ),
    );
  return researchOperation(() => run(parsed.data));
}
export const recordResearchDecision = (
  store: DecisionStore,
  actor: ResearchActor,
  input: unknown,
) => operation(decisionInputSchema, input, (data) => store.record(actor, data));
export const changeResearchPhase = (store: DecisionStore, actor: ResearchActor, input: unknown) =>
  operation(researchPhaseSchema, input, (data) => store.changePhase(actor, data));
export const relateInvestigations = (store: DecisionStore, actor: ResearchActor, input: unknown) =>
  operation(investigationRelationSchema, input, (data) => store.relate(actor, data));
