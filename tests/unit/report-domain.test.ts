import { describe, expect, it } from "vitest";

import {
  buildReportTemplateSections,
  canManageReportTemplates,
  canTransitionReport,
  DEFAULT_REPORT_TEMPLATE_SECTIONS,
  isHumanReviewer,
  parseReportTemplateSections,
  renderReportMarkdown,
  reportContentSchema,
  reportCreateSchema,
  reportFileName,
  reportReadinessProblems,
  reportTemplateCreateSchema,
  type ReportFindingInput,
  type ReportSource,
} from "@/modules/reports/domain/report";

function finding(overrides: Partial<ReportFindingInput> = {}): ReportFindingInput {
  return {
    id: "9f6b7c6e-6e57-4f04-9c8f-6f1f1a2b3c4d",
    title: "Reflected cross-site scripting",
    description: "The search parameter is reflected without encoding.",
    status: "CONFIRMED",
    severity: "HIGH",
    severityRationale: "Script execution in an authenticated session.",
    vulnerabilityCategory: "XSS",
    affectedAsset: "https://lab.example.test/search",
    affectedAssetType: "API",
    impact: "An attacker can execute script in a victim's session.",
    remediation: "Encode the output and add a regression test.",
    evidence: [
      {
        evidenceId: "1f6b7c6e-6e57-4f04-9c8f-6f1f1a2b3c4d",
        title: "Search response with payload",
        evidenceType: "SCREENSHOT",
        redactionStatus: "VERIFIED_SAFE",
        relationshipType: "SUPPORTS",
        version: 1,
        checksum: "a".repeat(64),
      },
    ],
    ...overrides,
  };
}

function source(overrides: Partial<ReportSource> = {}): ReportSource {
  return {
    investigationTitle: "Search review",
    projectName: "Local Lab",
    targetName: "Practice Target",
    targetAssetIdentifier: "lab.example.test",
    generatedAt: new Date("2026-11-06T00:00:00.000Z"),
    findings: [finding()],
    ...overrides,
  };
}

