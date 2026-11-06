import { describe, expect, it } from "vitest";

import {
  assetHost,
  assetMatchesRule,
  matchesCidr,
  validateScopeCapability,
  type ScopeValidationRecord,
} from "@/modules/research/domain/scope-validator";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function activeScope(overrides: Partial<ScopeValidationRecord> = {}): ScopeValidationRecord {
  return {
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: new Date("2026-12-31T23:59:59.999Z"),
    assets: [{ assetIdentifier: "app.example.com", matchType: "DOMAIN", effect: "ALLOWED" }],
    activities: [{ activity: "READ_PROJECT_CONTEXT", effect: "PERMITTED" }],
    ...overrides,
  };
}

describe("scope asset matching", () => {
  it("extracts hosts from URLs and host:port values", () => {
    expect(assetHost("https://App.Example.com/path?q=1")).toBe("app.example.com");
    expect(assetHost("app.example.com:8443")).toBe("app.example.com");
    expect(assetHost("10.0.0.5")).toBe("10.0.0.5");
  });

  it("matches exact values case-insensitively", () => {
    expect(assetMatchesRule("HTTPS://Example.com/Api", "https://example.com/Api", "EXACT")).toBe(
      true,
    );
    expect(assetMatchesRule("https://example.com/other", "https://example.com/api", "EXACT")).toBe(
      false,
    );
  });

  it("matches a domain and its subdomains", () => {
    expect(assetMatchesRule("example.com", "example.com", "DOMAIN")).toBe(true);
    expect(assetMatchesRule("api.example.com", "example.com", "DOMAIN")).toBe(true);
    expect(assetMatchesRule("notexample.com", "example.com", "DOMAIN")).toBe(false);
  });

  it("requires a strict subdomain for SUBDOMAIN", () => {
    expect(assetMatchesRule("api.example.com", "example.com", "SUBDOMAIN")).toBe(true);
    expect(assetMatchesRule("example.com", "example.com", "SUBDOMAIN")).toBe(false);
  });

  it("matches URL prefixes", () => {
    expect(
      assetMatchesRule("https://example.com/api/v1/users", "https://example.com/api", "URL_PREFIX"),
    ).toBe(true);
    expect(
      assetMatchesRule("https://example.com/admin", "https://example.com/api", "URL_PREFIX"),
    ).toBe(false);
  });

  it("matches IPv4 CIDR ranges and rejects outside addresses", () => {
    expect(matchesCidr("10.0.0.5", "10.0.0.0/24")).toBe(true);
    expect(matchesCidr("10.0.1.5", "10.0.0.0/24")).toBe(false);
    expect(matchesCidr("10.0.0.5", "0.0.0.0/0")).toBe(true);
    expect(matchesCidr("not-an-ip", "10.0.0.0/24")).toBe(false);
    expect(matchesCidr("::1", "::/0")).toBe(false);
  });

  it("supports an allow-everything CIDR with a zero prefix", () => {
    expect(assetMatchesRule("192.168.1.1", "0.0.0.0/0", "CIDR")).toBe(true);
  });
});

describe("action-time scope validation", () => {
  it("allows a permitted capability on an allowed asset inside the window", () => {
    const result = validateScopeCapability({
      scope: activeScope(),
      targetAssetIdentifier: "app.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      value: { matchedAsset: "app.example.com", capability: "READ_PROJECT_CONTEXT" },
    });
  });

  it("denies a capability that is not listed in the scope", () => {
    const result = validateScopeCapability({
      scope: activeScope(),
      targetAssetIdentifier: "app.example.com",
      capability: "AI_ANALYZE_TARGET_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "CAPABILITY_NOT_PERMITTED" });
  });

  it("denies a capability explicitly marked prohibited", () => {
    const result = validateScopeCapability({
      scope: activeScope({
        activities: [{ activity: "READ_PROJECT_CONTEXT", effect: "PROHIBITED" }],
      }),
      targetAssetIdentifier: "app.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "CAPABILITY_PROHIBITED" });
  });

  it("denies an asset that is not in the scope", () => {
    const result = validateScopeCapability({
      scope: activeScope(),
      targetAssetIdentifier: "other.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "ASSET_NOT_IN_SCOPE" });
  });

  it("lets an exclusion override a matching allowance", () => {
    const result = validateScopeCapability({
      scope: activeScope({
        assets: [
          { assetIdentifier: "example.com", matchType: "DOMAIN", effect: "ALLOWED" },
          { assetIdentifier: "admin.example.com", matchType: "DOMAIN", effect: "EXCLUDED" },
        ],
      }),
      targetAssetIdentifier: "admin.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "ASSET_EXCLUDED" });
  });

  it("denies a draft, expired, or not-yet-effective scope", () => {
    const draft = validateScopeCapability({
      scope: activeScope({ status: "DRAFT" }),
      targetAssetIdentifier: "app.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    const future = validateScopeCapability({
      scope: activeScope({ effectiveFrom: new Date("2026-07-01T00:00:00.000Z") }),
      targetAssetIdentifier: "app.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    const expired = validateScopeCapability({
      scope: activeScope({ effectiveUntil: new Date("2026-05-01T00:00:00.000Z") }),
      targetAssetIdentifier: "app.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(draft).toMatchObject({ ok: false, code: "SCOPE_NOT_ACTIVE" });
    expect(future).toMatchObject({ ok: false, code: "SCOPE_NOT_YET_EFFECTIVE" });
    expect(expired).toMatchObject({ ok: false, code: "SCOPE_EXPIRED" });
  });

  it("denies when no scope exists", () => {
    const result = validateScopeCapability({
      scope: null,
      targetAssetIdentifier: "app.example.com",
      capability: "READ_PROJECT_CONTEXT",
      actor: "HUMAN",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "SCOPE_NOT_CONFIGURED" });
  });

  it("still refuses capabilities that are not implemented, even with an active scope", () => {
    const passive = validateScopeCapability({
      scope: activeScope({
        activities: [{ activity: "PASSIVE_FETCH", effect: "PERMITTED" }],
      }),
      targetAssetIdentifier: "app.example.com",
      capability: "PASSIVE_FETCH",
      actor: "HUMAN",
      now: NOW,
    });

    expect(passive).toMatchObject({ ok: false, code: "CAPABILITY_NOT_IMPLEMENTED" });
  });

  it("refuses a human-only capability for an AI actor", () => {
    const result = validateScopeCapability({
      scope: activeScope({
        activities: [{ activity: "MODIFY_SCOPE", effect: "PERMITTED" }],
      }),
      targetAssetIdentifier: "app.example.com",
      capability: "MODIFY_SCOPE",
      actor: "AI",
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "HUMAN_ONLY_CAPABILITY" });
  });
});
