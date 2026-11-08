import { failure, type DomainResult } from "@/modules/shared/domain/result";

import {
  buildReportTemplateSections,
  canManageReportTemplates,
  canTransitionReport,
  isHumanReviewer,
  renderReportMarkdown,
  reportContentSchema,
  reportCreateSchema,
  reportFileName,
  reportReadinessProblems,
  reportTemplateCreateSchema,
  type ReportFindingInput,
  type ReportFormat,
  type ReportSource,
} from "../domain/report";
import { renderReportPdf } from "./pdf-renderer";
import type {
  ReportActor,
  ReportAuditDraft,
  ReportDetail,
  ReportEvidenceSnapshot,
  ReportFindingSnapshot,
  ReportInvestigationContext,
  ReportInvestigationOption,
  ReportRow,
  ReportStore,
  ReportTemplateRow,
} from "./ports";

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the report details and try again.";
}

function auditDraft(
  actor: ReportActor,
  action: ReportAuditDraft["action"],
  values: Omit<ReportAuditDraft, "workspaceId" | "userId" | "action" | "entityType">,
): ReportAuditDraft {
  return {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    action,
    entityType: "Report",
    ...values,
  };
}

function assertReportContextEditable(context: ReportInvestigationContext): DomainResult<true> {
  if (context.projectStatus === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "This project is archived, so its reports are read-only.");
  }

  if (context.investigationStatus === "ARCHIVED") {
    return failure(
      "INVESTIGATION_ARCHIVED",
      "This investigation is archived. You can revisit its history, but editing is closed.",
    );
  }

  return { ok: true, value: true };
}

export function buildSnapshots(findings: ReportFindingInput[]): {
  evidenceSnapshot: ReportEvidenceSnapshot[];
  findingSnapshot: ReportFindingSnapshot[];
} {
  const evidence = new Map<string, ReportEvidenceSnapshot>();
  const findingSnapshot: ReportFindingSnapshot[] = [];

  for (const finding of findings) {
    findingSnapshot.push({
      sourceUpdatedAt: finding.sourceUpdatedAt,
      findingId: finding.id,
      title: finding.title,
      status: finding.status,
      severity: finding.severity,
      affectedAsset: finding.affectedAsset,
      affectedAssetType: finding.affectedAssetType,
    });

    for (const item of finding.evidence) {
      evidence.set(`${finding.id}:${item.evidenceId}:${item.relationshipType}`, {
        findingId: finding.id,
        evidenceId: item.evidenceId,
        title: item.title,
        evidenceType: item.evidenceType,
        redactionStatus: item.redactionStatus,
        relationshipType: item.relationshipType,
        version: item.version,
        checksum: item.checksum,
      });
    }
  }

  return {
    evidenceSnapshot: [...evidence.values()],
    findingSnapshot,
  };
}

function orderedFindings(
  report: ReportDetail,
  findings: ReportFindingInput[],
): ReportFindingInput[] {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));

  return report.findings.flatMap((finding) => {
    const record = byId.get(finding.findingId);
    return record ? [record] : [];
  });
}

async function buildSource(
  store: ReportStore,
  workspaceId: string,
  report: ReportDetail,
  generatedAt: Date,
): Promise<{ source: ReportSource; context: ReportInvestigationContext } | null> {
  const context = await store.findInvestigation(workspaceId, report.investigationId);

  if (!context) {
    return null;
  }

  const findings = await store.listReportFindings(
    workspaceId,
    report.findings.map((finding) => finding.findingId),
  );
  const ordered = orderedFindings(report, findings);

  return {
    context,
    source: {
      investigationTitle: context.investigationTitle,
      projectName: context.projectName,
      targetName: context.targetName,
      targetAssetIdentifier: context.targetAssetIdentifier,
      generatedAt,
      findings: ordered,
    },
  };
}

function readinessFailure(source: ReportSource, report: ReportDetail): DomainResult<true> {
  if (source.findings.length !== report.findings.length) {
    return failure(
      "REPORT_FINDING_MISSING",
      "One of this report's findings is no longer available. Check the selected findings before continuing.",
    );
  }

  const problems = reportReadinessProblems(source);

  return problems.length > 0
    ? failure("REPORT_NOT_READY", problems.join(" "))
    : { ok: true, value: true };
}

