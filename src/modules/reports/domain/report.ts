import type {
  EvidenceLinkRelationship,
  EvidenceType,
  RedactionStatus,
} from "@/modules/evidence/domain/evidence";
import type { FindingStatus } from "@/modules/findings/domain/finding-status";
import type { Severity } from "@/modules/findings/domain/finding";
import type { AssetType } from "@/modules/research/domain/target";
import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";
import { z } from "zod";

export const REPORT_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "APPROVED",
  "EXPORTED",
  "ARCHIVED",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  EXPORTED: "Exported",
  ARCHIVED: "Archived",
};

const REPORT_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  DRAFT: ["UNDER_REVIEW", "ARCHIVED"],
  UNDER_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["EXPORTED", "ARCHIVED"],
  EXPORTED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  return REPORT_TRANSITIONS[from].includes(to);
}

export function isHumanReviewer(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "REVIEWER";
}

export const REPORT_TEMPLATE_SECTION_IDS = [
  "summary",
  "findings",
  "evidence",
  "assumptions",
  "missing-information",
  "methodology",
  "recommendations",
] as const;

export type ReportTemplateSectionId = (typeof REPORT_TEMPLATE_SECTION_IDS)[number];

export type ReportTemplateSection = {
  id: ReportTemplateSectionId;
  title: string;
  required: boolean;
};

/**
 * ADR-008 requires reports to label findings, evidence, assumptions, and
 * missing information separately. Those sections cannot be removed from a
 * template. Methodology and recommendations are optional additions.
 */
export const REQUIRED_REPORT_TEMPLATE_SECTION_IDS = [
  "summary",
  "findings",
  "evidence",
  "assumptions",
  "missing-information",
] as const;

const REPORT_TEMPLATE_SECTION_CATALOG: Record<ReportTemplateSectionId, ReportTemplateSection> =
  {
    summary: { id: "summary", title: "Summary", required: true },
    findings: { id: "findings", title: "Findings", required: true },
    evidence: { id: "evidence", title: "Evidence references", required: true },
    assumptions: { id: "assumptions", title: "Assumptions and limitations", required: true },
    "missing-information": {
      id: "missing-information",
      title: "Missing information",
      required: true,
    },
    methodology: { id: "methodology", title: "Methodology", required: false },
    recommendations: { id: "recommendations", title: "Recommendations", required: false },
  };

export const REPORT_TEMPLATE_SECTIONS = [
  REPORT_TEMPLATE_SECTION_CATALOG.summary,
  REPORT_TEMPLATE_SECTION_CATALOG.findings,
  REPORT_TEMPLATE_SECTION_CATALOG.evidence,
  REPORT_TEMPLATE_SECTION_CATALOG.assumptions,
  REPORT_TEMPLATE_SECTION_CATALOG["missing-information"],
] as const;

export const DEFAULT_REPORT_TEMPLATE_SECTIONS: ReportTemplateSection[] =
  REPORT_TEMPLATE_SECTION_IDS.map((id) => REPORT_TEMPLATE_SECTION_CATALOG[id]);

export const reportTemplateSectionSchema = z.array(
  z.object({
    id: z.enum(REPORT_TEMPLATE_SECTION_IDS),
    title: z.string().trim().min(1).max(120),
    required: z.boolean(),
  }),
);

export function parseReportTemplateSections(value: unknown): ReportTemplateSection[] {
  const parsed = reportTemplateSectionSchema.safeParse(value);

  if (!parsed.success) {
    return DEFAULT_REPORT_TEMPLATE_SECTIONS;
  }

  const seen = new Set<ReportTemplateSectionId>();
  const sections = parsed.data.filter((section) => {
    if (seen.has(section.id)) {
      return false;
    }

    seen.add(section.id);
    return true;
  });

  const complete = REQUIRED_REPORT_TEMPLATE_SECTION_IDS.every((id) =>
    sections.some((section) => section.id === id),
  );

  return complete ? sections : DEFAULT_REPORT_TEMPLATE_SECTIONS;
}

export function buildReportTemplateSections(
  sectionIds: readonly ReportTemplateSectionId[],
): ReportTemplateSection[] {
  const unique = [...new Set(sectionIds)];
  const sections = REPORT_TEMPLATE_SECTION_IDS.flatMap((id) =>
    unique.includes(id) ? [REPORT_TEMPLATE_SECTION_CATALOG[id]] : [],
  );

  return parseReportTemplateSections(sections);
}

export const REPORT_TEMPLATE_SECTION_OPTIONS = REPORT_TEMPLATE_SECTION_IDS.map((id) => {
  const section = REPORT_TEMPLATE_SECTION_CATALOG[id];

  return {
    id,
    title: section.title,
    required: (REQUIRED_REPORT_TEMPLATE_SECTION_IDS as readonly string[]).includes(id),
  };
});

