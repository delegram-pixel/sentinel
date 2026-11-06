import { describe, expect, it } from "vitest";

import {
  deriveTargetAuthorization,
  type ScopeAuthorizationSnapshot,
} from "@/modules/research/domain/target";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function scope(overrides: Partial<ScopeAuthorizationSnapshot> = {}): ScopeAuthorizationSnapshot {
  return {
    version: 1,
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: new Date("2026-12-31T23:59:59.999Z"),
    approvedBy: "user-1",
    approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("deriveTargetAuthorization", () => {
  it("returns UNVERIFIED when there is no scope", () => {
    expect(deriveTargetAuthorization(null, NOW)).toEqual({
      status: "UNVERIFIED",
      expiresAt: null,
    });
  });

  it("returns UNVERIFIED for a draft", () => {
    expect(deriveTargetAuthorization(scope({ status: "DRAFT" }), NOW)).toEqual({
      status: "UNVERIFIED",
      expiresAt: null,
    });
  });

  it("returns AUTHORIZED and mirrors the expiry inside the window", () => {
    const result = deriveTargetAuthorization(scope(), NOW);

    expect(result.status).toBe("AUTHORIZED");
    expect(result.expiresAt?.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("returns PENDING before the effective window", () => {
    expect(
      deriveTargetAuthorization(
        scope({ effectiveFrom: new Date("2026-07-01T00:00:00.000Z") }),
        NOW,
      ),
    ).toEqual({ status: "PENDING", expiresAt: null });
  });

  it("returns EXPIRED after the effective window", () => {
    expect(
      deriveTargetAuthorization(
        scope({ effectiveUntil: new Date("2026-05-01T00:00:00.000Z") }),
        NOW,
      ),
    ).toEqual({ status: "EXPIRED", expiresAt: null });
  });

  it("returns REVOKED for a revoked active version", () => {
    expect(deriveTargetAuthorization(scope({ status: "REVOKED" }), NOW)).toEqual({
      status: "REVOKED",
      expiresAt: null,
    });
  });

  it("returns EXPIRED when the latest version is marked expired", () => {
    expect(deriveTargetAuthorization(scope({ status: "EXPIRED" }), NOW)).toEqual({
      status: "EXPIRED",
      expiresAt: null,
    });
  });

  it("returns UNVERIFIED when a later version superseded the active one", () => {
    expect(deriveTargetAuthorization(scope({ status: "SUPERSEDED" }), NOW)).toEqual({
      status: "UNVERIFIED",
      expiresAt: null,
    });
  });

  it("does not authorize an active scope with an incomplete attestation", () => {
    expect(deriveTargetAuthorization(scope({ approvedBy: null }), NOW)).toEqual({
      status: "UNVERIFIED",
      expiresAt: null,
    });
    expect(deriveTargetAuthorization(scope({ approvedAt: null }), NOW)).toEqual({
      status: "UNVERIFIED",
      expiresAt: null,
    });
    expect(deriveTargetAuthorization(scope({ effectiveFrom: null }), NOW)).toEqual({
      status: "UNVERIFIED",
      expiresAt: null,
    });
  });
});
