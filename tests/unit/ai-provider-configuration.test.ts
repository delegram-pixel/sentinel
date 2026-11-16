// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/config/env.schema";
import * as environment from "@/config/env.server";
import type { AiProviderRequest } from "@/modules/ai/application/provider";
import { createAIProvider } from "@/modules/ai/infrastructure/provider-factory";

afterEach(() => vi.restoreAllMocks());

const request: AiProviderRequest = {
  taskType: "RECON_ANALYSIS",
  model: "openai/gpt-oss-120b",
  system: "Review the supplied public policy.",
  messages: [{ role: "user", content: "Public program rules" }],
  maxTokens: 1000,
  timeoutMs: 1000,
};

it("explains the missing Groq retention confirmation without making a provider call", async () => {
  vi.spyOn(environment, "getServerEnv").mockReturnValue(
    parseServerEnv({ NODE_ENV: "development", GROQ_API_KEY: "test-key", GROQ_ZDR_ENABLED: "" }),
  );
  const fetch = vi.spyOn(globalThis, "fetch");
  const provider = createAIProvider();

  await expect(provider.generate(request)).rejects.toMatchObject({
    code: "AI_NOT_CONFIGURED",
    message: expect.stringContaining("GROQ_ZDR_ENABLED=true"),
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("selects the live Groq adapter when the key and retention confirmation are configured", () => {
  vi.spyOn(environment, "getServerEnv").mockReturnValue(
    parseServerEnv({ NODE_ENV: "development", GROQ_API_KEY: "test-key", GROQ_ZDR_ENABLED: "true" }),
  );

  expect(createAIProvider().name).toBe("GROQ");
});
