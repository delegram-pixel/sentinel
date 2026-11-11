import { z } from "zod";
import { AI_PROVIDER_NAMES, AI_TASK_TYPES } from "../domain/ai-config";
import { outputSchemaForTask } from "../domain/structured-output";
import { analysisEnvelopeSchema } from "../domain/collaboration-output";
import { validateTaskResponse } from "./task-service";
export const evaluationCaseSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(AI_PROVIDER_NAMES),
  model: z.string().min(1),
  taskType: z.enum(AI_TASK_TYPES),
  stage: z.enum(["PRIMARY", "SECONDARY", "REVIEW"]).optional(),
  output: z.unknown(),
  expectedValid: z.boolean(),
  sources: z.record(z.string(), z.array(z.uuid())),
  reviewClaims: z.record(z.string(), z.array(z.string())).optional(),
  latencyMs: z.number().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
});
/** Offline scoring of synthetic or archived responses. This module makes no inference calls. */
export function evaluateModelOutputs(values: unknown) {
  const cases = z.array(evaluationCaseSchema).min(1).parse(values);
  const results = cases.map((item) => {
    const ids = (key: string) => new Set(item.sources[key] ?? []);
    const context = {
      observationIds: ids("OBSERVATION"),
      hypothesisIds: ids("HYPOTHESIS"),
      evidenceIds: ids("EVIDENCE"),
      findingIds: ids("FINDING"),
      decisionIds: ids("DECISION"),
      knowledgeIds: ids("KNOWLEDGE"),
      historyIds: ids("HISTORY"),
      reviewClaims: item.reviewClaims,
    };
    const base = outputSchemaForTask(item.taskType);
    const schema =
      base && item.stage && item.stage !== "REVIEW" ? analysisEnvelopeSchema(base) : base;
    const checked = validateTaskResponse(
      { taskType: item.taskType, collaborationStage: item.stage },
      item.output,
      context,
    );
    return {
      id: item.id,
      provider: item.provider,
      model: item.model,
      schemaValid: Boolean(schema?.safeParse(item.output).success),
      accepted: checked.ok,
      expectedOutcomeMatched: checked.ok === item.expectedValid,
      problems: checked.ok ? [] : checked.problems,
      requiresHumanReview: true,
      latencyMs: item.latencyMs,
      costUsd: item.costUsd,
    };
  });
  const keys = [...new Set(results.map((result) => `${result.provider}:${result.model}`))];
  return {
    version: 1,
    mode: "OFFLINE",
    results,
    models: keys.map((key) => {
      const group = results.filter((result) => `${result.provider}:${result.model}` === key);
      return {
        model: key,
        cases: group.length,
        schemaPassRate: group.filter((result) => result.schemaValid).length / group.length,
        validationPassRate: group.filter((result) => result.accepted).length / group.length,
        expectedOutcomeMatchRate:
          group.filter((result) => result.expectedOutcomeMatched).length / group.length,
        totalRecordedCostUsd: group.reduce((total, result) => total + (result.costUsd ?? 0), 0),
        recordedLatencyMs: group.flatMap((result) =>
          result.latencyMs === undefined ? [] : [result.latencyMs],
        ),
      };
    }),
  };
}