export function canManageReportTemplates(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export const REPORT_FORMATS = ["MARKDOWN", "PDF"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const reportCreateSchema = z.object({
  investigationId: z.string().uuid(),
  title: z.string().trim().min(3, "Give the report a title.").max(200),
  templateId: z.string().uuid().optional(),
  findingIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one confirmed or reportable finding.")
    .max(50),
});

export const reportTemplateCreateSchema = z.object({
  name: z.string().trim().min(3, "Give the template a name.").max(120),
  sectionIds: z
    .array(z.enum(REPORT_TEMPLATE_SECTION_IDS))
    .refine(
      (ids) =>
        REQUIRED_REPORT_TEMPLATE_SECTION_IDS.every((requiredId) => ids.includes(requiredId)),
      "Keep every required report section in the template.",
    ),
});

export const reportContentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write the report content.")
    .max(200_000, "The report is too long."),
});

export const reportTransitionSchema = z.object({
  status: z.enum(REPORT_STATUSES),
});

export type ReportEvidenceInput = {
  evidenceId: string;
  title: string;
  evidenceType: EvidenceType;
  redactionStatus: RedactionStatus;
  relationshipType: EvidenceLinkRelationship;
  version: number;
  checksum: string;
};

export type ReportFindingInput = {
  id: string;
  title: string;
  description: string;
  status: FindingStatus;
  severity: Severity;
  severityRationale: string | null;
  vulnerabilityCategory: string | null;
  affectedAsset: string | null;
  affectedAssetType: AssetType | null;
  impact: string | null;
  remediation: string | null;
  evidence: ReportEvidenceInput[];
};

export type ReportSource = {
  investigationTitle: string;
  projectName: string;
  targetName: string;
  targetAssetIdentifier: string;
  generatedAt: Date;
  findings: ReportFindingInput[];
  sections?: ReportTemplateSection[];
};

const SEVERITY_LABELS: Record<Severity, string> = {
  UNASSESSED: "Unassessed",
  INFORMATIONAL: "Informational",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  DOMAIN: "Domain",
  APPLICATION: "Application",
  API: "API",
  IP_ASSET: "IP asset",
  LOCAL_LAB: "Local lab",
  OTHER: "Other",
};