describe("report status transitions", () => {
  it("moves a draft through review, approval, and export", () => {
    expect(canTransitionReport("DRAFT", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionReport("UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canTransitionReport("APPROVED", "EXPORTED")).toBe(true);
  });

  it("allows revisions by returning an under-review report to draft", () => {
    expect(canTransitionReport("UNDER_REVIEW", "DRAFT")).toBe(true);
  });

  it("archives non-archived reports and never leaves an archive", () => {
    for (const status of ["DRAFT", "UNDER_REVIEW", "APPROVED", "EXPORTED"] as const) {
      expect(canTransitionReport(status, "ARCHIVED")).toBe(true);
    }

    expect(canTransitionReport("ARCHIVED", "DRAFT")).toBe(false);
    expect(canTransitionReport("DRAFT", "APPROVED")).toBe(false);
    expect(canTransitionReport("APPROVED", "UNDER_REVIEW")).toBe(false);
  });

  it("reserves approval for human reviewer roles", () => {
    expect(isHumanReviewer("OWNER")).toBe(true);
    expect(isHumanReviewer("ADMIN")).toBe(true);
    expect(isHumanReviewer("REVIEWER")).toBe(true);
    expect(isHumanReviewer("RESEARCHER")).toBe(false);
  });
});

describe("report readiness", () => {
  it("accepts a complete confirmed finding with approved supporting evidence", () => {
    expect(reportReadinessProblems(source())).toEqual([]);
  });

  it("rejects findings that are not confirmed or reportable", () => {
    const problems = reportReadinessProblems(
      source({ findings: [finding({ status: "UNDER_REVIEW" })] }),
    );

    expect(problems.some((problem) => problem.includes("not confirmed or reportable"))).toBe(true);
  });

  it("requires severity, asset, impact, remediation, rationale, and support", () => {
    const problems = reportReadinessProblems(
      source({
        findings: [
          finding({
            severity: "UNASSESSED",
            severityRationale: null,
            affectedAsset: null,
            affectedAssetType: null,
            impact: null,
            remediation: " ",
            evidence: [
              {
                evidenceId: "1f6b7c6e-6e57-4f04-9c8f-6f1f1a2b3c4d",
                title: "Search response with payload",
                evidenceType: "SCREENSHOT",
                redactionStatus: "VERIFIED_SAFE",
                relationshipType: "CONTEXT",
                version: 1,
                checksum: "a".repeat(64),
              },
            ],
          }),
        ],
      }),
    );

    expect(problems).toHaveLength(6);
  });

  it("requires at least one finding", () => {
    expect(reportReadinessProblems(source({ findings: [] }))).toEqual([
      "Select at least one confirmed or reportable finding.",
    ]);
  });
});

describe("report Markdown", () => {
  it("includes the investigation, findings, and evidence references", () => {
    const markdown = renderReportMarkdown(source());

    expect(markdown).toContain("# Search review");
    expect(markdown).toContain("**Project:** Local Lab");
    expect(markdown).toContain("### 1. Reflected cross-site scripting");
    expect(markdown).toContain("Search response with payload");
    expect(markdown).toContain("SHA-256");
    expect(markdown).toContain("## Assumptions and limitations");
    expect(markdown).toContain("## Missing information");
  });

  it("lists missing information instead of inventing it", () => {
    const markdown = renderReportMarkdown(
      source({ findings: [finding({ impact: null, remediation: null })] }),
    );

    expect(markdown).toContain("impact is not recorded");
    expect(markdown).toContain("remediation is not recorded");
  });

  it("escapes repeated blank lines and ends with one newline", () => {
    const markdown = renderReportMarkdown(source());

    expect(markdown.endsWith("\n")).toBe(true);
    expect(markdown.endsWith("\n\n")).toBe(false);
    expect(markdown).not.toContain("\n\n\n");
  });
});

describe("report input validation", () => {
  it("requires a title and at least one finding", () => {
    expect(
      reportCreateSchema.safeParse({
        investigationId: "9f6b7c6e-6e57-4f04-9c8f-6f1f1a2b3c4d",
        title: "Report",
        findingIds: ["1f6b7c6e-6e57-4f04-9c8f-6f1f1a2b3c4d"],
      }).success,
    ).toBe(true);

    expect(
      reportCreateSchema.safeParse({
        investigationId: "9f6b7c6e-6e57-4f04-9c8f-6f1f1a2b3c4d",
        title: "A",
        findingIds: [],
      }).success,
    ).toBe(false);
  });

  it("rejects empty report content", () => {
    expect(reportContentSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(reportContentSchema.safeParse({ content: "# Report" }).success).toBe(true);
  });

  it("builds a safe Markdown filename", () => {
    expect(reportFileName("Web App Assessment: Q4/2026")).toBe("web-app-assessment-q42026.md");
    expect(reportFileName("   ")).toBe("report.md");
    expect(reportFileName("Web App Assessment: Q4/2026", "PDF")).toBe(
      "web-app-assessment-q42026.pdf",
    );
  });
});

describe("report templates", () => {
  it("keeps every required section and adds optional sections", () => {
    const sections = buildReportTemplateSections([
      "summary",
      "findings",
      "evidence",
      "assumptions",
      "missing-information",
      "methodology",
      "recommendations",
    ]);

    expect(sections).toHaveLength(7);
    expect(sections.map((section) => section.id)).toEqual([
      "summary",
      "findings",
      "evidence",
      "assumptions",
      "missing-information",
      "methodology",
      "recommendations",
    ]);
  });

  it("falls back to the default schema when a required section is missing", () => {
    expect(
      parseReportTemplateSections([{ id: "summary", title: "Summary", required: true }]),
    ).toEqual(DEFAULT_REPORT_TEMPLATE_SECTIONS);
  });

  it("validates template names and required sections", () => {
    expect(
      reportTemplateCreateSchema.safeParse({
        name: "Assessment report",
        sectionIds: ["summary", "findings", "evidence", "assumptions", "missing-information"],
      }).success,
    ).toBe(true);
    expect(
      reportTemplateCreateSchema.safeParse({
        name: "Assessment report",
        sectionIds: ["summary", "findings"],
      }).success,
    ).toBe(false);
  });

  it("renders optional sections in the schema order", () => {
    const markdown = renderReportMarkdown(
      source({
        sections: buildReportTemplateSections([
          "summary",
          "findings",
          "evidence",
          "assumptions",
          "missing-information",
          "methodology",
          "recommendations",
        ]),
      }),
    );

    expect(markdown).toContain("## Methodology");
    expect(markdown).toContain("## Recommendations");
    expect(markdown.indexOf("## Methodology")).toBeLessThan(markdown.indexOf("## Recommendations"));
  });

  it("reserves template management for owners and administrators", () => {
    expect(canManageReportTemplates("OWNER")).toBe(true);
    expect(canManageReportTemplates("ADMIN")).toBe(true);
    expect(canManageReportTemplates("REVIEWER")).toBe(false);
    expect(canManageReportTemplates("RESEARCHER")).toBe(false);
  });
});
