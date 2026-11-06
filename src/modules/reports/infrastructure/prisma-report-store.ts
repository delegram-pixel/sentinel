import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { AuditEvent } from "@/modules/audit/domain/audit";
import type {
  EvidenceLinkRelationship,
  EvidenceType,
  RedactionStatus,
} from "@/modules/evidence/domain/evidence";
import type { FindingStatus } from "@/modules/findings/domain/finding-status";
import type { Severity } from "@/modules/findings/domain/finding";
import type { AssetType } from "@/modules/research/domain/target";

import {
  parseReportTemplateSections,
  type ReportFindingInput,
  type ReportFormat,
  type ReportStatus,
} from "../domain/report";
import type {
  ReportAuditDraft,
  ReportCreateData,
  ReportDetail,
  ReportEvidenceSnapshot,
  ReportFindingSnapshot,
  ReportInvestigationContext,
  ReportInvestigationOption,
  ReportRevisionData,
  ReportRevisionRow,
  ReportRow,
  ReportStore,
  ReportTemplateCreateData,
  ReportTemplateRow,
  ReportTemplateStatusData,
  ReportTransitionData,
} from "../application/ports";

type Db = Prisma.TransactionClient;

const ELIGIBLE_FINDING_STATUSES = ["CONFIRMED", "REPORTABLE"] as const;
const APPROVED_REDACTION_STATUSES = ["REDACTED", "VERIFIED_SAFE"] as const;

const reportListSelect = {
  id: true,
  workspaceId: true,
  investigationId: true,
  templateId: true,
  title: true,
  status: true,
  format: true,
  createdBy: true,
  approvedBy: true,
  approvedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  investigation: { select: { title: true, projectId: true } },
  template: { select: { name: true, version: true } },
  _count: { select: { findings: true } },
  revisions: {
    orderBy: { version: "desc" },
    take: 1,
    select: { version: true },
  },
} satisfies Prisma.ReportSelect;

type ReportListRecord = Prisma.ReportGetPayload<{ select: typeof reportListSelect }>;

