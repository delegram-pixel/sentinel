import type { AuditEvent } from "@/modules/audit/domain/audit";
import type { Capability } from "@/modules/security/domain/capability";

import type { ProjectStatus, ProjectType } from "../domain/project";
import type {
  ConfidenceLabel,
  HypothesisObservationRelationship,
  HypothesisStatus,
  InvestigationStatus,
  ObservationType,
} from "../domain/investigation";
import type {
  ScopeActivityEffect,
  ScopeAssetEffect,
  ScopeAssetMatchType,
  ScopeStatus,
} from "../domain/scope";
import type { ScopeValidationRecord } from "../domain/scope-validator";
import type { AssetType, EnvironmentType, TargetAuthorizationStatus } from "../domain/target";

export type AuditDraft = Omit<AuditEvent, "entityId">;

export type ProjectListRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  projectType: ProjectType;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  targetCount: number;
  authorizedTargetCount: number;
  investigationCount: number;
};

export type TargetListRow = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  assetIdentifier: string;
  assetType: AssetType;
  environmentType: EnvironmentType;
  authorizationStatus: TargetAuthorizationStatus;
  authorizationExpiresAt: Date | null;
  activeScopeVersion: number | null;
  updatedAt: Date;
};

export type ProjectDetail = ProjectListRow & {
  targets: TargetListRow[];
};

export type ScopeAssetRow = {
  id: string;
  assetIdentifier: string;
  assetType: AssetType;
  matchType: ScopeAssetMatchType;
  effect: ScopeAssetEffect;
  notes: string | null;
};

export type ScopeActivityRow = {
  activity: Capability;
  effect: ScopeActivityEffect;
};

export type ScopeRow = {
  id: string;
  version: number;
  status: ScopeStatus;
  attestationNotes: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  supersededAt: Date | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  createdBy: string;
  createdAt: Date;
  assets: ScopeAssetRow[];
  activities: ScopeActivityRow[];
  artifactCount: number;
};

export type TargetDetail = TargetListRow & {
  description: string | null;
  programName: string | null;
  programUrl: string | null;
  authorizationSource: string | null;
  authorizationDate: Date | null;
  authorizationNotes: string | null;
  project: { id: string; name: string; slug: string };
  scopes: ScopeRow[];
};

export type ProjectLookup = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
};

export type TargetLookup = {
  id: string;
  projectId: string;
  name: string;
  assetIdentifier: string;
  assetType: AssetType;
  authorizationStatus: TargetAuthorizationStatus;
};

export type ProjectCreateData = {
  workspaceId: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  projectType: ProjectType;
};

export type ProjectUpdateData = {
  name: string;
  description?: string;
  projectType: ProjectType;
};

export type TargetCreateData = {
  projectId: string;
  name: string;
  description?: string;
  assetIdentifier: string;
  assetType: AssetType;
  environmentType: EnvironmentType;
  programName?: string;
  programUrl?: string;
  authorizationSource?: string;
  authorizationDate: Date | null;
  authorizationNotes?: string;
};

export type ScopeAssetCreateData = {
  assetIdentifier: string;
  assetType: AssetType;
  matchType: ScopeAssetMatchType;
  effect: ScopeAssetEffect;
  notes?: string;
};

export type ScopeCreateData = {
  targetId: string;
  effectiveFrom: Date;
  effectiveUntil: Date;
  assets: ScopeAssetCreateData[];
  permittedActivities: Capability[];
  attestationNotes?: string;
  createdBy: string;
  now: Date;
};

export type ScopeActivationData = {
  scopeId: string;
  targetId: string;
  approvedBy: string;
  approvedAt: Date;
  authorizationSource: string;
  authorizationDate: Date;
  attestationNotes?: string;
};

export interface ProjectStore {
  listProjects(workspaceId: string): Promise<ProjectListRow[]>;
  findProject(workspaceId: string, projectId: string): Promise<ProjectDetail | null>;
  findProjectLookup(workspaceId: string, projectId: string): Promise<ProjectLookup | null>;
  projectSlugExists(workspaceId: string, slug: string): Promise<boolean>;
  createProject(data: ProjectCreateData, audit: AuditDraft): Promise<ProjectDetail>;
  updateProject(
    workspaceId: string,
    projectId: string,
    data: ProjectUpdateData,
    audit: AuditDraft,
  ): Promise<ProjectDetail | null>;
  archiveProject(
    workspaceId: string,
    projectId: string,
    archivedAt: Date,
    audit: AuditDraft,
  ): Promise<ProjectDetail | null>;
  recordAudit(event: AuditEvent): Promise<void>;
}

export interface TargetStore {
  listTargets(workspaceId: string): Promise<TargetListRow[]>;
  findTarget(workspaceId: string, targetId: string): Promise<TargetDetail | null>;
  findTargetLookup(workspaceId: string, targetId: string): Promise<TargetLookup | null>;
  targetAssetExists(
    projectId: string,
    assetIdentifier: string,
    excludeTargetId?: string,
  ): Promise<boolean>;
  createTarget(data: TargetCreateData, audit: AuditDraft): Promise<TargetDetail>;
  updateTarget(
    workspaceId: string,
    targetId: string,
    data: TargetCreateData,
    audit: AuditDraft,
  ): Promise<TargetDetail | null>;
  recordAudit(event: AuditEvent): Promise<void>;
}