export function listReports(
  store: ReportStore,
  workspaceId: string,
  investigationId?: string,
): Promise<ReportRow[]> {
  return store.listReports(workspaceId, investigationId);
}

export function listReportableInvestigations(
  store: ReportStore,
  workspaceId: string,
): Promise<ReportInvestigationOption[]> {
  return store.listReportableInvestigations(workspaceId);
}

export function getReport(
  store: ReportStore,
  workspaceId: string,
  reportId: string,
): Promise<ReportDetail | null> {
  return store.findReport(workspaceId, reportId);
}

export function listEligibleReportFindings(
  store: ReportStore,
  workspaceId: string,
  investigationId: string,
): Promise<ReportFindingInput[]> {
  return store.listEligibleFindings(workspaceId, investigationId);
}

export function getReportInvestigation(
  store: ReportStore,
  workspaceId: string,
  investigationId: string,
): Promise<ReportInvestigationContext | null> {
  return store.findInvestigation(workspaceId, investigationId);
}

export function listReportTemplates(
  store: ReportStore,
  workspaceId: string,
  options?: { activeOnly?: boolean },
): Promise<ReportTemplateRow[]> {
  return store.listReportTemplates(workspaceId, options);
}

export async function createReportTemplate(
  store: ReportStore,
  actor: ReportActor,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  if (!canManageReportTemplates(actor.role)) {
    return failure(
      "FORBIDDEN_REPORT_ACTOR",
      "Ask a workspace owner or administrator to manage report templates.",
    );
  }

  const parsed = reportTemplateCreateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const sections = buildReportTemplateSections(parsed.data.sectionIds);
  const template = await store.createReportTemplate(
    {
      workspaceId: actor.workspaceId,
      name: parsed.data.name,
      sections,
      createdBy: actor.userId,
    },
    auditDraft(actor, "REPORT_TEMPLATE_CREATED", {
      newValue: {
        name: parsed.data.name,
        sections: sections.map((section) => section.id),
      },
    }),
  );

  return { ok: true, value: { id: template.id } };
}

