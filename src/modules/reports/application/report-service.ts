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
    return failure("PROJECT_ARCHIVED", "Reports in an archived project cannot be changed.");
  }

  if (context.investigationStatus === "ARCHIVED") {
    return failure("INVESTIGATION_ARCHIVED", "An archived investigation cannot be changed.");
  }

  return { ok: true, value: true };
}

function buildSnapshots(findings: ReportFindingInput[]): {
  evidenceSnapshot: ReportEvidenceSnapshot[];
  findingSnapshot: ReportFindingSnapshot[];
} {
  const evidence = new Map<string, ReportEvidenceSnapshot>();
  const findingSnapshot: ReportFindingSnapshot[] = [];

  for (const finding of findings) {
    findingSnapshot.push({
      findingId: finding.id,
      title: finding.title,
      status: finding.status,
      severity: finding.severity,
      affectedAsset: finding.affectedAsset,
      affectedAssetType: finding.affectedAssetType,
    });

    for (const item of finding.evidence) {
      evidence.set(item.evidenceId, {
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
      "A finding selected for this report no longer exists in the workspace.",
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
      "Only an owner or administrator can manage workspace report templates.",
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
        version: 0,
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
      "Only an owner or administrator can manage workspace report templates.",
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
      "That workspace template does not exist or is a system template.",
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
      "That investigation does not exist in this workspace.",
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
        "The selected report template is not available in this workspace.",
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
      "Only confirmed or reportable findings can be included in a report.",
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
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
  }

  if (report.status !== "DRAFT") {
    return failure("REPORT_LOCKED", "Return the report to draft before saving a new revision.");
  }

  const built = await buildSource(store, actor.workspaceId, report, now);

  if (!built) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "The investigation for this report does not exist in this workspace.",
    );
  }

  const editable = assertReportContextEditable(built.context);

  if (!editable.ok) {
    return editable;
  }

  if (built.source.findings.length !== report.findings.length) {
    return failure(
      "REPORT_FINDING_MISSING",
      "A finding selected for this report no longer exists in the workspace.",
    );
  }

  const snapshots = buildSnapshots(built.source.findings);
  const saved = await store.addRevision(
    actor.workspaceId,
    reportId,
    {
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
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
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
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
  }

  if (!canTransitionReport(report.status, "UNDER_REVIEW")) {
    return failure("REPORT_STATUS_INVALID", "Only a draft report can be submitted for review.");
  }

  const built = await buildSource(store, actor.workspaceId, report, now);

  if (!built) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "The investigation for this report does not exist in this workspace.",
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
    return failure("REPORT_REVISION_MISSING", "Save a report revision before submitting it.");
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    { status: "UNDER_REVIEW" },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "UNDER_REVIEW" },
    }),
  );

  if (!updated) {
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
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
    return failure("FORBIDDEN_REPORT_ACTOR", "A human reviewer must approve a report.");
  }

  const report = await store.findReport(actor.workspaceId, reportId);

  if (!report) {
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
  }

  if (!canTransitionReport(report.status, "APPROVED")) {
    return failure("REPORT_STATUS_INVALID", "Only a report under review can be approved.");
  }

  const built = await buildSource(store, actor.workspaceId, report, now);

  if (!built) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "The investigation for this report does not exist in this workspace.",
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
    { status: "APPROVED", approvedBy: actor.userId, approvedAt: now },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "APPROVED", approvedBy: actor.userId, approvedAt: now.toISOString() },
    }),
  );

  if (!updated) {
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
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
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
  }

  if (!canTransitionReport(report.status, "DRAFT")) {
    return failure("REPORT_STATUS_INVALID", "Only a report under review can be returned to draft.");
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    { status: "DRAFT" },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "DRAFT" },
    }),
  );

  if (!updated) {
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
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
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
  }

  if (!canTransitionReport(report.status, "ARCHIVED")) {
    return failure("REPORT_STATUS_INVALID", "This report cannot be archived.");
  }

  const updated = await store.transitionReport(
    actor.workspaceId,
    reportId,
    { status: "ARCHIVED", archivedAt: now },
    auditDraft(actor, "REPORT_STATUS_CHANGED", {
      previousValue: { status: report.status },
      newValue: { status: "ARCHIVED", archivedAt: now.toISOString() },
    }),
  );

  if (!updated) {
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
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
    throw new Error("This report has no saved revision to export.");
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
    return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
  }

  if (report.status !== "APPROVED" && report.status !== "EXPORTED") {
    return failure("REPORT_NOT_APPROVED", "Only an approved report can be exported.");
  }

  if (report.revisions.length === 0) {
    return failure("REPORT_REVISION_MISSING", "This report has no saved revision to export.");
  }

  const result = await buildReportExport(report, format);
  const revision = report.revisions[0];

  if (report.status === "APPROVED") {
    const updated = await store.transitionReport(
      actor.workspaceId,
      reportId,
      { status: "EXPORTED" },
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
      return failure("REPORT_NOT_FOUND", "That report does not exist in this workspace.");
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

  if (!report || (report.status !== "APPROVED" && report.status !== "EXPORTED")) {
    return null;
  }

  if (report.revisions.length === 0) {
    return null;
  }

  return buildReportExport(report, format);
}
