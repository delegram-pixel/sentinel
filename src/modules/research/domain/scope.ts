import { z } from "zod";

import { capabilitySchema, type Capability } from "@/modules/security/domain/capability";
import { failure, type DomainResult } from "@/modules/shared/domain/result";

import { dateOnlySchema, endOfDayUtc, optionalText, parseDateOnly } from "./fields";
import { assetTypeSchema } from "./target";

export const SCOPE_STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED", "REVOKED"] as const;

export type ScopeStatus = (typeof SCOPE_STATUSES)[number];

export const SCOPE_STATUS_LABELS: Record<ScopeStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  SUPERSEDED: "Superseded",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

export const SCOPE_ASSET_MATCH_TYPES = [
  "EXACT",
  "DOMAIN",
  "SUBDOMAIN",
  "CIDR",
  "URL_PREFIX",
] as const;

export type ScopeAssetMatchType = (typeof SCOPE_ASSET_MATCH_TYPES)[number];

export const SCOPE_ASSET_EFFECTS = ["ALLOWED", "EXCLUDED"] as const;

export type ScopeAssetEffect = (typeof SCOPE_ASSET_EFFECTS)[number];

export const SCOPE_ASSET_MATCH_LABELS: Record<ScopeAssetMatchType, string> = {
  EXACT: "Exact",
  DOMAIN: "Domain",
  SUBDOMAIN: "Subdomain",
  CIDR: "CIDR",
  URL_PREFIX: "URL prefix",
};

export const SCOPE_ASSET_EFFECT_LABELS: Record<ScopeAssetEffect, string> = {
  ALLOWED: "Allowed",
  EXCLUDED: "Excluded",
};

export const SCOPE_ACTIVITY_EFFECTS = ["PERMITTED", "PROHIBITED"] as const;

export type ScopeActivityEffect = (typeof SCOPE_ACTIVITY_EFFECTS)[number];

export const SCOPE_ACTIVITY_EFFECT_LABELS: Record<ScopeActivityEffect, string> = {
  PERMITTED: "Permitted",
  PROHIBITED: "Prohibited",
};

const scopeTransitions: Record<ScopeStatus, readonly ScopeStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["SUPERSEDED", "REVOKED", "EXPIRED"],
  SUPERSEDED: [],
  EXPIRED: [],
  REVOKED: [],
};

export function canTransitionScope(from: ScopeStatus, to: ScopeStatus): boolean {
  return scopeTransitions[from].includes(to);
}

export const scopeAssetDraftSchema = z.object({
  assetIdentifier: z.string().trim().min(1, "Enter an asset.").max(255),
  assetType: assetTypeSchema,
  matchType: z.enum(SCOPE_ASSET_MATCH_TYPES),
  effect: z.enum(SCOPE_ASSET_EFFECTS),
  notes: optionalText(500),
});

export type ScopeAssetDraft = z.infer<typeof scopeAssetDraftSchema>;

export const scopeDraftInputSchema = z
  .object({
    effectiveFrom: dateOnlySchema,
    effectiveUntil: dateOnlySchema,
    assets: z.array(scopeAssetDraftSchema).min(1, "Add at least one asset.").max(50),
    permittedActivities: z.array(capabilitySchema).min(1, "Permit at least one activity.").max(20),
    attestationNotes: optionalText(2000),
  })
  .superRefine((input, ctx) => {
    const from = parseDateOnly(input.effectiveFrom);
    const until = parseDateOnly(input.effectiveUntil);

    if (!from || !until) {
      return;
    }

    if (until.getTime() < from.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveUntil"],
        message: "The end date cannot be before the start date.",
      });
    }

    if (!input.assets.some((asset) => asset.effect === "ALLOWED")) {
      ctx.addIssue({
        code: "custom",
        path: ["assets"],
        message: "A scope needs at least one allowed asset.",
      });
    }

    const assetKeys = new Set<string>();

    input.assets.forEach((asset, index) => {
      const key = `${asset.assetIdentifier.toLowerCase()}::${asset.matchType}`;

      if (assetKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "assetIdentifier"],
          message: "This asset and match type already exist in the scope.",
        });
      }

      assetKeys.add(key);
    });

    if (new Set(input.permittedActivities).size !== input.permittedActivities.length) {
      ctx.addIssue({
        code: "custom",
        path: ["permittedActivities"],
        message: "Each activity can appear only once.",
      });
    }
  });

export type ScopeDraftInput = z.infer<typeof scopeDraftInputSchema>;

export const scopeActivationInputSchema = z
  .object({
    authorizationSource: z.string().trim().min(3, "Name the authorization source.").max(300),
    authorizationDate: dateOnlySchema,
    attestationNotes: optionalText(2000),
    acknowledged: z.preprocess(
      (value) => value === "on" || value === "true" || value === true,
      z.boolean(),
    ),
  })
  .superRefine((input, ctx) => {
    if (!input.acknowledged) {
      ctx.addIssue({
        code: "custom",
        path: ["acknowledged"],
        message: "Confirm that you are authorized to test this asset.",
      });
    }
  });

export type ScopeActivationInput = z.infer<typeof scopeActivationInputSchema>;

export type ScopeRuleSnapshot = {
  assets: ReadonlyArray<{
    assetIdentifier: string;
    matchType: ScopeAssetMatchType;
    effect: ScopeAssetEffect;
  }>;
  activities: ReadonlyArray<{
    activity: Capability;
    effect: ScopeActivityEffect;
  }>;
};

export type ScopeActivationRecord = ScopeRuleSnapshot & {
  status: ScopeStatus;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

/**
 * All preconditions ADR-003 and ADR-017 require before a scope version may
 * become ACTIVE. The database repeats the critical ones as constraints.
 */
export function validateScopeActivation(
  scope: ScopeActivationRecord,
  input: ScopeActivationInput,
  now: Date,
): DomainResult<true> {
  if (scope.status !== "DRAFT") {
    return failure("SCOPE_NOT_DRAFT", "Only a draft scope version can be activated.");
  }

  if (!scope.effectiveFrom || !scope.effectiveUntil) {
    return failure("SCOPE_WINDOW_REQUIRED", "Set both an effective start and end date.");
  }

  if (scope.effectiveFrom.getTime() >= scope.effectiveUntil.getTime()) {
    return failure("SCOPE_WINDOW_INVALID", "The effective window must have a positive duration.");
  }

  if (!scope.assets.some((asset) => asset.effect === "ALLOWED")) {
    return failure("SCOPE_ASSET_REQUIRED", "Add at least one allowed asset before activation.");
  }

  if (!scope.activities.some((activity) => activity.effect === "PERMITTED")) {
    return failure("SCOPE_ACTIVITY_REQUIRED", "Permit at least one activity before activation.");
  }

  if (input.authorizationSource.trim().length < 3) {
    return failure("AUTHORIZATION_SOURCE_REQUIRED", "Name the authorization source.");
  }

  const authorizationDate = parseDateOnly(input.authorizationDate);

  if (!authorizationDate) {
    return failure("AUTHORIZATION_DATE_REQUIRED", "Enter a valid authorization date.");
  }

  if (authorizationDate.getTime() > endOfDayUtc(now).getTime()) {
    return failure("AUTHORIZATION_DATE_IN_FUTURE", "Authorization cannot be dated in the future.");
  }

  if (!input.acknowledged) {
    return failure(
      "ATTESTATION_REQUIRED",
      "Confirm that you hold authorization for the assets in this scope.",
    );
  }

  return { ok: true, value: true };
}