const reportDetailSelect = {
  ...reportListSelect,
  findings: {
    orderBy: { position: "asc" },
    select: {
      findingId: true,
      position: true,
      finding: { select: { title: true, status: true } },
    },
  },
  revisions: {
    orderBy: { version: "desc" },
    select: {
      id: true,
      reportId: true,
      version: true,
      content: true,
      evidenceSnapshot: true,
      findingSnapshot: true,
      generatedByType: true,
      model: true,
      promptVersion: true,
      createdBy: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ReportSelect;

type ReportDetailRecord = Prisma.ReportGetPayload<{ select: typeof reportDetailSelect }>;

const reportFindingSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  severity: true,
  severityRationale: true,
  vulnerabilityCategory: true,
  affectedAsset: true,
  affectedAssetType: true,
  impact: true,
  remediation: true,
  evidenceLinks: {
    orderBy: { createdAt: "asc" },
    where: {
      evidence: {
        deletedAt: null,
        redactionStatus: { in: [...APPROVED_REDACTION_STATUSES] },
      },
    },
    select: {
      relationshipType: true,
      evidence: {
        select: {
          id: true,
          title: true,
          evidenceType: true,
          redactionStatus: true,
          version: true,
          checksum: true,
        },
      },
    },
  },
} satisfies Prisma.FindingSelect;

type ReportFindingRecord = Prisma.FindingGetPayload<{ select: typeof reportFindingSelect }>;

function auditRow(event: ReportAuditDraft, entityId: string): Prisma.AuditLogCreateInput {
  return {
    workspace: { connect: { id: event.workspaceId } },
    user: { connect: { id: event.userId } },
    action: event.action,
    entityType: event.entityType,
    entityId,
    previousValue: event.previousValue as Prisma.InputJsonValue | undefined,
    newValue: event.newValue as Prisma.InputJsonValue | undefined,
    metadata: event.metadata as Prisma.InputJsonValue | undefined,
  };
}

function evidenceSnapshots(value: Prisma.JsonValue): ReportEvidenceSnapshot[] {
  return Array.isArray(value) ? (value as unknown as ReportEvidenceSnapshot[]) : [];
}

function findingSnapshots(value: Prisma.JsonValue): ReportFindingSnapshot[] {
  return Array.isArray(value) ? (value as unknown as ReportFindingSnapshot[]) : [];
}

function mapReport(record: ReportListRecord): ReportRow {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    investigationId: record.investigationId,
    investigationTitle: record.investigation.title,
    projectId: record.investigation.projectId,
    templateId: record.templateId,
    templateName: record.template?.name ?? null,
    templateVersion: record.template?.version ?? null,
    title: record.title,
    status: record.status as ReportStatus,
    format: record.format as ReportFormat,
    createdBy: record.createdBy,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    archivedAt: record.archivedAt,
    findingCount: record._count.findings,
    latestRevisionVersion: record.revisions[0]?.version ?? 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapRevision(record: ReportDetailRecord["revisions"][number]): ReportRevisionRow {
  return {
    id: record.id,
    reportId: record.reportId,
    version: record.version,
    content: record.content,
    evidenceSnapshot: evidenceSnapshots(record.evidenceSnapshot),
    findingSnapshot: findingSnapshots(record.findingSnapshot),
    generatedByType: record.generatedByType as ReportRevisionRow["generatedByType"],
    model: record.model,
    promptVersion: record.promptVersion,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
  };
}

function mapReportDetail(record: ReportDetailRecord): ReportDetail {
  return {
    ...mapReport(record),
    findings: record.findings.map((finding) => ({
      findingId: finding.findingId,
      title: finding.finding.title,
      status: finding.finding.status as FindingStatus,
      position: finding.position,
    })),
    revisions: record.revisions.map(mapRevision),
  };
}

const reportTemplateSelect = {
  id: true,
  workspaceId: true,
  name: true,
  version: true,
  scope: true,
  sectionSchema: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReportTemplateSelect;

type ReportTemplateRecord = Prisma.ReportTemplateGetPayload<{ select: typeof reportTemplateSelect }>;

function mapReportTemplate(record: ReportTemplateRecord): ReportTemplateRow {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    version: record.version,
    scope: record.scope,
    sections: parseReportTemplateSections(record.sectionSchema),
    isActive: record.isActive,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapReportFinding(record: ReportFindingRecord): ReportFindingInput {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status as FindingStatus,
    severity: record.severity as Severity,
    severityRationale: record.severityRationale,
    vulnerabilityCategory: record.vulnerabilityCategory,
    affectedAsset: record.affectedAsset,
    affectedAssetType: record.affectedAssetType as AssetType | null,
    impact: record.impact,
    remediation: record.remediation,
    evidence: record.evidenceLinks.map((link) => ({
      evidenceId: link.evidence.id,
      title: link.evidence.title,
      evidenceType: link.evidence.evidenceType as EvidenceType,
      redactionStatus: link.evidence.redactionStatus as RedactionStatus,
      relationshipType: link.relationshipType as EvidenceLinkRelationship,
      version: link.evidence.version,
      checksum: link.evidence.checksum,
    })),
  };
}

export class PrismaReportStore implements ReportStore {
  constructor(private readonly db: Db) {}

  async listReportableInvestigations(workspaceId: string): Promise<ReportInvestigationOption[]> {
    const records = await this.db.investigation.findMany({
      where: {
        workspaceId,
        status: { not: "ARCHIVED" },
        project: { status: { not: "ARCHIVED" } },
        findings: { some: { status: { in: [...ELIGIBLE_FINDING_STATUSES] } } },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { name: true } },
        _count: {
          select: {
            findings: { where: { status: { in: [...ELIGIBLE_FINDING_STATUSES] } } },
          },
        },
      },
    });

    return records.map((record) => ({
      id: record.id,
      title: record.title,
      projectId: record.projectId,
      projectName: record.project.name,
      eligibleFindingCount: record._count.findings,
    }));
  }

  async findInvestigation(
    workspaceId: string,
    investigationId: string,
  ): Promise<ReportInvestigationContext | null> {
    const investigation = await this.db.investigation.findFirst({
      where: { id: investigationId, workspaceId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        title: true,
        status: true,
        project: { select: { name: true, status: true } },
        target: { select: { name: true, assetIdentifier: true } },
      },
    });

    if (!investigation) {
      return null;
    }

    return {
      id: investigation.id,
      workspaceId: investigation.workspaceId,
      projectId: investigation.projectId,
      projectName: investigation.project.name,
      projectStatus: investigation.project.status,
      investigationTitle: investigation.title,
      investigationStatus: investigation.status,
      targetName: investigation.target.name,
      targetAssetIdentifier: investigation.target.assetIdentifier,
    };
  }

  async listEligibleFindings(
    workspaceId: string,
    investigationId: string,
  ): Promise<ReportFindingInput[]> {
    const records = await this.db.finding.findMany({
      where: {
        workspaceId,
        investigationId,
        status: { in: [...ELIGIBLE_FINDING_STATUSES] },
      },
      orderBy: { updatedAt: "desc" },
      select: reportFindingSelect,
    });

    return records.map(mapReportFinding);
  }

  async listReportFindings(
    workspaceId: string,
    findingIds: string[],
  ): Promise<ReportFindingInput[]> {
    if (findingIds.length === 0) {
      return [];
    }

    const records = await this.db.finding.findMany({
      where: { workspaceId, id: { in: findingIds } },
      select: reportFindingSelect,
    });

    return records.map(mapReportFinding);
  }

  async listReports(workspaceId: string, investigationId?: string): Promise<ReportRow[]> {
    const records = await this.db.report.findMany({
      where: {
        workspaceId,
        ...(investigationId ? { investigationId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: reportListSelect,
    });

    return records.map(mapReport);
  }

  async findReport(workspaceId: string, reportId: string): Promise<ReportDetail | null> {
    const record = await this.db.report.findFirst({
      where: { id: reportId, workspaceId },
      select: reportDetailSelect,
    });

    return record ? mapReportDetail(record) : null;
  }

  async listReportTemplates(
    workspaceId: string,
    options?: { activeOnly?: boolean },
  ): Promise<ReportTemplateRow[]> {
    const records = await this.db.reportTemplate.findMany({
      where: {
        AND: [
          {
            OR: [
              { scope: "SYSTEM", workspaceId: null },
              { scope: "WORKSPACE", workspaceId },
            ],
          },
          ...(options?.activeOnly ? [{ isActive: true }] : []),
        ],
      },
      orderBy: [{ scope: "asc" }, { name: "asc" }, { version: "desc" }],
      select: reportTemplateSelect,
    });

    return records.map(mapReportTemplate);
  }

  async findReportTemplate(
    workspaceId: string,
    templateId: string,
  ): Promise<ReportTemplateRow | null> {
    const record = await this.db.reportTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { scope: "SYSTEM", workspaceId: null },
          { scope: "WORKSPACE", workspaceId },
        ],
      },
      select: reportTemplateSelect,
    });

    return record ? mapReportTemplate(record) : null;
  }

  async createReportTemplate(
    data: ReportTemplateCreateData,
    audit: ReportAuditDraft,
  ): Promise<ReportTemplateRow> {
    const templateId = await this.db.$transaction(async (tx) => {
      const latest = await tx.reportTemplate.findFirst({
        where: { workspaceId: data.workspaceId, name: data.name },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const template = await tx.reportTemplate.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          version: (latest?.version ?? 0) + 1,
          scope: "WORKSPACE",
          sectionSchema: data.sections as unknown as Prisma.InputJsonValue,
          isActive: true,
          createdBy: data.createdBy,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: auditRow(audit, template.id) });

      return template.id;
    });

    const created = await this.db.reportTemplate.findUnique({
      where: { id: templateId },
      select: reportTemplateSelect,
    });

    if (!created) {
      throw new Error("The report template was created but could not be read back.");
    }

    return mapReportTemplate(created);
  }

  async setReportTemplateActive(
    workspaceId: string,
    templateId: string,
    data: ReportTemplateStatusData,
    audit: ReportAuditDraft,
  ): Promise<ReportTemplateRow | null> {
    const updated = await this.db.$transaction(async (tx) => {
      const existing = await tx.reportTemplate.findFirst({
        where: { id: templateId, workspaceId, scope: "WORKSPACE" },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await tx.reportTemplate.update({
        where: { id: templateId },
        data: { isActive: data.isActive },
      });

      await tx.auditLog.create({ data: auditRow(audit, templateId) });

      return true;
    });

    if (!updated) {
      return null;
    }

    const record = await this.db.reportTemplate.findUnique({
      where: { id: templateId },
      select: reportTemplateSelect,
    });

    return record ? mapReportTemplate(record) : null;
  }

  async createReport(data: ReportCreateData, audit: ReportAuditDraft): Promise<ReportDetail> {
    const reportId = await this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: data.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const findings = await tx.finding.findMany({
        where: {
          id: { in: data.findingIds },
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
        },
        select: { id: true },
      });

      if (findings.length !== data.findingIds.length) {
        throw new Error("Every report finding must belong to the report investigation.");
      }

      const report = await tx.report.create({
        data: {
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
          templateId: data.templateId ?? null,
          title: data.title,
          format: "MARKDOWN",
          createdBy: data.createdBy,
        },
        select: { id: true },
      });

      await tx.reportFinding.createMany({
        data: data.findingIds.map((findingId, position) => ({
          reportId: report.id,
          findingId,
          position,
        })),
      });

      await tx.reportRevision.create({
        data: {
          reportId: report.id,
          version: 1,
          content: data.content,
          evidenceSnapshot: data.evidenceSnapshot as unknown as Prisma.InputJsonValue,
          findingSnapshot: data.findingSnapshot as unknown as Prisma.InputJsonValue,
          generatedByType: "HUMAN",
          createdBy: data.createdBy,
        },
      });

      await tx.auditLog.create({ data: auditRow(audit, report.id) });

      return report.id;
    });

    const detail = await this.findReport(data.workspaceId, reportId);

    if (!detail) {
      throw new Error("The report was created but could not be read back.");
    }

    return detail;
  }

  async addRevision(
    workspaceId: string,
    reportId: string,
    data: ReportRevisionData,
    audit: ReportAuditDraft,
  ): Promise<ReportDetail | null> {
    const created = await this.db.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: { id: reportId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      const latest = await tx.reportRevision.findFirst({
        where: { reportId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      await tx.reportRevision.create({
        data: {
          reportId,
          version: (latest?.version ?? 0) + 1,
          content: data.content,
          evidenceSnapshot: data.evidenceSnapshot as unknown as Prisma.InputJsonValue,
          findingSnapshot: data.findingSnapshot as unknown as Prisma.InputJsonValue,
          generatedByType: data.generatedByType,
          model: data.model ?? null,
          promptVersion: data.promptVersion ?? null,
          createdBy: data.createdBy,
        },
      });

      await tx.report.update({
        where: { id: reportId },
        data: { updatedAt: new Date() },
      });

      await tx.auditLog.create({ data: auditRow(audit, reportId) });

      return true;
    });

    return created ? this.findReport(workspaceId, reportId) : null;
  }

  async transitionReport(
    workspaceId: string,
    reportId: string,
    data: ReportTransitionData,
    audit: ReportAuditDraft,
  ): Promise<ReportDetail | null> {
    const updated = await this.db.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: { id: reportId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await tx.report.update({
        where: { id: reportId },
        data: {
          status: data.status,
          ...(data.approvedBy !== undefined ? { approvedBy: data.approvedBy } : {}),
          ...(data.approvedAt !== undefined ? { approvedAt: data.approvedAt } : {}),
          ...(data.archivedAt !== undefined ? { archivedAt: data.archivedAt } : {}),
        },
      });

      await tx.auditLog.create({ data: auditRow(audit, reportId) });

      return true;
    });

    return updated ? this.findReport(workspaceId, reportId) : null;
  }

  async recordAudit(event: AuditEvent): Promise<void> {
    await this.db.auditLog.create({
      data: {
        workspace: { connect: { id: event.workspaceId } },
        user: { connect: { id: event.userId } },
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        previousValue: event.previousValue as Prisma.InputJsonValue | undefined,
        newValue: event.newValue as Prisma.InputJsonValue | undefined,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
