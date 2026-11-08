import {
  CAPABILITY_LABELS,
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
      "This target needs a scope first. Draft its boundaries and activate the scope with your permission attestation before continuing.",
    );
  }

  if (scope.status !== "ACTIVE") {
    return failure(
      "SCOPE_NOT_ACTIVE",
      `This scope is ${scope.status.toLowerCase()}, so it doesn't permit the action. Check the target's scope history before continuing.`,
    );
  }

  if (!scope.effectiveFrom || !scope.effectiveUntil) {
    return failure(
      "SCOPE_INCOMPLETE",
      "This scope is missing its permission dates. Create and activate a scope version with valid dates before continuing.",
    );
  }

  if (now.getTime() < scope.effectiveFrom.getTime()) {
    return failure(
      "SCOPE_NOT_YET_EFFECTIVE",
      "This scope's permission window hasn't started yet. Wait until its start time before using it.",
    );
  }

  if (now.getTime() > scope.effectiveUntil.getTime()) {
    return failure(
      "SCOPE_EXPIRED",
      "This scope's permission window has ended. Further work needs a new active scope with current permission.",
    );
  }

  const activity = scope.activities.find((rule) => rule.activity === capability);

  if (!activity) {
    return failure(
      "CAPABILITY_NOT_PERMITTED",
      `This scope doesn't permit ${CAPABILITY_LABELS[capability]}. Check the activities covered by your permission before continuing.`,
    );
  }

  if (activity.effect === ("PROHIBITED" satisfies ScopeActivityEffect)) {
    return failure(
      "CAPABILITY_PROHIBITED",
      `This scope explicitly prohibits ${CAPABILITY_LABELS[capability]}. Check the permission boundaries before continuing.`,
    );
  }

  const matchingAssets = scope.assets.filter((asset) =>
    assetMatchesRule(input.targetAssetIdentifier, asset.assetIdentifier, asset.matchType),
  );

  if (matchingAssets.some((asset) => asset.effect === ("EXCLUDED" satisfies ScopeAssetEffect))) {
    return failure(
      "ASSET_EXCLUDED",
      "This asset is explicitly excluded, so this scope doesn't permit the action. Check the permission boundaries before continuing.",
    );
  }

  if (matchingAssets.some((asset) => asset.effect === "ALLOWED")) {
    return {
      ok: true,
      value: { matchedAsset: input.targetAssetIdentifier, capability },
    };
  }

  return failure(
    "ASSET_NOT_IN_SCOPE",
    "This asset isn't covered by the active scope. Check your permission and the scope's asset rules before continuing.",
  );
}
