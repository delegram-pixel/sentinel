// @vitest-environment node
import { expect, it } from "vitest";
import fixtures from "../fixtures/ai-model-evaluation.json";
import { evaluateModelOutputs } from "@/modules/ai/application/model-evaluation";
it("reproducibly rejects malformed, fabricated, unsupported and incomplete results without inference", () => {
  const result = evaluateModelOutputs(fixtures);
  expect(result.results).toHaveLength(6);
  expect(
    result.results.every((item) => item.expectedOutcomeMatched && item.requiresHumanReview),
  ).toBe(true);
  expect(result.results.filter((item) => item.accepted)).toHaveLength(2);
  expect(
    result.models.every(
      (model) => model.totalRecordedCostUsd === 0 && model.recordedLatencyMs.length === 0,
    ),
  ).toBe(true);
});