export async function setReportTemplateActive(
  store: ReportStore,
  actor: ReportActor,
  templateId: string,
  isActive: boolean,
): Promise<DomainResult<{ id: string }>> {
  if (!canManageReportTemplates(actor.role)) {
    return failure(
      "FORBIDDEN_REPORT_ACTOR",
      "Ask a workspace owner or administrator to manage report templates.",
    );
  }

  const updated = await store.setReportTemplateActive(
    actor.workspaceId,
    templateId,
    { isActive },
    auditDraft(actor, "REPORT_TEMPLATE_UPDATED", {
      newValue: { templateId, isActive },
    }),
  );

  if (!updated) {
    return failure(
      "REPORT_TEMPLATE_NOT_FOUND",
      "This template is unavailable or is a built-in layout. Choose a workspace template to manage.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

/**
 * Build a draft report from confirmed findings. The generated Markdown is a
 * starting point: saving a revision is what records a human edit.
 */
export async function createReport(
  store: ReportStore,
  actor: ReportActor,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = reportCreateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const investigation = await store.findInvestigation(
    actor.workspaceId,
    parsed.data.investigationId,
  );

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertReportContextEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  let template: ReportTemplateRow | null = null;

  if (parsed.data.templateId) {
    template = await store.findReportTemplate(actor.workspaceId, parsed.data.templateId);

    if (!template || !template.isActive) {
      return failure(
        "REPORT_TEMPLATE_NOT_FOUND",
        "This template isn't available in your workspace. Choose an available template and try again.",
      );
    }
  }

  const findingIds = [...new Set(parsed.data.findingIds)];
  const eligible = await store.listEligibleFindings(actor.workspaceId, parsed.data.investigationId);
  const eligibleById = new Map(eligible.map((finding) => [finding.id, finding]));
  const selected = findingIds.flatMap((findingId) => {
    const finding = eligibleById.get(findingId);
    return finding ? [finding] : [];
  });

  if (selected.length !== findingIds.length) {
    return failure(
      "REPORT_FINDING_NOT_ELIGIBLE",
      "Choose findings a human reviewer has confirmed or marked reportable. Other findings need verification first.",
    );
  }

  const source: ReportSource = {
    investigationTitle: investigation.investigationTitle,
    projectName: investigation.projectName,
    targetName: investigation.targetName,
    targetAssetIdentifier: investigation.targetAssetIdentifier,
    generatedAt: now,
    findings: selected,
    sections: template?.sections,
  };
  const problems = reportReadinessProblems(source);

  if (problems.length > 0) {
    return failure("REPORT_NOT_READY", problems.join(" "));
  }

  const snapshots = buildSnapshots(selected);
  const report = await store.createReport(
    {
      workspaceId: actor.workspaceId,
      investigationId: investigation.id,
      templateId: template?.id ?? null,
      title: parsed.data.title,
      createdBy: actor.userId,
      findingIds: selected.map((finding) => finding.id),
      content: renderReportMarkdown(source),
      evidenceSnapshot: snapshots.evidenceSnapshot,
      findingSnapshot: snapshots.findingSnapshot,
    },
    auditDraft(actor, "REPORT_CREATED", {
      newValue: {
        investigationId: investigation.id,
        title: parsed.data.title,
        status: "DRAFT",
        templateId: template?.id ?? null,
        templateName: template?.name ?? null,
        findingIds: selected.map((finding) => finding.id),
        evidenceCount: snapshots.evidenceSnapshot.length,
        revision: 1,
      },
    }),
  );

  return { ok: true, value: { id: report.id } };
}

export async function saveReportRevision(
  store: ReportStore,
  actor: ReportActor,
  reportId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = reportContentSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  if (report.status !== "DRAFT") {
    return failure("REPORT_LOCKED", "Return the report to draft before saving a new revision.");
  }

  const built = await buildSource(store, actor.workspaceId, report, now);

  if (!built) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find this report's investigation in the workspace. Reopen the report to check its research context.",
    );
  }

  const editable = assertReportContextEditable(built.context);

  if (!editable.ok) {
    return editable;
  }

  if (built.source.findings.length !== report.findings.length) {
    return failure(
      "REPORT_FINDING_MISSING",
      "One of this report's findings is no longer available. Check the selected findings before continuing.",
    );
  }

  const snapshots = buildSnapshots(built.source.findings);
  const saved = await store.addRevision(
    actor.workspaceId,
    reportId,
    {
      expectedRevision: report.latestRevisionVersion,
      expectedStatus: report.status,
      content: parsed.data.content,
      evidenceSnapshot: snapshots.evidenceSnapshot,
      findingSnapshot: snapshots.findingSnapshot,
      createdBy: actor.userId,
      generatedByType: "HUMAN",
    },
    auditDraft(actor, "REPORT_REVISION_SAVED", {
      newValue: {
        version: report.latestRevisionVersion + 1,
        findingCount: built.source.findings.length,
        evidenceCount: snapshots.evidenceSnapshot.length,
      },
    }),
  );

  if (!saved) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  return { ok: true, value: { id: saved.id } };
}

export async function submitReport(
  store: ReportStore,
  actor: ReportActor,
  reportId: string,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  if (!canTransitionReport(report.status, "UNDER_REVIEW")) {
    return failure(
      "REPORT_STATUS_INVALID",
      "Send reports for review from Draft. Check the report's current status before continuing.",
    );
  }

  const built = await buildSource(store, actor.workspaceId, report, now);

  if (!built) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find this report's investigation in the workspace. Reopen the report to check its research context.",
    );
  }

  const editable = assertReportContextEditable(built.context);

  if (!editable.ok) {
    return editable;
  }

  const ready = readinessFailure(built.source, report);

  if (!ready.ok) {
    return ready;
  }

  if (report.latestRevisionVersion < 1) {
    return failure(
      "REPORT_REVISION_MISSING",
      "Save a revision first, then send the report for review.",
    );
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    {
      expectedRevision: report.latestRevisionVersion,
      expectedStatus: report.status,
      status: "UNDER_REVIEW",
    },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "UNDER_REVIEW" },
    }),
  );

  if (!updated) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function approveReport(
  store: ReportStore,
  actor: ReportActor,
  reportId: string,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  if (!isHumanReviewer(actor.role)) {
    return failure(
      "FORBIDDEN_REPORT_ACTOR",
      "Ask a human reviewer to check and approve this report.",
    );
  }

  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  if (!canTransitionReport(report.status, "APPROVED")) {
    return failure(
      "REPORT_STATUS_INVALID",
      "Send the report for review before asking a human reviewer to approve it.",
    );
  }

  const built = await buildSource(store, actor.workspaceId, report, now);

  if (!built) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find this report's investigation in the workspace. Reopen the report to check its research context.",
    );
  }

  const editable = assertReportContextEditable(built.context);

  if (!editable.ok) {
    return editable;
  }

  const ready = readinessFailure(built.source, report);

  if (!ready.ok) {
    return ready;
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    {
      expectedRevision: report.latestRevisionVersion,
      expectedStatus: report.status,
      status: "APPROVED",
      approvedBy: actor.userId,
      approvedAt: now,
    },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "APPROVED", approvedBy: actor.userId, approvedAt: now.toISOString() },
    }),
  );

  if (!updated) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function reopenReport(
  store: ReportStore,
  actor: ReportActor,
  reportId: string,
): Promise<DomainResult<{ id: string }>> {
  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  if (!canTransitionReport(report.status, "DRAFT")) {
    return failure(
      "REPORT_STATUS_INVALID",
      "You can return a report to Draft while it's Under review. Check its current status first.",
    );
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    {
      expectedRevision: report.latestRevisionVersion,
      expectedStatus: report.status,
      status: "DRAFT",
    },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "DRAFT" },
    }),
  );

  if (!updated) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function archiveReport(
  store: ReportStore,
  actor: ReportActor,
  reportId: string,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  if (!canTransitionReport(report.status, "ARCHIVED")) {
    return failure("REPORT_STATUS_INVALID", "This report cannot be archived.");
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    {
      expectedRevision: report.latestRevisionVersion,
      expectedStatus: report.status,
      status: "ARCHIVED",
      archivedAt: now,
    },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "ARCHIVED", archivedAt: now.toISOString() },
    }),
  );

  if (!updated) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export type ReportExport = {
  fileName: string;
  format: ReportFormat;
  contentType: string;
  body: string | Uint8Array;
};

