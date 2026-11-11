// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/config/env.schema";
import { createAiRuntime } from "@/modules/ai/infrastructure/provider-factory";
import { routeModel } from "@/modules/ai/application/model-router";
import * as environment from "@/config/env.server";
afterEach(() => vi.restoreAllMocks());
function configure(values: Record<string, string> = {}) {
  vi.spyOn(environment, "getServerEnv").mockReturnValue(
    parseServerEnv({ NODE_ENV: "production", AI_ROUTING_MODE: "MULTI_MODEL", ...values }),
  );
  return createAiRuntime()!;
}
it("excludes missing credentials and unapproved confidential providers without exposing secrets", async () => {
  const runtime = configure({
    GEMINI_API_KEY: "private-gemini",
    OPENROUTER_API_KEY: "private-router",
  });
  await expect(routeModel(runtime, "RECON_ANALYSIS")).rejects.toMatchObject({
    code: "AI_NO_COMPATIBLE_MODEL",
  });
  expect(JSON.stringify(runtime)).not.toMatch(/private-gemini|private-router/);
});
it("keeps free Groq available while requiring paid opt-in and a Gemini retention attestation", async () => {
  const runtime = configure({
    GROQ_API_KEY: "private-groq",
    GROQ_ZDR_ENABLED: "true",
    GEMINI_API_KEY: "private-gemini",
    GEMINI_PAID_API_ENABLED: "true",
    AI_ALLOW_PAID_MODELS: "true",
    AI_MAX_TASK_COST_USD: "1",
    AI_MAX_DAILY_COST_USD: "10",
  });
  expect((await routeModel(runtime, "RECON_ANALYSIS")).model.key).toBe("groq-research");
});
it("requires verified metadata for unknown model overrides and rejects malformed routing lazily", async () => {
  const unverified = configure({
    GEMINI_RESEARCH_MODEL: "unknown-model",
    GEMINI_API_KEY: "private",
    GEMINI_PAID_API_ENABLED: "true",
    GEMINI_CONFIDENTIAL_DATA_APPROVED: "true",
    AI_ALLOW_PAID_MODELS: "true",
    AI_MAX_TASK_COST_USD: "1",
    AI_MAX_DAILY_COST_USD: "10",
  });
  expect(unverified.models.find((model) => model.key === "research")?.availability).toBe(
    "UNVERIFIED",
  );
  await expect(routeModel(unverified, "RECON_ANALYSIS")).rejects.toMatchObject({
    code: "AI_NO_COMPATIBLE_MODEL",
  });
  vi.restoreAllMocks();
  expect(configure({ AI_ROUTING_CONFIG: "{invalid" }).models).toHaveLength(0);
});
it("supports full collaboration with deterministic mocks without opting into paid calls", async () => {
  const runtime = configure({ NODE_ENV: "development", AI_USE_MOCK_PROVIDER: "true" });
  const primary = await routeModel(runtime, "PATTERN_ANALYSIS");
  const secondary = await routeModel(runtime, "PATTERN_ANALYSIS", "SECONDARY", {
    excludedModels: [primary.model.modelId],
  });
  const review = await routeModel(runtime, "RESEARCH_CONCLUSION_REVIEW", "REVIEW", {
    excludedModels: [primary.model.modelId, secondary.model.modelId],
  });
  expect(
    [primary, secondary, review].every(
      (route) => route.provider.name === "MOCK" && route.model.free,
    ),
  ).toBe(true);
  expect(new Set([primary, secondary, review].map((route) => route.model.modelId)).size).toBe(3);
});
