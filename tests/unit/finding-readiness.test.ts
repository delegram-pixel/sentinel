import { describe, expect, it } from "vitest";

import {
  confirmationReadiness,
  normalizeFindingTitle,
  reportabilityReadiness,
  severityAssessmentSchema,
} from "@/modules/findings/domain/finding";

describe("finding title normalization", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeFindingTitle("  Reflected  XSS (Search)!! ")).toBe("reflected xss search");
  });

  it("applies NFKC so compatibility characters compare equal", () => {
    expect(normalizeFindingTitle("Ｆｕｌｌｗｉｄｔｈ")).toBe("fullwidth");
  });

  it("keeps unicode letters and numbers", () => {
    expect(normalizeFindingTitle("Überprüfung 2026")).toBe("überprüfung 2026");
  });
});

describe("confirmation readiness", () => {
  const ready = {
    severity: "HIGH" as const,
    severityRationale: "Remote code execution on the public endpoint.",
    affectedAsset: "https://app.example.test/search",
    affectedAssetType: "API" as const,
    impact: "An unauthenticated attacker can run code.",
    remediation: "Encode the parameter and add a regression test.",
    supportsEvidenceCount: 1,
  };

  it("accepts a complete finding", () => {
    expect(confirmationReadiness(ready)).toEqual([]);
  });

  it("requires severity, rationale, affected asset, type, and supporting evidence", () => {
    const problems = confirmationReadiness({
      ...ready,
      severity: "UNASSESSED",
      severityRationale: null,
      affectedAsset: null,
      affectedAssetType: null,
      supportsEvidenceCount: 0,
    });

    expect(problems).toHaveLength(5);
  });

  it("does not accept non-supporting evidence as the confirmation trigger", () => {
    expect(confirmationReadiness({ ...ready, supportsEvidenceCount: 0 })).toContain(
      "Link at least one supporting piece of evidence before confirmation.",
    );
  });

  it("reportability additionally requires impact and remediation", () => {
    expect(reportabilityReadiness(ready)).toEqual([]);
    expect(reportabilityReadiness({ ...ready, impact: null, remediation: "  " })).toHaveLength(2);
  });
});

describe("severity assessment validation", () => {
  it("rejects a severity without rationale", () => {
    const result = severityAssessmentSchema.safeParse({
      severity: "CRITICAL",
      severityRationale: "",
    });

    expect(result.success).toBe(false);
  });

  it("allows an unassessed severity without rationale", () => {
    expect(severityAssessmentSchema.safeParse({ severity: "UNASSESSED" }).success).toBe(true);
  });
});