export interface ScopeStore {
  listScopes(workspaceId: string, targetId: string): Promise<ScopeRow[]>;
  findScope(
    workspaceId: string,
    scopeId: string,
  ): Promise<{ scope: ScopeRow; target: TargetLookup } | null>;
  findActiveScope(workspaceId: string, targetId: string): Promise<ScopeValidationRecord | null>;
  createScopeDraft(data: ScopeCreateData, audit: AuditDraft): Promise<ScopeRow>;
  activateScope(data: ScopeActivationData, audit: AuditDraft): Promise<ScopeRow>;
  revokeScope(
    workspaceId: string,
    scopeId: string,
    now: Date,
    audit: AuditDraft,
  ): Promise<ScopeRow | null>;
  recordAudit(event: AuditEvent): Promise<void>;
}

export type ObservationRow = {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  observationType: ObservationType;
  source: string | null;
  confidenceLabel: ConfidenceLabel;
  createdBy: string;
  createdAt: Date;
};

export type HypothesisObservationRow = {
  observationId: string;
  relationshipType: HypothesisObservationRelationship;
  observation: ObservationRow;
};

export type HypothesisRow = {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  vulnerabilityCategory: string | null;
  missingInformation: string | null;
  status: HypothesisStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  observationLinks: HypothesisObservationRow[];
};

export type SessionSummaryRow = {
  id: string;
  investigationId: string;
  summary: string;
  completedWork: string[];
  rejectedHypotheses: string[];
  unresolvedQuestions: string[];
  nextActions: string[];
  generatedByType: "AI" | "HUMAN";
  model: string | null;
  createdAt: Date;
};

export type InvestigationListRow = {
  id: string;
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  targetAssetIdentifier: string;
  title: string;
  description: string | null;
  objective: string | null;
  category: string | null;
  status: InvestigationStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  observationCount: number;
  hypothesisCount: number;
  summaryCount: number;
};

export type InvestigationDetail = InvestigationListRow & {
  engagementId?: string | null;
  phase?: import("../domain/research-decision").ResearchPhaseInput["expectedPhase"];
  observations: ObservationRow[];
  hypotheses: HypothesisRow[];
  summaries: SessionSummaryRow[];
};

export type InvestigationCreateData = {
  workspaceId: string;
  projectId: string;
  targetId: string;
  title: string;
  description?: string;
  objective?: string;
  category?: string;
  createdBy: string;
};

export type InvestigationUpdateData = {
  title: string;
  description?: string;
  objective?: string;
  category?: string;
};

export type ObservationCreateData = {
  investigationId: string;
  title: string;
  description: string;
  observationType: ObservationType;
  source?: string;
  confidenceLabel: ConfidenceLabel;
  createdBy: string;
};

export type HypothesisCreateData = {
  investigationId: string;
  title: string;
  description: string;
  vulnerabilityCategory?: string;
  missingInformation?: string;
  createdBy: string;
  observationLinks: Array<{
    observationId: string;
    relationshipType: HypothesisObservationRelationship;
  }>;
};

export type SessionSummaryCreateData = {
  investigationId: string;
  summary: string;
  completedWork: string[];
  rejectedHypotheses: string[];
  unresolvedQuestions: string[];
  nextActions: string[];
  createdBy: string;
};

export interface InvestigationStore {
  listInvestigations(workspaceId: string, projectId?: string): Promise<InvestigationListRow[]>;
  findInvestigation(
    workspaceId: string,
    investigationId: string,
  ): Promise<InvestigationDetail | null>;
  createInvestigation(
    data: InvestigationCreateData,
    audit: AuditDraft,
  ): Promise<InvestigationDetail>;
  updateInvestigation(
    workspaceId: string,
    investigationId: string,
    data: InvestigationUpdateData,
    audit: AuditDraft,
  ): Promise<InvestigationDetail | null>;
  changeInvestigationStatus(
    workspaceId: string,
    investigationId: string,
    status: InvestigationStatus,
    now: Date,
    audit: AuditDraft,
  ): Promise<InvestigationDetail | null>;
  createObservation(data: ObservationCreateData, audit: AuditDraft): Promise<ObservationRow>;
  updateObservation(
    workspaceId: string,
    investigationId: string,
    observationId: string,
    data: Omit<ObservationCreateData, "investigationId" | "createdBy">,
    audit: AuditDraft,
  ): Promise<ObservationRow | null>;
  createHypothesis(data: HypothesisCreateData, audit: AuditDraft): Promise<HypothesisRow>;
  updateHypothesis(
    workspaceId: string,
    investigationId: string,
    hypothesisId: string,
    data: Omit<HypothesisCreateData, "investigationId" | "createdBy" | "observationLinks">,
    audit: AuditDraft,
  ): Promise<HypothesisRow | null>;
  changeHypothesisStatus(
    workspaceId: string,
    investigationId: string,
    hypothesisId: string,
    status: HypothesisStatus,
    audit: AuditDraft,
  ): Promise<HypothesisRow | null>;
  createSessionSummary(
    data: SessionSummaryCreateData,
    audit: AuditDraft,
  ): Promise<SessionSummaryRow>;
  recordAudit(event: AuditEvent): Promise<void>;
}
