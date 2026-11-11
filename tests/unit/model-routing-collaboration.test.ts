// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MODEL_REGISTRY,
  routingConfigSchema,
  modelEntrySchema,
  estimateModelCost,
} from "@/modules/ai/domain/model-registry";
import { routeModel, type AiRuntime } from "@/modules/ai/application/model-router";
import {
  consolidateCollaboration,
  invalidReviewClaims,
  type AnalysisEvaluation,
} from "@/modules/ai/domain/collaboration-output";
import { validateTaskResponse } from "@/modules/ai/application/task-service";
import { parseServerEnv, missingProductionEnv } from "@/config/env.schema";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const provider = { name: "test", generate: vi.fn() };
function runtime(overrides: Partial<AiRuntime> = {}): AiRuntime {
  return {
    models: DEFAULT_MODEL_REGISTRY,
    config: routingConfigSchema.parse({}),
    providerFor: () => provider,
    privacyApproved: () => true,
    allowPaid: true,
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    ...overrides,
  };
}
const evaluation = (conclusion: "SUPPORTED" | "UNSUPPORTED"): AnalysisEvaluation => ({
  version: 1,
  claims: [
    {
      id: "claim-access",
      statement: "The observation records access.",
      basis: "OBSERVED",
      confidence: "low",
      limitations: ["Needs human review"],
      sources: [{ kind: "OBSERVATION", id, relationship: "SUPPORTS" }],
    },
  ],
  conclusions: [
    {
      subject: { kind: "OBSERVATION", id },
      conclusion,
      reasoning: "Different interpretation of the supplied evidence.",
      sources: [{ kind: "OBSERVATION", id, relationship: "SUPPORTS" }],
    },
  ],
});
describe("model registry and routing", () => {
  it("validates dated registry entries and keeps every assignment centralized", () => {
    for (const model of DEFAULT_MODEL_REGISTRY)
      expect(modelEntrySchema.safeParse(model).success).toBe(true);
    expect(new Set(DEFAULT_MODEL_REGISTRY.map((m) => m.key)).size).toBe(
      DEFAULT_MODEL_REGISTRY.length,
    );
    expect(routingConfigSchema.safeParse({ roles: { REVIEW: ["review"] } }).success).toBe(true);
  });
  it("routes research, summaries, secondary reasoning and review by capabilities", async () => {
    expect((await routeModel(runtime(), "RECON_ANALYSIS")).model.key).toBe("research");
    expect((await routeModel(runtime(), "SESSION_SUMMARY")).model.key).toBe("summary");
    expect((await routeModel(runtime(), "EVIDENCE_REVIEW", "SECONDARY")).model.key).toBe(
      "secondary",
    );
    expect((await routeModel(runtime(), "RESEARCH_CONCLUSION_REVIEW", "REVIEW")).model.key).toBe(
      "review",
    );
  });
  it("preserves free Groq when paid access or privacy approval is absent", async () => {
    const r = runtime({ allowPaid: false });
    const route = await routeModel(r, "RECON_ANALYSIS");
    expect(route.model.key).toBe("groq-research");
    expect(route.fallbackFrom).toBe("gemini-3.8-flash");
    await expect(
      routeModel(runtime({ privacyApproved: () => false }), "RECON_ANALYSIS"),
    ).rejects.toMatchObject({ code: "AI_NO_COMPATIBLE_MODEL" });
  });
  it("filters missing credentials, disabled/unverified models, context limits, health, and self-review", async () => {
    const r = runtime({
      config: routingConfigSchema.parse({ roles: { PRIMARY: ["research"] } }),
      models: [{ ...DEFAULT_MODEL_REGISTRY[0]!, contextWindow: 100 }],
    });
    await expect(routeModel(r, "EVIDENCE_REVIEW")).rejects.toMatchObject({
      code: "AI_NO_COMPATIBLE_MODEL",
    });
    await expect(
      routeModel(runtime({ providerFor: () => null }), "RECON_ANALYSIS"),
    ).rejects.toMatchObject({ code: "AI_NO_COMPATIBLE_MODEL" });
    await expect(
      routeModel(
        runtime({
          models: DEFAULT_MODEL_REGISTRY.map((m) => ({ ...m, availability: "UNVERIFIED" })),
        }),
        "RECON_ANALYSIS",
      ),
    ).rejects.toMatchObject({ code: "AI_NO_COMPATIBLE_MODEL" });
    const route = await routeModel(
      runtime({ health: async (m) => ({ available: m.key !== "research" }) }),
      "RECON_ANALYSIS",
    );
    expect(route.model.key).toBe("secondary");
    await expect(
      routeModel(runtime(), "EVIDENCE_REVIEW", "REVIEW", {
        excludedModels: ["nvidia/nemotron-3.5-super-vl", "openai/gpt-oss-120b"],
      }),
    ).rejects.toMatchObject({ code: "AI_NO_COMPATIBLE_MODEL" });
  });
  it("handles unknown pricing and effective-date price changes", async () => {
    const model = DEFAULT_MODEL_REGISTRY[0]!;
    expect(estimateModelCost(model, 1000000, 1000000, new Date("2026-11-11"))).toBe(4.5);
    expect(estimateModelCost(model, 1000000, 1000000, new Date("2027-01-01"))).toBe(9);
    expect(estimateModelCost({ ...model, pricing: null }, 100, 100)).toBeNull();
    const r = runtime({
      models: [{ ...model, pricing: null }],
      config: routingConfigSchema.parse({ roles: { PRIMARY: ["research"] } }),
    });
    await expect(routeModel(r, "RECON_ANALYSIS")).rejects.toMatchObject({
      code: "AI_NO_COMPATIBLE_MODEL",
    });
  });
  it("allows all missing credentials without disabling unrelated production configuration", () => {
    const env = parseServerEnv({ GEMINI_API_KEY: "", OPENROUTER_API_KEY: "", GROQ_API_KEY: "" });
    expect(env.AI_ROUTING_MODE).toBe("LEGACY");
    expect(env.AI_MAX_DAILY_COST_USD).toBe(0);
    expect(missingProductionEnv({}).some((k) => /API_KEY|ZDR/.test(k))).toBe(false);
  });
});
describe("collaboration evaluation", () => {
  it("preserves opposing conclusions with their sources and never approves a finding", () => {
    const result = consolidateCollaboration(
      [
        { taskId: id, provider: "GEMINI", model: "primary", evaluation: evaluation("SUPPORTED") },
        {
          taskId: other,
          provider: "OPENROUTER",
          model: "secondary",
          evaluation: evaluation("UNSUPPORTED"),
        },
      ],
      null,
      [{ stage: "REVIEW", code: "AI_RATE_LIMITED" }],
    );
    expect(result.status).toBe("INCOMPLETE");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.positions).toHaveLength(2);
    expect(result.requiresHumanReview).toBe(true);
  });
  it("requires a reviewer to address every known stage claim and reject fabricated references", () => {
    const review = {
      reviews: [
        {
          taskId: id,
          claimId: "claim-fabricated",
          verdict: "INSUFFICIENT" as const,
          reasoning: "Missing source",
          sources: [],
        },
      ],
      conclusions: [],
      missingInformation: [],
    };
    expect(invalidReviewClaims(review, { [id]: ["claim-access"] })).toHaveLength(2);
  });
  it("unwraps new envelopes without changing the legacy task payload and rejects unsupported claims", () => {
    const analysis = { patterns: [], claims: [], uncertaintyNotes: [] };
    const context = {
      observationIds: new Set([id]),
      hypothesisIds: new Set<string>(),
      evidenceIds: new Set<string>(),
    };
    const envelope = { ...evaluation("SUPPORTED"), analysis };
    const result = validateTaskResponse(
      { taskType: "PATTERN_ANALYSIS", collaborationStage: "PRIMARY" },
      envelope,
      context,
    );
    expect(result).toMatchObject({ ok: true, output: analysis, evaluation: { version: 1 } });
    const unsupported = { ...envelope, claims: [{ ...envelope.claims[0], sources: [] }] };
    expect(
      validateTaskResponse(
        { taskType: "PATTERN_ANALYSIS", collaborationStage: "PRIMARY" },
        unsupported,
        context,
      ).ok,
    ).toBe(false);
    const unknown = {
      ...envelope,
      conclusions: [{ ...envelope.conclusions[0], subject: { kind: "OBSERVATION", id: other } }],
    };
    expect(
      validateTaskResponse(
        { taskType: "PATTERN_ANALYSIS", collaborationStage: "PRIMARY" },
        unknown,
        context,
      ).ok,
    ).toBe(false);
    expect(validateTaskResponse({ taskType: "PATTERN_ANALYSIS" }, analysis, context)).toMatchObject(
      { ok: true, output: analysis },
    );
  });
});
