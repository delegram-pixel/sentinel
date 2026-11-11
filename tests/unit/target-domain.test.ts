import { describe, expect, it } from "vitest";

import {
  isValidDomainAssetIdentifier,
  isValidDomainName,
  isValidIpAssetIdentifier,
  targetInputSchema,
  targetUpdateInputSchema,
} from "@/modules/research/domain/target";

const validInput = {
  name: "Customer dashboard",
  description: "A staging application used for access-control practice.",
  assetIdentifier: "app.example.test",
  assetType: "DOMAIN",
  environmentType: "PRACTICE_LAB",
  programName: "Internal practice",
  programUrl: "https://example.test/security-policy",
  authorizationSource: "Self-owned application",
  authorizationDate: "2026-05-12",
  authorizationNotes: "Read-only activities only.",
};

function issuesFor(input: Record<string, unknown>, field: string) {
  const result = targetInputSchema.safeParse({ ...validInput, ...input });

  if (result.success) {
    return [];
  }

  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
}

describe("target input validation", () => {
  it("accepts a complete target", () => {
    expect(targetInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("requires a recognisable asset name", () => {
    expect(issuesFor({ name: "A" }, "name")).toContain(
      "Give this asset a name with at least 2 characters.",
    );
  });

  it("requires an asset identifier", () => {
    expect(issuesFor({ assetIdentifier: " " }, "assetIdentifier")).toContain(
      "Enter the asset identifier.",
    );
  });

  it("accepts a full URL for a Domain target", () => {
    expect(
      targetInputSchema.safeParse({
        ...validInput,
        assetType: "DOMAIN",
        assetIdentifier: "https://example.com/login",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed domain", () => {
    expect(
      issuesFor({ assetType: "DOMAIN", assetIdentifier: "not a domain" }, "assetIdentifier"),
    ).toContain("Enter a valid domain name or http(s) URL, such as example.com.");
  });

  it("accepts IPv4, IPv6 and CIDR identifiers for IP assets", () => {
    for (const assetIdentifier of ["192.0.2.10", "2001:db8::1", "192.0.2.0/24"]) {
      expect(
        targetInputSchema.safeParse({
          ...validInput,
          assetType: "IP_ASSET",
          assetIdentifier,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects a malformed IP asset identifier", () => {
    expect(
      issuesFor({ assetType: "IP_ASSET", assetIdentifier: "999.0.0.1" }, "assetIdentifier"),
    ).toContain("Enter a valid IPv4 or IPv6 address, such as 192.0.2.10.");
  });

  it("requires an authorization source for non-practice environments", () => {
    expect(
      issuesFor(
        { environmentType: "BUG_BOUNTY_PROGRAM", authorizationSource: "" },
        "authorizationSource",
      ),
    ).toContain("Add information about the source of your authorization for this environment.");
  });

  it("allows a practice lab without an authorization source", () => {
    expect(
      targetInputSchema.safeParse({
        ...validInput,
        environmentType: "PRACTICE_LAB",
        authorizationSource: "",
      }).success,
    ).toBe(true);
  });

  it("allows legacy updates without inventing an authorization source", () => {
    expect(
      targetUpdateInputSchema.safeParse({
        ...validInput,
        environmentType: "AUTHORIZED_ASSESSMENT",
        authorizationSource: "",
        name: "Renamed legacy target",
      }).success,
    ).toBe(true);
  });

  it("gives a specific error for a malformed authorization reference", () => {
    expect(issuesFor({ programUrl: "not-a-url" }, "programUrl")).toContain(
      "Enter a valid link starting with http:// or https://, or leave this blank.",
    );
  });
});

describe("asset identifier helpers", () => {
  it("distinguishes domains from IP addresses", () => {
    expect(isValidDomainName("app.example.test")).toBe(true);
    expect(isValidDomainName("192.0.2.10")).toBe(false);
    expect(isValidDomainName("localhost")).toBe(false);
  });

  it("accepts domain targets recorded as full URLs or host paths", () => {
    expect(isValidDomainAssetIdentifier("https://app.example.test/login")).toBe(true);
    expect(isValidDomainAssetIdentifier("app.example.test:8443/login")).toBe(true);
    expect(isValidDomainAssetIdentifier("http://192.0.2.10")).toBe(true);
    expect(isValidDomainAssetIdentifier("https://")).toBe(false);
  });

  it("validates IP assets", () => {
    expect(isValidIpAssetIdentifier("192.0.2.10")).toBe(true);
    expect(isValidIpAssetIdentifier("2001:db8::1")).toBe(true);
    expect(isValidIpAssetIdentifier("192.0.2.0/24")).toBe(true);
    expect(isValidIpAssetIdentifier("example.com")).toBe(false);
  });
});
