import { describe, expect, it } from "vitest";

import { MockAIProvider } from "@/modules/ai/application/mock-provider";
import type { AiProviderRequest } from "@/modules/ai/application/provider";

function request(overrides: Partial<AiProviderRequest> = {}): AiProviderRequest {
  return {
    taskType: "HYPOTHESIS_GENERATION",
    model: "claude-sonnet-4-5",
    system: "System",
    messages: [{ role: "user", content: "Generate hypotheses." }],
    maxTokens: 3_000,
    timeoutMs: 10_000,
    structuredOutput: {
      toolName: "return_structured_output",
      description: "Return the result.",
      schema: { type: "object" },
    },
    ...overrides,
  };
}

describe("deterministic mock provider", () => {
  it("returns a valid deterministic output for a supported task", async () => {
    const provider = new MockAIProvider();
    const result = await provider.generate(request());

    expect(result.structured).toMatchObject({
      hypotheses: expect.any(Array),
      duplicateRiskNotes: expect.any(Array),
    });
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it("supports a malformed-output evaluation fixture", async () => {
    const provider = new MockAIProvider({ scenario: "malformed" });
    const result = await provider.generate(request());

    expect(typeof result.structured).toBe("string");
  });

  it("supports schema-failure and unknown-reference fixtures", async () => {
    const schemaFailure = await new MockAIProvider({ scenario: "schema_error" }).generate(
      request(),
    );
    expect(schemaFailure.structured).toEqual({ message: 42 });

    const unknownReference = await new MockAIProvider({
      scenario: "unknown_reference",
    }).generate(request());
    expect(unknownReference.structured).toMatchObject({
      hypotheses: [
        {
          supportingObservationIds: ["00000000-0000-4000-8000-000000000000"],
        },
      ],
    });
  });

  it.each([
    ["timeout", "AI_TIMEOUT"],
    ["rate_limit", "AI_RATE_LIMITED"],
    ["refusal", "AI_REFUSAL"],
  ] as const)("supports the %s evaluation fixture", async (scenario, code) => {
    await expect(new MockAIProvider({ scenario }).generate(request())).rejects.toMatchObject({
      code,
    });
  });
});
