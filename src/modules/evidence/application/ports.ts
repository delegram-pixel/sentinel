import type { AuditEvent } from "@/modules/audit/domain/audit";

import type { FindingStatus } from "@/modules/findings/domain/finding-status";

import type {
  EvidenceLinkRelationship,
  EvidenceType,
  RedactionMethod,
  RedactionStatus,
} from "../domain/evidence";

export type EvidenceAuditDraft = Omit<AuditEvent, "entityId">;

export type EvidenceInvestigationContext = {
  id: string;
  workspaceId: string;
  projectId: string;
  projectStatus: string;
  investigationStatus: string;
};

export type EvidenceRow = {
  id: string;
  workspaceId: string;
  investigationId: string;
  investigationTitle: string;
  projectId: string;
  evidenceType: EvidenceType;
  title: string;
  description: string | null;
  fileName: string;
  storageKey: string | null;
  quarantineKey: string | null;
  mimeType: string;
  fileSize: number;
  checksum: string;
  source: string | null;
  redactionStatus: RedactionStatus;
  redactionMethod: RedactionMethod;
  scanFindings: unknown;
  uploadedBy: string;
  redactionReviewedBy: string | null;
  redactionReviewedAt: Date | null;
  activatedAt: Date | null;
  version: number;
  supersedesId: string | null;
  deletedAt: Date | null;
  findingLinkCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type EvidenceFindingLinkRow = {
  id: string;
  findingId: string;
  findingTitle: string;
  findingStatus: FindingStatus;
  relationshipType: EvidenceLinkRelationship;
  createdAt: Date;
};

export type EvidenceDetail = EvidenceRow & {
  findingLinks: EvidenceFindingLinkRow[];
};

export type EvidenceCreateData = {
  id: string;
  workspaceId: string;
  investigationId: string;
  evidenceType: EvidenceType;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  source?: string;
  quarantineKey: string;
  uploadedBy: string;
};

export type EvidenceFinalizeData = {
  mimeType: string;
  fileSize: number;
  checksum: string;
  scanFindings: unknown;
  redactionStatus: RedactionStatus;
};

export type EvidenceMetadataUpdateData = {
  title: string;
  description?: string | null;
  evidenceType: EvidenceType;
  source?: string | null;
};

export type EvidenceActivationData = {
  storageKey: string;
  redactionStatus: RedactionStatus;
  redactionMethod: RedactionMethod;
  redactionReviewedBy: string;
  redactionReviewedAt: Date;
  activatedAt: Date;
};

export type EvidenceLinkCreateData = {
  workspaceId: string;
  evidenceId: string;
  findingId: string;
  relationshipType: EvidenceLinkRelationship;
};

export type EvidenceFindingLookup = {
  id: string;
  investigationId: string;
  status: FindingStatus;
};

export type EvidenceStore = {
  findInvestigation(
    workspaceId: string,
    investigationId: string,
  ): Promise<EvidenceInvestigationContext | null>;
  createEvidence(data: EvidenceCreateData, audit: EvidenceAuditDraft): Promise<EvidenceRow>;
  findEvidence(workspaceId: string, evidenceId: string): Promise<EvidenceDetail | null>;
  updateEvidenceMetadata(
    workspaceId: string,
    evidenceId: string,
    data: EvidenceMetadataUpdateData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null>;
  finalizeEvidence(
    workspaceId: string,
    evidenceId: string,
    data: EvidenceFinalizeData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null>;
  activateEvidence(
    workspaceId: string,
    evidenceId: string,
    data: EvidenceActivationData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null>;
  rejectEvidence(
    workspaceId: string,
    evidenceId: string,
    now: Date,
    note: string,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null>;
  softDeleteEvidence(
    workspaceId: string,
    evidenceId: string,
    now: Date,
    audit: EvidenceAuditDraft,
  ): Promise<boolean>;
  listEvidence(workspaceId: string, investigationId?: string): Promise<EvidenceRow[]>;
  listApprovedEvidence(workspaceId: string, investigationId: string): Promise<EvidenceRow[]>;
  findFindingForLink(workspaceId: string, findingId: string): Promise<EvidenceFindingLookup | null>;
  createLink(
    data: EvidenceLinkCreateData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceFindingLinkRow>;
  removeLink(workspaceId: string, linkId: string, audit: EvidenceAuditDraft): Promise<boolean>;
  recordAudit(event: AuditEvent): Promise<void>;
};