export function reportExportContentType(format: ReportFormat): string {
  return format === "PDF" ? "application/pdf" : "text/markdown; charset=utf-8";
}

async function buildReportExport(
  report: ReportDetail,
  format: ReportFormat,
): Promise<ReportExport> {
  const revision = report.revisions[0];

  if (!revision) {
    throw new Error("Save a revision and get it approved before exporting this report.");
  }

  return {
    fileName: reportFileName(report.title, format),
    format,
    contentType: reportExportContentType(format),
    body:
      format === "PDF" ? await renderReportPdf(revision.content, report.title) : revision.content,
  };
}

export async function exportReport(
  store: ReportStore,
  actor: ReportActor,
  reportId: string,
  format: ReportFormat = "MARKDOWN",
): Promise<DomainResult<ReportExport>> {
  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure(
      "REPORT_NOT_FOUND",
      "We can't find that report in this workspace. Open Reports to choose an available one.",
    );
  }

  if (report.status !== "APPROVED" && report.status !== "EXPORTED") {
    return failure("REPORT_NOT_APPROVED", "Get human approval for the report before exporting it.");
  }

  if (report.revisions.length === 0) {
    return failure(
      "REPORT_REVISION_MISSING",
      "Save a revision and get it approved before exporting this report.",
    );
  }

  const result = await buildReportExport(report, format);
  const revision = report.revisions[0];

  if (report.status === "APPROVED") {
    const updated = await store.transitionReport(
      actor.workspaceId,
      reportId,
      {
        expectedRevision: report.latestRevisionVersion,
        expectedStatus: report.status,
        status: "EXPORTED",
      },
      auditDraft(actor, "REPORT_EXPORTED", {
        previousValue: { status: report.status },
        newValue: {
          status: "EXPORTED",
          revision: revision?.version ?? null,
          format,
          fileName: result.fileName,
        },
      }),
    );

    if (!updated) {
      return failure(
        "REPORT_NOT_FOUND",
        "We can't find that report in this workspace. Open Reports to choose an available one.",
      );
    }
  }

  return { ok: true, value: result };
}

/**
 * Read an approved export without changing report state. The Server Action is
 * responsible for recording the export event before redirecting here.
 */
export async function readReportExport(
  store: ReportStore,
  workspaceId: string,
  reportId: string,
  format: ReportFormat = "MARKDOWN",
): Promise<ReportExport | null> {
  const report = await store.findReport(workspaceId, reportId);

  if (!report || report.status !== "EXPORTED") {
    return null;
  }

  if (report.revisions.length === 0) {
    return null;
  }

  return buildReportExport(report, format);
}
