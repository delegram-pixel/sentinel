import { describe, expect, it } from "vitest";

import {
  canTransitionScope,
  scopeDraftInputSchema,
  validateScopeActivation,
  type ScopeActivationRecord,
} from "@/modules/research/domain/scope";

const NOW = new Date("2026-06-01T12:00:00.000Z");

const validDraftInput = {
  effectiveFrom: "2026-06-01",
  effectiveUntil: "2026-06-30",
  assets: [
    {
      assetIdentifier: "app.example.com",
      assetType: "DOMAIN" as const,
      matchType: "DOMAIN" as const,
      effect: "ALLOWED" as const,
    },
  ],
  permittedActivities: ["READ_PROJECT_CONTEXT" as const],
};

function activationRecord(overrides: Partial<ScopeActivationRecord> = {}): ScopeActivationRecord {
  return {
    status: "DRAFT",
    effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
    effectiveUntil: new Date("2026-06-30T23:59:59.999Z"),
    assets: [
      {
        assetIdentifier: "app.example.com",
        matchType: "DOMAIN",
        effect: "ALLOWED",
      },
    ],
    activities: [{ activity: "READ_PROJECT_CONTEXT", effect: "PERMITTED" }],
    ...overrides,
  };
}

const validActivation = {
  authorizationSource: "Self-owned lab",
  authorizationDate: "2026-05-30",
  acknowledged: true,
};

describe("scope draft validation", () => {
  it("accepts a complete draft", () => {
    expect(scopeDraftInputSchema.safeParse(validDraftInput).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = scopeDraftInputSchema.safeParse({
      ...validDraftInput,
      effectiveUntil: "2026-05-30",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    expect(
      scopeDraftInputSchema.safeParse({ ...validDraftInput, effectiveFrom: "2026-02-31" }).success,
    ).toBe(false);
  });

  it("rejects a scope without an allowed asset", () => {
    const result = scopeDraftInputSchema.safeParse({
      ...validDraftInput,
      assets: [
        {
          assetIdentifier: "admin.example.com",
          assetType: "DOMAIN",
          matchType: "DOMAIN",
          effect: "EXCLUDED",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate assets with the same match type", () => {
    const result = scopeDraftInputSchema.safeParse({
      ...validDraftInput,
      assets: [...validDraftInput.assets, ...validDraftInput.assets],
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one permitted activity", () => {
    expect(
      scopeDraftInputSchema.safeParse({ ...validDraftInput, permittedActivities: [] }).success,
    ).toBe(false);
  });
});

describe("scope activation", () => {
  it("accepts a complete self-attestation", () => {
    expect(validateScopeActivation(activationRecord(), validActivation, NOW).ok).toBe(true);
  });

  it("refuses a version that is not a draft", () => {
    expect(
      validateScopeActivation(activationRecord({ status: "ACTIVE" }), validActivation, NOW),
    ).toMatchObject({ ok: false, code: "SCOPE_NOT_DRAFT" });
  });

  it("refuses a scope without an allowed asset", () => {
    expect(
      validateScopeActivation(activationRecord({ assets: [] }), validActivation, NOW),
    ).toMatchObject({ ok: false, code: "SCOPE_ASSET_REQUIRED" });
  });

  it("refuses a scope without a permitted activity", () => {
    expect(
      validateScopeActivation(activationRecord({ activities: [] }), validActivation, NOW),
    ).toMatchObject({ ok: false, code: "SCOPE_ACTIVITY_REQUIRED" });
  });

  it("refuses an authorization date in the future", () => {
    expect(
      validateScopeActivation(
        activationRecord(),
        { ...validActivation, authorizationDate: "2026-06-02" },
        NOW,
      ),
    ).toMatchObject({ ok: false, code: "AUTHORIZATION_DATE_IN_FUTURE" });
  });

  it("refuses activation without acknowledgement", () => {
    expect(
      validateScopeActivation(activationRecord(), { ...validActivation, acknowledged: false }, NOW),
    ).toMatchObject({ ok: false, code: "ATTESTATION_REQUIRED" });
  });
});

describe("scope status transitions", () => {
  it("allows only the documented edges", () => {
    expect(canTransitionScope("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionScope("ACTIVE", "SUPERSEDED")).toBe(true);
    expect(canTransitionScope("ACTIVE", "REVOKED")).toBe(true);
    expect(canTransitionScope("ACTIVE", "EXPIRED")).toBe(true);
    expect(canTransitionScope("ACTIVE", "DRAFT")).toBe(false);
    expect(canTransitionScope("SUPERSEDED", "ACTIVE")).toBe(false);
    expect(canTransitionScope("REVOKED", "ACTIVE")).toBe(false);
    expect(canTransitionScope("EXPIRED", "ACTIVE")).toBe(false);
  });
});
