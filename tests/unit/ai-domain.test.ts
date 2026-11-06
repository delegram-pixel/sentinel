import { describe, expect, it } from "vitest";

import { AI_TASK_PROFILES, DEFAULT_AI_MODELS, modelForTask } from "@/modules/ai/domain/ai-config";
import {
  AI_DAILY_USER_TOKEN_CAP,
  canAffordTask,
  estimateCostUsd,
  estimateTokens,
} from "@/modules/ai/domain/ai-budgets";
import {
  conversationOutputSchema,
  hypothesisGenerationOutputSchema,
  invalidEvidenceReferences,
  outputSchemaForTask,
} from "@/modules/ai/domain/structured-output";
import { listPrompts, findPrompt } from "@/modules/ai/prompts/registry";

describe("AI task configuration", () => {
  it("uses the ADR-025 model classes by default", () => {
    expect(modelForTask("HYPOTHESIS_GENERATION")).toBe(DEFAULT_AI_MODELS.SONNET);
    expect(modelForTask("SESSION_SUMMARY")).toBe(DEFAULT_AI_MODELS.HAIKU);
  });

  it("allows server-side model overrides", () => {
    expect(
      modelForTask("RECON_ANALYSIS", {
        researchModel: "custom-sonnet",
        summaryModel: "custom-haiku",
      }),
    ).toBe("custom-sonnet");
    expect(
      modelForTask("SESSION_SUMMARY", {
        researchModel: "custom-sonnet",
        summaryModel: "custom-haiku",
      }),
    ).toBe("custom-haiku");
  });

  it("keeps the documented per-task token budgets", () => {
    expect(AI_TASK_PROFILES.RECON_ANALYSIS).toMatchObject({
      inputTokenBudget: 40_000,
      outputTokenBudget: 3_000,
    });
    expect(AI_TASK_PROFILES.SESSION_SUMMARY).toMatchObject({
      inputTokenBudget: 30_000,
      outputTokenBudget: 2_000,
    });
    expect(AI_TASK_PROFILES.EVIDENCE_REVIEW).toMatchObject({
      inputTokenBudget: 60_000,
      outputTokenBudget: 4_000,
    });
  });

  it("fails closed for task types without a prompt", () => {
    expect(AI_TASK_PROFILES.EVIDENCE_REVIEW.promptId).toBeNull();
    expect(AI_TASK_PROFILES.REPORT_GENERATION.promptId).toBeNull();
    expect(AI_TASK_PROFILES.RECON_ANALYSIS.promptId).not.toBeNull();
  });
});

describe("AI budgets", () => {
  it("refuses a task that cannot fit inside the daily cap", () => {
    expect(
      canAffordTask(AI_DAILY_USER_TOKEN_CAP - 43_000, {
        inputTokenBudget: 40_000,
        outputTokenBudget: 3_000,
      }),
    ).toBe(true);
    expect(
      canAffordTask(AI_DAILY_USER_TOKEN_CAP - 42_999, {
        inputTokenBudget: 40_000,
        outputTokenBudget: 3_000,
      }),
    ).toBe(false);
  });

  it("estimates tokens and cost conservatively", () => {
    expect(estimateTokens("12345678")).toBe(2);
    expect(estimateCostUsd("HAIKU", 1_000_000, 0)).toBe(1);
    expect(estimateCostUsd("SONNET", 1_000_000, 1_000_000)).toBe(18);
  });
});

describe("AI prompt registry", () => {
  it("gives every prompt a stable SHA-256 content hash", () => {
    const prompts = listPrompts();
    expect(prompts.length).toBeGreaterThan(0);

    for (const prompt of prompts) {
      expect(prompt.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(findPrompt(prompt.id)?.contentHash).toBe(prompt.contentHash);
    }

    expect(new Set(prompts.map((prompt) => prompt.id)).size).toBe(prompts.length);
  });

  it("states the untrusted-data and human-authority restrictions", () => {
    const prompt = findPrompt("investigation.chat");

    expect(prompt?.safetyRestrictions.join(" ")).toContain("untrusted_data");
    expect(prompt?.safetyRestrictions.join(" ")).toContain("human");
    expect(prompt?.safetyRestrictions.join(" ")).toContain("no tools");
  });
});

describe("AI structured output", () => {
  it("maps task types to the expected output schema", () => {
    expect(outputSchemaForTask("ATTACK_SURFACE_ANALYSIS")).toBe(conversationOutputSchema);
    expect(outputSchemaForTask("SESSION_SUMMARY")).not.toBeNull();
    expect(outputSchemaForTask("REPORT_GENERATION")).not.toBeNull();
  });

  it("rejects unknown evidence references", () => {
    const output = hypothesisGenerationOutputSchema.parse({
      hypotheses: [
        {
          title: "Candidate",
          description: "A candidate hypothesis.",
          vulnerabilityCategory: "XSS",
          rationale: "A reflected value was recorded.",
          missingInformation: "Confirm the response body.",
          supportingObservationIds: ["11111111-1111-4111-8111-111111111111"],
          confidence: "low",
        },
      ],
      duplicateRiskNotes: [],
      nextActions: [],
    });

    const problems = invalidEvidenceReferences(output, new Set<string>(), new Set<string>());

    expect(problems).toEqual([
      "Unknown observation reference: 11111111-1111-4111-8111-111111111111.",
    ]);
  });

  it("rejects malformed structured output", () => {
    expect(
      conversationOutputSchema.safeParse({
        message: "",
        suggestedNextSteps: [],
        referencedObservationIds: [],
        referencedHypothesisIds: [],
        warnings: [],
      }).success,
    ).toBe(false);
  });
});
