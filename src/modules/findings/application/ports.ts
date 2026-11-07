import type { AuditEvent } from "@/modules/audit/domain/audit";
import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";

import type { AssetType } from "@/modules/research/domain/target";

import type { FindingStatus } from "../domain/finding-status";
import type { ResolutionReason, Severity } from "../domain/finding";
import type {
  EvidenceLinkRelationship,
  EvidenceType,
  RedactionStatus,
} from "@/modules/evidence/domain/evidence";
import type {
  VerificationConclusion,
  VerificationReviewerType,
} from "@/modules/verification/domain/verification-conclusion";

export type Phase6Actor = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type Phase6AuditDraft = Omit<AuditEvent, "entityId">;

export type FindingInvestigationContext = {
  id: string;
  workspaceId: string;
  projectId: string;
  projectStatus: string;
  investigationStatus: string;
};

export type FindingRow = {
  id: string;
  workspaceId: string;
  investigationId: string;
  investigationTitle: string;
  projectId: string;
  hypothesisId: string | null;
  hypothesisTitle: string | null;
  title: string;
  titleNormalized: string;
  description: string;
  vulnerabilityCategory: string | null;
  severity: Severity;
  severityRationale: string | null;
  affectedAsset: string | null;
  affectedAssetType: AssetType | null;
  status: FindingStatus;
  resolutionReason: ResolutionReason | null;
  impact: string | null;
  remediation: string | null;
  verifiedAt: Date | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  duplicateOfId: string | null;
  duplicateConfirmedBy: string | null;
  duplicateConfirmedAt: Date | null;
  supportingEvidenceCount: number;
  evidenceLinkCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type FindingEvidenceLinkRow = {
  id: string;
  evidenceId: string;
  evidenceTitle: string;
  evidenceType: EvidenceType;
  redactionStatus: RedactionStatus;
  relationshipType: EvidenceLinkRelationship;
  createdAt: Date;
};

export type VerificationReviewRow = {
  id: string;
  findingId: string;
  taskId: string | null;
  reviewerType: VerificationReviewerType;
  reviewerUserId: string | null;
  conclusion: VerificationConclusion;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingEvidence: string[];
  impactAssessment: string | null;
  reasoningSummary: string | null;
  createdAt: Date;
};

export type FindingDetail = FindingRow & {
  evidenceLinks: FindingEvidenceLinkRow[];
  verificationReviews: VerificationReviewRow[];
};

export type FindingCreateData = {
  workspaceId: string;
  investigationId: string;
  hypothesisId?: string;
  title: string;
  titleNormalized: string;
  description: string;
  vulnerabilityCategory?: string;
  affectedAsset?: string;
  affectedAssetType?: AssetType;
  impact?: string;
  remediation?: string;
  createdBy: string;
};

export type FindingUpdateData = {
  expectedUpdatedAt?: Date;
  hypothesisId?: string | null;
  title: string;
  titleNormalized: string;
  description: string;
  vulnerabilityCategory?: string | null;
  affectedAsset?: string | null;
  affectedAssetType?: AssetType | null;
  impact?: string | null;
  remediation?: string | null;
};

export type FindingSeverityData = {
  expectedUpdatedAt?: Date;
  severity: Severity;
  severityRationale?: string | null;
  affectedAsset?: string | null;
  affectedAssetType?: AssetType | null;
  assessedBy: string;
  assessedAt: Date;
};

export type FindingTransitionData = {
  rationale?: string;
  expectedUpdatedAt?: Date;
  status: FindingStatus;
  resolutionReason?: ResolutionReason | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  verifiedAt?: Date | null;
};

export type VerificationReviewCreateData = {
  expectedUpdatedAt?: Date;
  findingId: string;
  taskId?: string | null;
  reviewerType: VerificationReviewerType;
  reviewerUserId: string | null;
  conclusion: VerificationConclusion;
  supportingEvidence?: string[];
  contradictingEvidence?: string[];
  missingEvidence?: string[];
  impactAssessment?: string | null;
  reasoningSummary?: string | null;
};

export type DuplicateCandidate = {
  id: string;
  title: string;
  status: FindingStatus;
  vulnerabilityCategory: string | null;
  similarity: number;
};

export type ApprovedEvidenceRow = {
  id: string;
  title: string;
  evidenceType: EvidenceType;
  redactionStatus: RedactionStatus;
};

export type FindingEvidenceLinkCreateData = {
  workspaceId: string;
  findingId: string;
  evidenceId: string;
  relationshipType: EvidenceLinkRelationship;
};

export type FindingStore = {
  findInvestigation(
    workspaceId: string,
    investigationId: string,
  ): Promise<FindingInvestigationContext | null>;
  findHypothesis(
    workspaceId: string,
    investigationId: string,
    hypothesisId: string,
  ): Promise<{ id: string; title: string } | null>;
  listFindings(workspaceId: string, investigationId?: string): Promise<FindingRow[]>;
  findFinding(workspaceId: string, findingId: string): Promise<FindingDetail | null>;
  createFinding(data: FindingCreateData, audit: Phase6AuditDraft): Promise<FindingRow>;
  updateFinding(
    workspaceId: string,
    findingId: string,
    data: FindingUpdateData,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null>;
  assessSeverity(
    workspaceId: string,
    findingId: string,
    data: FindingSeverityData,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null>;
  transitionFinding(
    workspaceId: string,
    findingId: string,
    data: FindingTransitionData,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null>;
  createVerificationReview(
    data: VerificationReviewCreateData,
    transition: FindingTransitionData | null,
    audit: Phase6AuditDraft,
  ): Promise<{ review: VerificationReviewRow; finding: FindingRow } | null>;
  listVerificationReviews(workspaceId: string, findingId: string): Promise<VerificationReviewRow[]>;
  findSimilarFindings(input: {
    workspaceId: string;
    investigationId: string;
    titleNormalized: string;
    vulnerabilityCategory: string | null;
    excludeFindingId?: string;
  }): Promise<DuplicateCandidate[]>;
  findDuplicateTarget(
    workspaceId: string,
    findingId: string,
  ): Promise<{ id: string; duplicateOfId: string | null; investigationId: string } | null>;
  confirmDuplicate(
    workspaceId: string,
    findingId: string,
    canonicalFindingId: string,
    userId: string,
    now: Date,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null>;
  listApprovedEvidence(
    workspaceId: string,
    investigationId: string,
  ): Promise<ApprovedEvidenceRow[]>;
  createEvidenceLink(
    data: FindingEvidenceLinkCreateData,
    audit: Phase6AuditDraft,
  ): Promise<FindingEvidenceLinkRow>;
  removeEvidenceLink(
    workspaceId: string,
    linkId: string,
    audit: Phase6AuditDraft,
  ): Promise<boolean>;
  recordAudit(event: AuditEvent): Promise<void>;
};
