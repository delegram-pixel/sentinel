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

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** A conservative domain-name check used for the Domain asset type. */
export function isValidDomainName(value: string): boolean {
  const candidate = value.trim();

  if (!candidate || candidate.length > 253 || /\s/.test(candidate)) {
    return false;
  }

  // An IP address belongs to the IP asset type, not the Domain type.
  if (isValidIpAddress(candidate)) {
    return false;
  }

  const labels = candidate.split(".");

  return (
    labels.length >= 2 &&
    labels.every(
      (label) => label.length > 0 && label.length <= 63 && DOMAIN_LABEL_PATTERN.test(label),
    )
  );
}

/**
 * Domain targets may be recorded as a bare domain or as a full http(s) URL,
 * which is how earlier target records and the scope matcher expect them.
 */
export function isValidDomainAssetIdentifier(value: string): boolean {
  const candidate = value.trim();

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const host = new URL(candidate).hostname;
      return isValidDomainName(host) || isValidIpAddress(host);
    } catch {
      return false;
    }
  }

  // Accept host:port and host/path forms already present in older target
  // records, without accepting arbitrary free text.
  const host = (candidate.split("/")[0] ?? "").replace(/:\d+$/, "").replace(/\.$/, "");

  return isValidDomainName(host);
}

function isValidIpAddress(value: string): boolean {
  return z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success;
}

/** Accepts IPv4/IPv6 addresses and IPv4/IPv6 CIDR ranges for IP assets. */
export function isValidIpAssetIdentifier(value: string): boolean {
  const candidate = value.trim();

  return (
    isValidIpAddress(candidate) ||
    z.cidrv4().safeParse(candidate).success ||
    z.cidrv6().safeParse(candidate).success
  );
}

export function requiresAuthorizationSource(environmentType: EnvironmentType): boolean {
  return environmentType !== "PRACTICE_LAB";
}

function buildTargetInputSchema({
  enforceAuthorizationSource,
}: {
  enforceAuthorizationSource: boolean;
}) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Give this asset a name with at least 2 characters.")
        .max(100, "Keep the asset name under 100 characters."),
      description: optionalText(2000),
      assetIdentifier: z
        .string()
        .trim()
        .min(1, "Enter the asset identifier.")
        .max(255, "Keep the asset identifier under 255 characters."),
      assetType: assetTypeSchema,
      environmentType: z.enum(ENVIRONMENT_TYPES),
      programName: optionalText(120),
      programUrl: optionalHttpUrl(
        500,
        "Enter a valid link starting with http:// or https://, or leave this blank.",
      ),
      authorizationSource: optionalText(300),
      authorizationDate: optionalDateOnly,
      authorizationNotes: optionalText(2000),
    })
    .superRefine((input, ctx) => {
      if (input.assetType === "DOMAIN" && !isValidDomainAssetIdentifier(input.assetIdentifier)) {
        ctx.addIssue({
          code: "custom",
          path: ["assetIdentifier"],
          message: "Enter a valid domain name or http(s) URL, such as example.com.",
        });
      }

      if (input.assetType === "IP_ASSET" && !isValidIpAssetIdentifier(input.assetIdentifier)) {
        ctx.addIssue({
          code: "custom",
          path: ["assetIdentifier"],
          message: "Enter a valid IPv4 or IPv6 address, such as 192.0.2.10.",
        });
      }

      if (
        enforceAuthorizationSource &&
        !input.authorizationSource &&
        requiresAuthorizationSource(input.environmentType)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["authorizationSource"],
          message: "Add information about the source of your authorization for this environment.",
        });
      }
    });
}

export const targetInputSchema = buildTargetInputSchema({ enforceAuthorizationSource: true });

/**
 * Existing targets may predate the authorization-source requirement. Updates
 * keep format validation but must remain saveable without inventing a source.
 */
export const targetUpdateInputSchema = buildTargetInputSchema({
  enforceAuthorizationSource: false,
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

type AssetTypeGuidance = {
  description: string;
  example: string;
  identifierPlaceholder: string;
  identifierNote: string;
};

export const ASSET_TYPE_GUIDANCE: Record<AssetType, AssetTypeGuidance> = {
  DOMAIN: {
    description: "A website or domain name you are authorized to assess.",
    example: "example.com",
    identifierPlaceholder: "example.com",
    identifierNote:
      "Use a domain such as example.com, or a full https:// URL when the permission covers a specific page.",
  },
  APPLICATION: {
    description: "A web, mobile or software application.",
    example: "My Customer Dashboard",
    identifierPlaceholder: "my-nextjs-app",
    identifierNote:
      "Use the name your team knows the application by. A URL is also acceptable when the application has one.",
  },
  API: {
    description: "An application programming interface.",
    example: "api.example.com",
    identifierPlaceholder: "api.example.com",
    identifierNote: "Use the API host, base URL or endpoint covered by your permission.",
  },
  IP_ASSET: {
    description: "An authorized server or IP address.",
    example: "192.0.2.10",
    identifierPlaceholder: "192.0.2.10",
    identifierNote: "Use an IPv4 or IPv6 address, or an IPv4 or IPv6 CIDR range.",
  },
  LOCAL_LAB: {
    description: "A practice environment running on infrastructure you own or control.",
    example: "localhost:3000",
    identifierPlaceholder: "localhost:3000",
    identifierNote: "Use localhost, a host:port, or a URL on infrastructure you control.",
  },
  OTHER: {
    description: "An asset that does not fit the categories above.",
    example: "Internal VPN appliance",
    identifierPlaceholder: "my-nextjs-app",
    identifierNote: "Use the clearest unique reference your team will recognize.",
  },
};

export const ENVIRONMENT_TYPE_DESCRIPTIONS: Record<EnvironmentType, string> = {
  PRACTICE_LAB:
    "For applications and environments you own or have permission to use for security practice.",
  BUG_BOUNTY_PROGRAM:
    "For assets covered by a bug bounty program whose published policy permits your research.",
  AUTHORIZED_ASSESSMENT:
    "For security assessments backed by explicit permission from the asset owner or client.",
  INTERNAL_ENVIRONMENT: "For systems you are authorized to assess within your organization.",
};

export const AUTHORIZATION_SOURCE_SUGGESTIONS = [
  "Bug bounty program policy",
  "Written permission from the asset owner",
  "Signed assessment agreement",
  "Internal organizational approval",
  "Self-owned application or lab",
] as const;
