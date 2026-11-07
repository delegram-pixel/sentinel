import {
  evaluateCapability,
  type Capability,
  type CapabilityActor,
} from "@/modules/security/domain/capability";
import { failure, type DomainResult } from "@/modules/shared/domain/result";

import type {
  ScopeActivityEffect,
  ScopeAssetEffect,
  ScopeAssetMatchType,
  ScopeRuleSnapshot,
  ScopeStatus,
} from "./scope";

export type ScopeValidationRecord = ScopeRuleSnapshot & {
  status: ScopeStatus;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

export type ScopeValidationInput = {
  scope: ScopeValidationRecord | null;
  targetAssetIdentifier: string;
  capability: Capability;
  actor: CapabilityActor;
  now: Date;
};

export type ScopeValidationSuccess = {
  matchedAsset: string;
  capability: Capability;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

/**
 * Reduce an asset identifier to a hostname. Handles URLs, host:port, and bare
 * domain or IP values. Paths are dropped; URL_PREFIX matching uses the raw
 * normalized value instead.
 */
export function assetHost(value: string): string {
  const trimmed = value.trim();

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase().replace(/\.$/, "");
    } catch {
      return "";
    }
  }

  const withoutPath = trimmed.split("/")[0] ?? trimmed;

  return withoutPath.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
}

function ipv4ToNumber(value: string): number | null {
  const parts = value.split(".");

  if (parts.length !== 4) {
    return null;
  }

  let result = 0;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const octet = Number(part);

    if (octet > 255) {
      return null;
    }

    result = (result << 8) + octet;
  }

  return result >>> 0;
}

/** IPv4 CIDR matching. IPv6 identifiers deliberately do not match. */
export function matchesCidr(targetHost: string, cidr: string): boolean {
  const [base, prefixValue] = cidr.split("/");
  const prefix = prefixValue === undefined ? 32 : Number(prefixValue);

  if (!base || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const baseNumber = ipv4ToNumber(base);
  const targetNumber = ipv4ToNumber(targetHost);

  if (baseNumber === null || targetNumber === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return (baseNumber & mask) >>> 0 === (targetNumber & mask) >>> 0;
}

export function assetMatchesRule(
  targetAssetIdentifier: string,
  ruleAssetIdentifier: string,
  matchType: ScopeAssetMatchType,
): boolean {
  const target = normalize(targetAssetIdentifier);
  const rule = normalize(ruleAssetIdentifier);

  if (!target || !rule) {
    return false;
  }

  switch (matchType) {
    case "EXACT":
      return target === rule;
    case "DOMAIN": {
      const targetHost = assetHost(targetAssetIdentifier);
      const ruleHost = assetHost(ruleAssetIdentifier);

      return Boolean(
        targetHost && ruleHost && (targetHost === ruleHost || targetHost.endsWith(`.${ruleHost}`)),
      );
    }
    case "SUBDOMAIN": {
      const targetHost = assetHost(targetAssetIdentifier);
      const ruleHost = assetHost(ruleAssetIdentifier);

      return Boolean(targetHost && ruleHost && targetHost.endsWith(`.${ruleHost}`));
    }
    case "CIDR":
      return matchesCidr(assetHost(targetAssetIdentifier), ruleAssetIdentifier.trim());
    case "URL_PREFIX": {
      try {
        const asset = new URL(targetAssetIdentifier.trim());
        const allowed = new URL(ruleAssetIdentifier.trim());
        if (
          !["http:", "https:"].includes(asset.protocol) ||
          asset.origin !== allowed.origin ||
          asset.username ||
          asset.password ||
          allowed.username ||
          allowed.password
        )
          return false;
        if (/%(?:2f|5c|2e)/i.test(asset.pathname + allowed.pathname)) return false;
        const prefix = allowed.pathname.replace(/\/+$/, "") || "/";
        const pathMatches =
          prefix === "/" || asset.pathname === prefix || asset.pathname.startsWith(`${prefix}/`);
        return (
          pathMatches &&
          [...allowed.searchParams].every(([key, value]) =>
            asset.searchParams.getAll(key).includes(value),
          )
        );
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function activeWindow(scope: ScopeValidationRecord, now: Date): boolean {
  if (scope.status !== "ACTIVE" || !scope.effectiveFrom || !scope.effectiveUntil) {
    return false;
  }

  return (
    now.getTime() >= scope.effectiveFrom.getTime() &&
    now.getTime() <= scope.effectiveUntil.getTime()
  );
}

/**
 * The action-time authorization check (ADR-003, ADR-017).
 *
 * It never trusts the materialised target status or client state. Callers must
 * re-read the active scope and the current clock immediately before a
 * capability is used.
 */
export function validateScopeCapability(
  input: ScopeValidationInput,
): DomainResult<ScopeValidationSuccess> {
  const { scope, capability, actor, now } = input;
  const decision = evaluateCapability(capability, {
    actor,
    targetDocumented: true,
    activeScope: scope ? activeWindow(scope, now) : false,
  });

  if (!decision.allowed) {
    return failure(decision.code, decision.message);
  }

  if (!scope) {
    return failure(
      "SCOPE_NOT_CONFIGURED",
      "No scope version exists for this target. Create and activate one first.",
    );
  }

  if (scope.status !== "ACTIVE") {
    return failure(
      "SCOPE_NOT_ACTIVE",
      `The scope is ${scope.status.toLowerCase()}; no activity is authorized.`,
    );
  }

  if (!scope.effectiveFrom || !scope.effectiveUntil) {
    return failure("SCOPE_INCOMPLETE", "The active scope is missing its effective window.");
  }

  if (now.getTime() < scope.effectiveFrom.getTime()) {
    return failure("SCOPE_NOT_YET_EFFECTIVE", "The active scope has not started yet.");
  }

  if (now.getTime() > scope.effectiveUntil.getTime()) {
    return failure("SCOPE_EXPIRED", "The active scope has expired.");
  }

  const activity = scope.activities.find((rule) => rule.activity === capability);

  if (!activity) {
    return failure(
      "CAPABILITY_NOT_PERMITTED",
      `${capability} is not listed as a permitted activity in the active scope.`,
    );
  }

  if (activity.effect === ("PROHIBITED" satisfies ScopeActivityEffect)) {
    return failure(
      "CAPABILITY_PROHIBITED",
      `${capability} is explicitly prohibited by the active scope.`,
    );
  }

  const matchingAssets = scope.assets.filter((asset) =>
    assetMatchesRule(input.targetAssetIdentifier, asset.assetIdentifier, asset.matchType),
  );

  if (matchingAssets.some((asset) => asset.effect === ("EXCLUDED" satisfies ScopeAssetEffect))) {
    return failure("ASSET_EXCLUDED", "The target asset is explicitly excluded from the scope.");
  }

  if (matchingAssets.some((asset) => asset.effect === "ALLOWED")) {
    return {
      ok: true,
      value: { matchedAsset: input.targetAssetIdentifier, capability },
    };
  }

  return failure("ASSET_NOT_IN_SCOPE", "The target asset is not listed in the active scope.");
}