function valueOrNotRecorded(value: string | null | undefined): string {
  return value && value.trim() ? value.trim() : "Not recorded.";
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

function sectionTitle(
  sections: readonly ReportTemplateSection[],
  id: ReportTemplateSectionId,
): string {
  return (
    sections.find((section) => section.id === id)?.title ??
    REPORT_TEMPLATE_SECTION_CATALOG[id].title
  );
}

function renderSummary(
  lines: string[],
  source: ReportSource,
  title: string,
): void {
  lines.push(`## ${title}`, "");
  lines.push(
    `This report documents ${source.findings.length} confirmed or reportable finding${
      source.findings.length === 1 ? "" : "s"
    } from the investigation **${escapeMarkdown(source.investigationTitle)}**.`,
    "",
  );
}

function renderFindings(lines: string[], source: ReportSource, title: string): void {
  lines.push(`## ${title}`, "");

  source.findings.forEach((finding, index) => {
    lines.push(`### ${index + 1}. ${escapeMarkdown(finding.title)}`, "");
    lines.push(`- **Severity:** ${SEVERITY_LABELS[finding.severity]}`);
    lines.push(`- **Status:** ${finding.status.replaceAll("_", " ").toLowerCase()}`);
    lines.push(`- **Category:** ${valueOrNotRecorded(finding.vulnerabilityCategory)}`);
    lines.push(
      `- **Affected asset:** ${valueOrNotRecorded(finding.affectedAsset)}${
        finding.affectedAssetType ? ` (${ASSET_TYPE_LABELS[finding.affectedAssetType]})` : ""
      }`,
    );
    lines.push("", "#### Description", "", escapeMarkdown(finding.description), "");
    lines.push("#### Impact", "", valueOrNotRecorded(finding.impact), "");
    lines.push("#### Remediation", "", valueOrNotRecorded(finding.remediation), "");
    lines.push("#### Severity rationale", "", valueOrNotRecorded(finding.severityRationale), "");

    lines.push("#### Evidence", "");
    if (finding.evidence.length === 0) {
      lines.push("No approved evidence is linked to this finding.", "");
      return;
    }

    for (const evidence of finding.evidence) {
      lines.push(
        `- **${evidence.relationshipType.toLowerCase()}**: ${escapeMarkdown(
          evidence.title,
        )} (${evidence.evidenceType.replaceAll("_", " ").toLowerCase()}, ${evidence.redactionStatus
          .replaceAll("_", " ")
          .toLowerCase()}, v${evidence.version}, SHA-256 \`${evidence.checksum}\`)`,
      );
    }
    lines.push("");
  });
}

function renderEvidenceReferences(
  lines: string[],
  source: ReportSource,
  title: string,
): void {
  lines.push(`## ${title}`, "");
  const allEvidence = source.findings.flatMap((finding) => finding.evidence);
  if (allEvidence.length === 0) {
    lines.push("No approved evidence references are recorded.", "");
    return;
  }

  for (const evidence of allEvidence) {
    lines.push(
      `- ${escapeMarkdown(evidence.title)} — ${evidence.evidenceType
        .replaceAll("_", " ")
        .toLowerCase()}, version ${evidence.version}, checksum \`${evidence.checksum}\`.`,
    );
  }
  lines.push("");
}

function renderAssumptions(lines: string[], title: string): void {
  lines.push(`## ${title}`, "");
  lines.push(
    "- This report includes only findings confirmed through the human verification workflow.",
    "- Evidence references reflect the versions recorded at report generation time.",
    "- Observations, hypotheses, and AI output that were not confirmed are excluded.",
    "",
  );
}

function renderMissingInformation(
  lines: string[],
  source: ReportSource,
  title: string,
): void {
  lines.push(`## ${title}`, "");
  const missing = source.findings.flatMap((finding) => {
    const gaps: string[] = [];
    if (!finding.impact?.trim()) {
      gaps.push(`${finding.title}: impact is not recorded.`);
    }
    if (!finding.remediation?.trim()) {
      gaps.push(`${finding.title}: remediation is not recorded.`);
    }
    if (!finding.severityRationale?.trim()) {
      gaps.push(`${finding.title}: severity rationale is not recorded.`);
    }
    return gaps;
  });

  if (missing.length === 0) {
    lines.push("No required sections are missing.", "");
    return;
  }

  for (const gap of missing) {
    lines.push(`- ${gap}`);
  }
  lines.push("");
}

function renderMethodology(lines: string[], title: string): void {
  lines.push(`## ${title}`, "");
  lines.push(
    "This report was assembled from findings that a human confirmed or marked reportable. Only evidence approved by a human reviewer is referenced, and AI output was not promoted to a finding automatically. A human reviewed the report before export.",
    "",
  );
}

function renderRecommendations(
  lines: string[],
  source: ReportSource,
  title: string,
): void {
  lines.push(`## ${title}`, "");
  for (const finding of source.findings) {
    lines.push(`- **${escapeMarkdown(finding.title)}:** ${valueOrNotRecorded(finding.remediation)}`);
  }
  lines.push("");
}

/**
 * Reports are human-owned documents. This renderer only assembles confirmed
 * findings and their approved evidence; it never calls AI (ADR-008).
 *
 * The section order comes from the selected report template. Templates cannot
 * remove the required sections, so every rendered report still labels findings,
 * evidence, assumptions, and missing information separately.
 */
export function renderReportMarkdown(source: ReportSource): string {
  const lines: string[] = [];
  const sections = parseReportTemplateSections(
    source.sections?.length ? source.sections : DEFAULT_REPORT_TEMPLATE_SECTIONS,
  );

  lines.push(`# ${escapeMarkdown(source.investigationTitle)}`, "");
  lines.push(`**Project:** ${escapeMarkdown(source.projectName)}`);
  lines.push(
    `**Target:** ${escapeMarkdown(source.targetName)} (${escapeMarkdown(source.targetAssetIdentifier)})`,
  );
  lines.push(`**Generated:** ${source.generatedAt.toISOString().slice(0, 10)}`, "");
  lines.push(
    "> This report includes only confirmed or reportable findings and evidence that a reviewer approved. Unverified observations and AI interpretations are excluded.",
    "",
  );

  for (const section of sections) {
    const title = sectionTitle(sections, section.id);

    switch (section.id) {
      case "summary":
        renderSummary(lines, source, title);
        break;
      case "findings":
        renderFindings(lines, source, title);
        break;
      case "evidence":
        renderEvidenceReferences(lines, source, title);
        break;
      case "assumptions":
        renderAssumptions(lines, title);
        break;
      case "missing-information":
        renderMissingInformation(lines, source, title);
        break;
      case "methodology":
        renderMethodology(lines, title);
        break;
      case "recommendations":
        renderRecommendations(lines, source, title);
        break;
    }
  }

  return (
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

export function reportReadinessProblems(source: ReportSource): string[] {
  const problems: string[] = [];

  if (source.findings.length === 0) {
    problems.push("Select at least one confirmed or reportable finding.");
  }

  for (const finding of source.findings) {
    if (finding.status !== "CONFIRMED" && finding.status !== "REPORTABLE") {
      problems.push(`"${finding.title}" is not confirmed or reportable.`);
    }

    if (finding.severity === "UNASSESSED") {
      problems.push(`"${finding.title}" has no severity assessment.`);
    }

    if (!finding.severityRationale?.trim()) {
      problems.push(`"${finding.title}" has no severity rationale.`);
    }

    if (!finding.affectedAsset?.trim() || !finding.affectedAssetType) {
      problems.push(`"${finding.title}" has no affected asset and type.`);
    }

    if (!finding.impact?.trim()) {
      problems.push(`"${finding.title}" has no impact statement.`);
    }

    if (!finding.remediation?.trim()) {
      problems.push(`"${finding.title}" has no remediation guidance.`);
    }

    if (!finding.evidence.some((item) => item.relationshipType === "SUPPORTS")) {
      problems.push(`"${finding.title}" has no supporting evidence.`);
    }
  }

  return problems;
}

export function reportFileName(title: string, format: ReportFormat = "MARKDOWN"): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "report"}.${format === "PDF" ? "pdf" : "md"}`;
}
