import { z } from "zod";

import type { ScopeStatus } from "./scope";
import { dateOnlySchema, optionalHttpUrl, optionalText } from "./fields";

export const ASSET_TYPES = [
  "DOMAIN",
  "APPLICATION",
  "API",
  "IP_ASSET",
  "LOCAL_LAB",
  "OTHER",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const assetTypeSchema = z.enum(ASSET_TYPES);

export const ENVIRONMENT_TYPES = [
  "PRACTICE_LAB",
  "BUG_BOUNTY_PROGRAM",
  "AUTHORIZED_ASSESSMENT",
  "INTERNAL_ENVIRONMENT",
] as const;

export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number];

export const TARGET_AUTHORIZATION_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "EXPIRED",
  "REVOKED",
  "UNVERIFIED",
] as const;

export type TargetAuthorizationStatus = (typeof TARGET_AUTHORIZATION_STATUSES)[number];

const optionalDateOnly = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  dateOnlySchema.optional(),
);

export const targetInputSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(100),
  description: optionalText(2000),
  assetIdentifier: z.string().trim().min(1, "Enter the asset identifier.").max(255),
  assetType: assetTypeSchema,
  environmentType: z.enum(ENVIRONMENT_TYPES),
  programName: optionalText(120),
  programUrl: optionalHttpUrl(500),
  authorizationSource: optionalText(300),
  authorizationDate: optionalDateOnly,
  authorizationNotes: optionalText(2000),
});

export type TargetInput = z.infer<typeof targetInputSchema>;

export type ScopeAuthorizationSnapshot = {
  version: number;
  status: ScopeStatus;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
};

export type DerivedTargetAuthorization = {
  status: TargetAuthorizationStatus;
  expiresAt: Date | null;
};

/**
 * Materialised target summary per ADR-017. It is a cache: the action-time scope
 * validator remains the security boundary.
 */
export function deriveTargetAuthorization(
  latestScope: ScopeAuthorizationSnapshot | null,
  now: Date,
): DerivedTargetAuthorization {
  if (!latestScope) {
    return { status: "UNVERIFIED", expiresAt: null };
  }

  if (latestScope.status === "REVOKED") {
    return { status: "REVOKED", expiresAt: null };
  }

  if (latestScope.status === "EXPIRED") {
    return { status: "EXPIRED", expiresAt: null };
  }

  if (latestScope.status !== "ACTIVE") {
    return { status: "UNVERIFIED", expiresAt: null };
  }

  const { effectiveFrom, effectiveUntil, approvedAt, approvedBy } = latestScope;

  if (!effectiveFrom || !effectiveUntil || !approvedAt || !approvedBy) {
    return { status: "UNVERIFIED", expiresAt: null };
  }

  if (now.getTime() < effectiveFrom.getTime()) {
    return { status: "PENDING", expiresAt: null };
  }

  if (now.getTime() > effectiveUntil.getTime()) {
    return { status: "EXPIRED", expiresAt: null };
  }

  return { status: "AUTHORIZED", expiresAt: effectiveUntil };
}

export const TARGET_AUTHORIZATION_LABELS: Record<TargetAuthorizationStatus, string> = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized (self-attested)",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
  UNVERIFIED: "Unverified",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  DOMAIN: "Domain",
  APPLICATION: "Application",
  API: "API",
  IP_ASSET: "IP asset",
  LOCAL_LAB: "Local lab",
  OTHER: "Other",
};

export const ENVIRONMENT_TYPE_LABELS: Record<EnvironmentType, string> = {
  PRACTICE_LAB: "Practice lab",
  BUG_BOUNTY_PROGRAM: "Bug bounty program",
  AUTHORIZED_ASSESSMENT: "Authorized assessment",
  INTERNAL_ENVIRONMENT: "Internal environment",
};
