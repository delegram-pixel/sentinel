import type { AuditEvent } from "@/modules/audit/domain/audit";
import type {
  EvidenceLinkRelationship,
  EvidenceType,
  RedactionStatus,
} from "@/modules/evidence/domain/evidence";
import type { FindingStatus } from "@/modules/findings/domain/finding-status";
import type { AssetType } from "@/modules/research/domain/target";
import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";

import type {
  ReportFindingInput,
  ReportFormat,
  ReportStatus,
  ReportTemplateSection,
} from "../domain/report";

export type ReportActor = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type ReportAuditDraft = Omit<AuditEvent, "entityId">;

export type ReportInvestigationContext = {
  id: string;
  workspaceId: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  investigationTitle: string;
  investigationStatus: string;
  targetName: string;
  targetAssetIdentifier: string;
};

export type ReportInvestigationOption = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  eligibleFindingCount: number;
};

export type ReportEvidenceSnapshot = {
  findingId?: string;
  evidenceId: string;
  title: string;
  evidenceType: EvidenceType;
  redactionStatus: RedactionStatus;
  relationshipType: EvidenceLinkRelationship;
  version: number;
  checksum: string;
};

export type ReportFindingSnapshot = {
  sourceUpdatedAt?: string;
  findingId: string;
  title: string;
  status: FindingStatus;
  severity: string;
  affectedAsset: string | null;
  affectedAssetType: AssetType | null;
};

export type ReportTemplateRow = {
  id: string;
  workspaceId: string | null;
  name: string;
  version: number;
  scope: "SYSTEM" | "WORKSPACE";
  sections: ReportTemplateSection[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportTemplateCreateData = {
  workspaceId: string;
  name: string;
  sections: ReportTemplateSection[];
  createdBy: string;
};

export type ReportTemplateStatusData = {
  isActive: boolean;
};

export type ReportRow = {
  id: string;
  workspaceId: string;
  investigationId: string;
  investigationTitle: string;
  projectId: string;
  templateId: string | null;
  templateName: string | null;
  templateVersion: number | null;
  title: string;
  status: ReportStatus;
  format: ReportFormat;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  archivedAt: Date | null;
  findingCount: number;
  latestRevisionVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportRevisionRow = {
  sourceTaskId?: string | null;
  id: string;
  reportId: string;
  version: number;
  content: string;
  evidenceSnapshot: ReportEvidenceSnapshot[];
  findingSnapshot: ReportFindingSnapshot[];
  generatedByType: "HUMAN" | "AI_ASSISTED";
  model: string | null;
  promptVersion: string | null;
  createdBy: string | null;
  createdAt: Date;
};

export type ReportFindingRow = {
  findingId: string;
  title: string;
  status: FindingStatus;
  position: number;
};

export type ReportDetail = ReportRow & {
  findings: ReportFindingRow[];
  revisions: ReportRevisionRow[];
};

export type ReportCreateData = {
  workspaceId: string;
  investigationId: string;
  templateId?: string | null;
  title: string;
  createdBy: string;
  findingIds: string[];
  content: string;
  evidenceSnapshot: ReportEvidenceSnapshot[];
  findingSnapshot: ReportFindingSnapshot[];
};

export type ReportRevisionData = {
  sourceTaskId?: string | null;
  expectedRevision?: number;
  expectedStatus?: ReportStatus;
  content: string;
  evidenceSnapshot: ReportEvidenceSnapshot[];
  findingSnapshot: ReportFindingSnapshot[];
  createdBy: string;
  generatedByType: "HUMAN" | "AI_ASSISTED";
  model?: string | null;
  promptVersion?: string | null;
};

export type ReportTransitionData = {
  expectedRevision?: number;
  expectedStatus?: ReportStatus;
  status: ReportStatus;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  archivedAt?: Date | null;
};

export type ReportStore = {
  findInvestigation(
    workspaceId: string,
    investigationId: string,
  ): Promise<ReportInvestigationContext | null>;
  listReportableInvestigations(workspaceId: string): Promise<ReportInvestigationOption[]>;
  listEligibleFindings(workspaceId: string, investigationId: string): Promise<ReportFindingInput[]>;
  listReportFindings(workspaceId: string, findingIds: string[]): Promise<ReportFindingInput[]>;
  listReports(workspaceId: string, investigationId?: string): Promise<ReportRow[]>;
  findReport(workspaceId: string, reportId: string): Promise<ReportDetail | null>;
  listReportTemplates(
    workspaceId: string,
    options?: { activeOnly?: boolean },
  ): Promise<ReportTemplateRow[]>;
  findReportTemplate(workspaceId: string, templateId: string): Promise<ReportTemplateRow | null>;
  createReportTemplate(
    data: ReportTemplateCreateData,
    audit: ReportAuditDraft,
  ): Promise<ReportTemplateRow>;
  setReportTemplateActive(
    workspaceId: string,
    templateId: string,
    data: ReportTemplateStatusData,
    audit: ReportAuditDraft,
  ): Promise<ReportTemplateRow | null>;
  createReport(data: ReportCreateData, audit: ReportAuditDraft): Promise<ReportDetail>;
  addRevision(
    workspaceId: string,
    reportId: string,
    data: ReportRevisionData,
    audit: ReportAuditDraft,
  ): Promise<ReportDetail | null>;
  transitionReport(
    workspaceId: string,
    reportId: string,
    data: ReportTransitionData,
    audit: ReportAuditDraft,
  ): Promise<ReportDetail | null>;
  recordAudit(event: AuditEvent): Promise<void>;
};
