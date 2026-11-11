import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import type { AuditEvent } from "@/modules/audit/domain/audit";
import type { AuditDraft } from "../application/ports";
import { deriveTargetAuthorization } from "@/modules/research/domain/target";

import type {
  HypothesisCreateData,
  HypothesisRow,
  InvestigationCreateData,
  InvestigationDetail,
  InvestigationListRow,
  InvestigationStore,
  InvestigationUpdateData,
  ObservationCreateData,
  ObservationRow,
  ProjectCreateData,
  ProjectDetail,
  ProjectListRow,
  ProjectLookup,
  ProjectStore,
  ProjectUpdateData,
  ScopeActivationData,
  ScopeCreateData,
  ScopeRow,
  ScopeStore,
  SessionSummaryCreateData,
  SessionSummaryRow,
  TargetCreateData,
  TargetDetail,
  TargetListRow,
  TargetLookup,
  TargetStore,
} from "../application/ports";
import type { HypothesisStatus, InvestigationStatus } from "../domain/investigation";
import type { ScopeValidationRecord } from "../domain/scope-validator";

type Db = Prisma.TransactionClient;

const projectBaseSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  projectType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

const targetBaseSelect = {
  id: true,
  projectId: true,
  name: true,
  assetIdentifier: true,
  assetType: true,
  environmentType: true,
  authorizationStatus: true,
  authorizationExpiresAt: true,
  updatedAt: true,
} satisfies Prisma.TargetSelect;

const scopeDetailSelect = {
  id: true,
  version: true,
  status: true,
  attestationNotes: true,
  approvedBy: true,
  approvedAt: true,
  supersededAt: true,
  effectiveFrom: true,
  effectiveUntil: true,
  createdBy: true,
  createdAt: true,
  assets: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      assetIdentifier: true,
      assetType: true,
      matchType: true,
      effect: true,
      notes: true,
    },
  },
  activities: {
    select: { activity: true, effect: true },
  },
  _count: { select: { artifacts: true } },
} satisfies Prisma.ScopeVersionSelect;

type ScopeDetail = Prisma.ScopeVersionGetPayload<{ select: typeof scopeDetailSelect }>;

function mapScope(scope: ScopeDetail): ScopeRow {
  return {
    id: scope.id,
    version: scope.version,
    status: scope.status,
    attestationNotes: scope.attestationNotes,
    approvedBy: scope.approvedBy,
    approvedAt: scope.approvedAt,
    supersededAt: scope.supersededAt,
    effectiveFrom: scope.effectiveFrom,
    effectiveUntil: scope.effectiveUntil,
    createdBy: scope.createdBy,
    createdAt: scope.createdAt,
    assets: scope.assets,
    activities: scope.activities,
    artifactCount: scope._count.artifacts,
  };
}

const observationSelect = {
  id: true,
  investigationId: true,
  title: true,
  description: true,
  observationType: true,
  source: true,
  confidenceLabel: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.InvestigationObservationSelect;

const hypothesisBaseSelect = {
  id: true,
  investigationId: true,
  title: true,
  description: true,
  vulnerabilityCategory: true,
  missingInformation: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HypothesisSelect;

const hypothesisDetailSelect = {
  ...hypothesisBaseSelect,
  observationLinks: {
    select: {
      observationId: true,
      relationshipType: true,
      observation: { select: observationSelect },
    },
  },
} satisfies Prisma.HypothesisSelect;

const sessionSummarySelect = {
  id: true,
  investigationId: true,
  summary: true,
  completedWork: true,
  rejectedHypotheses: true,
  unresolvedQuestions: true,
  nextActions: true,
  generatedByType: true,
  model: true,
  createdAt: true,
} satisfies Prisma.SessionSummarySelect;

const investigationBaseSelect = {
  id: true,
  projectId: true,
  targetId: true,
  title: true,
  description: true,
  objective: true,
  category: true,
  status: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { name: true } },
  target: { select: { name: true, assetIdentifier: true } },
  _count: {
    select: { observations: true, hypotheses: true, sessionSummaries: true },
  },
} satisfies Prisma.InvestigationSelect;

const investigationDetailSelect = {
  ...investigationBaseSelect,
  engagementId: true,
  phase: true,
  observations: { orderBy: { createdAt: "asc" }, select: observationSelect },
  hypotheses: { orderBy: { updatedAt: "desc" }, select: hypothesisDetailSelect },
  sessionSummaries: { orderBy: { createdAt: "desc" }, select: sessionSummarySelect },
} satisfies Prisma.InvestigationSelect;

type InvestigationDetailRecord = Prisma.InvestigationGetPayload<{
  select: typeof investigationDetailSelect;
}>;

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapObservation(observation: {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  observationType: ObservationRow["observationType"];
  source: string | null;
  confidenceLabel: ObservationRow["confidenceLabel"];
  createdBy: string;
  createdAt: Date;
}): ObservationRow {
  return {
    id: observation.id,
    investigationId: observation.investigationId,
    title: observation.title,
    description: observation.description,
    observationType: observation.observationType,
    source: observation.source,
    confidenceLabel: observation.confidenceLabel,
    createdBy: observation.createdBy,
    createdAt: observation.createdAt,
  };
}

function mapHypothesis(hypothesis: {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  vulnerabilityCategory: string | null;
  missingInformation: string | null;
  status: HypothesisRow["status"];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  observationLinks: Array<{
    observationId: string;
    relationshipType: HypothesisRow["observationLinks"][number]["relationshipType"];
    observation: Parameters<typeof mapObservation>[0];
  }>;
}): HypothesisRow {
  return {
    id: hypothesis.id,
    investigationId: hypothesis.investigationId,
    title: hypothesis.title,
    description: hypothesis.description,
    vulnerabilityCategory: hypothesis.vulnerabilityCategory,
    missingInformation: hypothesis.missingInformation,
    status: hypothesis.status,
    createdBy: hypothesis.createdBy,
    createdAt: hypothesis.createdAt,
    updatedAt: hypothesis.updatedAt,
    observationLinks: hypothesis.observationLinks.map((link) => ({
      observationId: link.observationId,
      relationshipType: link.relationshipType,
      observation: mapObservation(link.observation),
    })),
  };
}

function mapSessionSummary(summary: {
  id: string;
  investigationId: string;
  summary: string;
  completedWork: Prisma.JsonValue | null;
  rejectedHypotheses: Prisma.JsonValue | null;
  unresolvedQuestions: Prisma.JsonValue | null;
  nextActions: Prisma.JsonValue | null;
  generatedByType: SessionSummaryRow["generatedByType"];
  model: string | null;
  createdAt: Date;
}): SessionSummaryRow {
  return {
    id: summary.id,
    investigationId: summary.investigationId,
    summary: summary.summary,
    completedWork: stringArray(summary.completedWork),
    rejectedHypotheses: stringArray(summary.rejectedHypotheses),
    unresolvedQuestions: stringArray(summary.unresolvedQuestions),
    nextActions: stringArray(summary.nextActions),
    generatedByType: summary.generatedByType,
    model: summary.model,
    createdAt: summary.createdAt,
  };
}

function mapInvestigationBase(investigation: {
  id: string;
  projectId: string;
  targetId: string;
  title: string;
  description: string | null;
  objective: string | null;
  category: string | null;
  status: InvestigationListRow["status"];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: { name: string };
  target: { name: string; assetIdentifier: string };
  _count: { observations: number; hypotheses: number; sessionSummaries: number };
}): InvestigationListRow {
  return {
    id: investigation.id,
    projectId: investigation.projectId,
    projectName: investigation.project.name,
    targetId: investigation.targetId,
    targetName: investigation.target.name,
    targetAssetIdentifier: investigation.target.assetIdentifier,
    title: investigation.title,
    description: investigation.description,
    objective: investigation.objective,
    category: investigation.category,
    status: investigation.status,
    startedAt: investigation.startedAt,
    completedAt: investigation.completedAt,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
    observationCount: investigation._count.observations,
    hypothesisCount: investigation._count.hypotheses,
    summaryCount: investigation._count.sessionSummaries,
  };
}

function mapInvestigationDetail(investigation: InvestigationDetailRecord): InvestigationDetail {
  return {
    ...mapInvestigationBase(investigation),
    engagementId: investigation.engagementId,
    phase: investigation.phase,
    observations: investigation.observations.map(mapObservation),
    hypotheses: investigation.hypotheses.map(mapHypothesis),
    summaries: investigation.sessionSummaries.map(mapSessionSummary),
  };
}

function auditRow(event: AuditDraft, entityId: string): Prisma.AuditLogCreateInput {
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

function projectAuditRow(event: AuditDraft, entityId: string) {
  return auditRow(event, entityId);
}

/**
 * Single Prisma adapter for the research module (projects, targets, scope).
 * Scope writes recompute the materialised target authorization inside the same
 * transaction, per ADR-017.
 */
export class PrismaResearchStore
  implements ProjectStore, TargetStore, ScopeStore, InvestigationStore
{
  constructor(private readonly db: Db) {}

  // -----------------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------------

  async listProjects(workspaceId: string): Promise<ProjectListRow[]> {
    const projects = await this.db.project.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      select: {
        ...projectBaseSelect,
        _count: { select: { investigations: true } },
        targets: { select: { authorizationStatus: true } },
      },
    });

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      projectType: project.projectType,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      targetCount: project.targets.length,
      authorizedTargetCount: project.targets.filter(
        (target) => target.authorizationStatus === "AUTHORIZED",
      ).length,
      investigationCount: project._count.investigations,
    }));
  }

  findProject(workspaceId: string, projectId: string): Promise<ProjectDetail | null> {
    return this.loadProjectDetail(this.db, workspaceId, projectId);
  }

  async findProjectLookup(workspaceId: string, projectId: string): Promise<ProjectLookup | null> {
    return this.db.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  async projectSlugExists(workspaceId: string, slug: string): Promise<boolean> {
    const count = await this.db.project.count({ where: { workspaceId, slug } });

    return count > 0;
  }

  async createProject(data: ProjectCreateData, audit: AuditDraft): Promise<ProjectDetail> {
    return this.db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId: data.workspaceId,
          ownerId: data.ownerId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          projectType: data.projectType,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, project.id) });

      const detail = await this.loadProjectDetail(tx, data.workspaceId, project.id);

      if (!detail) {
        throw new Error("The project was created but could not be read back.");
      }

      return detail;
    });
  }

  async updateProject(
    workspaceId: string,
    projectId: string,
    data: ProjectUpdateData,
    audit: AuditDraft,
  ): Promise<ProjectDetail | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({
        where: { id: projectId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.project.update({
        where: { id: projectId },
        data: {
          name: data.name,
          description: data.description,
          projectType: data.projectType,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, projectId) });

      return this.loadProjectDetail(tx, workspaceId, projectId);
    });
  }

  async archiveProject(
    workspaceId: string,
    projectId: string,
    archivedAt: Date,
    audit: AuditDraft,
  ): Promise<ProjectDetail | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({
        where: { id: projectId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.project.update({
        where: { id: projectId },
        data: { status: "ARCHIVED", archivedAt },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, projectId) });

      return this.loadProjectDetail(tx, workspaceId, projectId);
    });
  }

  async recordAudit(event: AuditEvent): Promise<void> {
    await this.db.auditLog.create({
      data: {
        workspaceId: event.workspaceId,
        userId: event.userId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        previousValue: event.previousValue as Prisma.InputJsonValue | undefined,
        newValue: event.newValue as Prisma.InputJsonValue | undefined,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async loadProjectDetail(
    db: Db,
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectDetail | null> {
    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId },
      select: {
        ...projectBaseSelect,
        targets: {
          orderBy: { updatedAt: "desc" },
          select: {
            ...targetBaseSelect,
            scopeVersions: {
              where: { status: "ACTIVE" },
              take: 1,
              select: { version: true },
            },
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    const investigationCount = await db.investigation.count({ where: { projectId } });

    const targets: TargetListRow[] = project.targets.map((target) => ({
      id: target.id,
      projectId: target.projectId,
      projectName: project.name,
      name: target.name,
      assetIdentifier: target.assetIdentifier,
      assetType: target.assetType,
      environmentType: target.environmentType,
      authorizationStatus: target.authorizationStatus,
      authorizationExpiresAt: target.authorizationExpiresAt,
      activeScopeVersion: target.scopeVersions[0]?.version ?? null,
      updatedAt: target.updatedAt,
    }));

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      projectType: project.projectType,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      targetCount: targets.length,
      authorizedTargetCount: targets.filter((target) => target.authorizationStatus === "AUTHORIZED")
        .length,
      investigationCount,
      targets,
    };
  }

  // -----------------------------------------------------------------------
  // Targets
  // -----------------------------------------------------------------------

  async listTargets(workspaceId: string): Promise<TargetListRow[]> {
    const targets = await this.db.target.findMany({
      where: { project: { workspaceId } },
      orderBy: { updatedAt: "desc" },
      select: {
        ...targetBaseSelect,
        project: { select: { name: true } },
        scopeVersions: {
          where: { status: "ACTIVE" },
          take: 1,
          select: { version: true },
        },
      },
    });

    return targets.map((target) => ({
      id: target.id,
      projectId: target.projectId,
      projectName: target.project.name,
      name: target.name,
      assetIdentifier: target.assetIdentifier,
      assetType: target.assetType,
      environmentType: target.environmentType,
      authorizationStatus: target.authorizationStatus,
      authorizationExpiresAt: target.authorizationExpiresAt,
      activeScopeVersion: target.scopeVersions[0]?.version ?? null,
      updatedAt: target.updatedAt,
    }));
  }

  findTarget(workspaceId: string, targetId: string): Promise<TargetDetail | null> {
    return this.loadTargetDetail(this.db, workspaceId, targetId);
  }

  async findTargetLookup(workspaceId: string, targetId: string): Promise<TargetLookup | null> {
    return this.db.target.findFirst({
      where: { id: targetId, project: { workspaceId } },
      select: {
        id: true,
        projectId: true,
        name: true,
        assetIdentifier: true,
        assetType: true,
        authorizationStatus: true,
      },
    });
  }

  async targetAssetExists(
    projectId: string,
    assetIdentifier: string,
    excludeTargetId?: string,
  ): Promise<boolean> {
    const count = await this.db.target.count({
      where: {
        projectId,
        // Asset identifiers such as domains are case-insensitive. Comparing
        // without case keeps duplicates out of the application even though the
        // database's unique constraint remains case-sensitive.
        assetIdentifier: { equals: assetIdentifier, mode: "insensitive" },
        ...(excludeTargetId ? { id: { not: excludeTargetId } } : {}),
      },
    });

    return count > 0;
  }

  async createTarget(data: TargetCreateData, audit: AuditDraft): Promise<TargetDetail> {
    return this.db.$transaction(async (tx) => {
      const target = await tx.target.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          description: data.description,
          assetIdentifier: data.assetIdentifier,
          assetType: data.assetType,
          environmentType: data.environmentType,
          programName: data.programName,
          programUrl: data.programUrl,
          authorizationSource: data.authorizationSource,
          authorizationDate: data.authorizationDate,
          authorizationNotes: data.authorizationNotes,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, target.id) });

      const detail = await this.loadTargetDetail(tx, audit.workspaceId, target.id);

      if (!detail) {
        throw new Error("The target was created but could not be read back.");
      }

      return detail;
    });
  }

  async updateTarget(
    workspaceId: string,
    targetId: string,
    data: TargetCreateData,
    audit: AuditDraft,
  ): Promise<TargetDetail | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.target.findFirst({
        where: { id: targetId, project: { workspaceId } },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.target.update({
        where: { id: targetId },
        data: {
          name: data.name,
          description: data.description,
          assetIdentifier: data.assetIdentifier,
          assetType: data.assetType,
          environmentType: data.environmentType,
          programName: data.programName,
          programUrl: data.programUrl,
          authorizationSource: data.authorizationSource,
          authorizationDate: data.authorizationDate,
          authorizationNotes: data.authorizationNotes,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, targetId) });

      return this.loadTargetDetail(tx, workspaceId, targetId);
    });
  }

  private async loadTargetDetail(
    db: Db,
    workspaceId: string,
    targetId: string,
  ): Promise<TargetDetail | null> {
    const target = await db.target.findFirst({
      where: { id: targetId, project: { workspaceId } },
      select: {
        ...targetBaseSelect,
        description: true,
        programName: true,
        programUrl: true,
        authorizationSource: true,
        authorizationDate: true,
        authorizationNotes: true,
        project: { select: { id: true, name: true, slug: true } },
        scopeVersions: {
          orderBy: { version: "desc" },
          select: scopeDetailSelect,
        },
      },
    });

    if (!target) {
      return null;
    }

    return {
      id: target.id,
      projectId: target.projectId,
      projectName: target.project.name,
      name: target.name,
      assetIdentifier: target.assetIdentifier,
      assetType: target.assetType,
      environmentType: target.environmentType,
      authorizationStatus: target.authorizationStatus,
      authorizationExpiresAt: target.authorizationExpiresAt,
      activeScopeVersion:
        target.scopeVersions.find((scope) => scope.status === "ACTIVE")?.version ?? null,
      updatedAt: target.updatedAt,
      description: target.description,
      programName: target.programName,
      programUrl: target.programUrl,
      authorizationSource: target.authorizationSource,
      authorizationDate: target.authorizationDate,
      authorizationNotes: target.authorizationNotes,
      project: target.project,
      scopes: target.scopeVersions.map(mapScope),
    };
  }

  // -----------------------------------------------------------------------
  // Scope
  // -----------------------------------------------------------------------

  async listScopes(workspaceId: string, targetId: string): Promise<ScopeRow[]> {
    const scopes = await this.db.scopeVersion.findMany({
      where: { targetId, target: { project: { workspaceId } } },
      orderBy: { version: "desc" },
      select: scopeDetailSelect,
    });

    return scopes.map(mapScope);
  }

  async findScope(
    workspaceId: string,
    scopeId: string,
  ): Promise<{ scope: ScopeRow; target: TargetLookup } | null> {
    const scope = await this.db.scopeVersion.findFirst({
      where: { id: scopeId, target: { project: { workspaceId } } },
      select: {
        ...scopeDetailSelect,
        target: {
          select: {
            id: true,
            projectId: true,
            name: true,
            assetIdentifier: true,
            assetType: true,
            authorizationStatus: true,
          },
        },
      },
    });

    if (!scope) {
      return null;
    }

    return { scope: mapScope(scope), target: scope.target };
  }

  async findActiveScope(
    workspaceId: string,
    targetId: string,
  ): Promise<ScopeValidationRecord | null> {
    return this.db.scopeVersion.findFirst({
      where: { targetId, status: "ACTIVE", target: { project: { workspaceId } } },
      select: {
        status: true,
        effectiveFrom: true,
        effectiveUntil: true,
        assets: {
          select: {
            assetIdentifier: true,
            matchType: true,
            effect: true,
            assetType: true,
          },
        },
        activities: { select: { activity: true, effect: true } },
      },
    });
  }

  async createScopeDraft(data: ScopeCreateData, audit: AuditDraft): Promise<ScopeRow> {
    return this.db.$transaction(async (tx) => {
      const target = await tx.target.findFirst({
        where: { id: data.targetId, project: { workspaceId: audit.workspaceId } },
        select: { id: true },
      });

      if (!target) {
        throw new Error("The target does not exist in this workspace.");
      }

      const latest = await tx.scopeVersion.aggregate({
        where: { targetId: data.targetId },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;

      const scope = await tx.scopeVersion.create({
        data: {
          targetId: data.targetId,
          version,
          status: "DRAFT",
          createdBy: data.createdBy,
          effectiveFrom: data.effectiveFrom,
          effectiveUntil: data.effectiveUntil,
          attestationNotes: data.attestationNotes,
          assets: {
            create: data.assets.map((asset) => ({
              assetIdentifier: asset.assetIdentifier,
              assetType: asset.assetType,
              matchType: asset.matchType,
              effect: asset.effect,
              notes: asset.notes,
            })),
          },
          activities: {
            create: data.permittedActivities.map((activity) => ({
              activity,
              effect: "PERMITTED" as const,
            })),
          },
        },
        select: scopeDetailSelect,
      });

      const derived = await this.recomputeTargetAuthorization(tx, data.targetId, data.now);

      await tx.auditLog.create({
        data: projectAuditRow(
          {
            ...audit,
            newValue: {
              ...(audit.newValue ?? {}),
              version,
              targetAuthorizationStatus: derived.status,
            },
          },
          scope.id,
        ),
      });

      return mapScope(scope);
    });
  }

  async activateScope(data: ScopeActivationData, audit: AuditDraft): Promise<ScopeRow> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.scopeVersion.findFirst({
        where: { id: data.scopeId, targetId: data.targetId },
        select: { status: true, attestationNotes: true },
      });

      if (!existing || existing.status !== "DRAFT") {
        throw new Error("The scope version is no longer a draft.");
      }

      await tx.scopeVersion.updateMany({
        where: {
          targetId: data.targetId,
          status: "ACTIVE",
          id: { not: data.scopeId },
        },
        data: { status: "SUPERSEDED", supersededAt: data.approvedAt },
      });

      const activated = await tx.scopeVersion.updateMany({
        where: { id: data.scopeId, status: "DRAFT" },
        data: {
          status: "ACTIVE",
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt,
          attestationNotes: data.attestationNotes ?? existing.attestationNotes,
          supersededAt: null,
        },
      });

      if (activated.count !== 1) {
        throw new Error("The scope version could not be activated.");
      }

      await tx.target.update({
        where: { id: data.targetId },
        data: {
          authorizationSource: data.authorizationSource,
          authorizationDate: data.authorizationDate,
        },
        select: { id: true },
      });

      const derived = await this.recomputeTargetAuthorization(tx, data.targetId, data.approvedAt);

      await tx.auditLog.create({
        data: projectAuditRow(
          {
            ...audit,
            newValue: {
              ...(audit.newValue ?? {}),
              targetAuthorizationStatus: derived.status,
            },
          },
          data.scopeId,
        ),
      });

      const scope = await tx.scopeVersion.findUniqueOrThrow({
        where: { id: data.scopeId },
        select: scopeDetailSelect,
      });

      return mapScope(scope);
    });
  }

  async revokeScope(
    workspaceId: string,
    scopeId: string,
    now: Date,
    audit: AuditDraft,
  ): Promise<ScopeRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.scopeVersion.findFirst({
        where: { id: scopeId, target: { project: { workspaceId } } },
        select: { targetId: true, status: true },
      });

      if (!existing || existing.status !== "ACTIVE") {
        return null;
      }

      await tx.scopeVersion.update({
        where: { id: scopeId },
        data: { status: "REVOKED" },
        select: { id: true },
      });

      const derived = await this.recomputeTargetAuthorization(tx, existing.targetId, now);

      await tx.auditLog.create({
        data: projectAuditRow(
          {
            ...audit,
            newValue: {
              ...(audit.newValue ?? {}),
              targetAuthorizationStatus: derived.status,
            },
          },
          scopeId,
        ),
      });

      const scope = await tx.scopeVersion.findUniqueOrThrow({
        where: { id: scopeId },
        select: scopeDetailSelect,
      });

      return mapScope(scope);
    });
  }

  // -----------------------------------------------------------------------
  // Investigations
  // -----------------------------------------------------------------------

  async listInvestigations(
    workspaceId: string,
    projectId?: string,
  ): Promise<InvestigationListRow[]> {
    const investigations = await this.db.investigation.findMany({
      where: { workspaceId, ...(projectId ? { projectId } : {}) },
      orderBy: { updatedAt: "desc" },
      select: investigationBaseSelect,
    });

    return investigations.map(mapInvestigationBase);
  }

  async findInvestigation(
    workspaceId: string,
    investigationId: string,
  ): Promise<InvestigationDetail | null> {
    return this.loadInvestigationDetail(this.db, workspaceId, investigationId);
  }

  async createInvestigation(
    data: InvestigationCreateData,
    audit: AuditDraft,
  ): Promise<InvestigationDetail> {
    return this.db.$transaction(async (tx) => {
      const target = await tx.target.findFirst({
        where: {
          id: data.targetId,
          projectId: data.projectId,
          project: { workspaceId: data.workspaceId },
        },
        select: { id: true },
      });

      if (!target) {
        throw new Error("The target does not exist in this project.");
      }

      const investigation = await tx.investigation.create({
        data: {
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          targetId: data.targetId,
          title: data.title,
          description: data.description,
          objective: data.objective,
          category: data.category,
          status: "DRAFT",
          createdBy: data.createdBy,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, investigation.id) });

      const detail = await this.loadInvestigationDetail(tx, data.workspaceId, investigation.id);

      if (!detail) {
        throw new Error("The investigation was created but could not be read back.");
      }

      return detail;
    });
  }

  async updateInvestigation(
    workspaceId: string,
    investigationId: string,
    data: InvestigationUpdateData,
    audit: AuditDraft,
  ): Promise<InvestigationDetail | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.investigation.findFirst({
        where: { id: investigationId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.investigation.update({
        where: { id: investigationId },
        data: {
          title: data.title,
          description: data.description,
          objective: data.objective,
          category: data.category,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, investigationId) });

      return this.loadInvestigationDetail(tx, workspaceId, investigationId);
    });
  }

  async changeInvestigationStatus(
    workspaceId: string,
    investigationId: string,
    status: InvestigationStatus,
    now: Date,
    audit: AuditDraft,
  ): Promise<InvestigationDetail | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.investigation.findFirst({
        where: { id: investigationId, workspaceId },
        select: { id: true, startedAt: true, completedAt: true },
      });

      if (!existing) {
        return null;
      }

      await tx.investigation.update({
        where: { id: investigationId },
        data: {
          status,
          ...(status === "ACTIVE" && !existing.startedAt ? { startedAt: now } : {}),
          ...(status === "COMPLETED" && !existing.completedAt ? { completedAt: now } : {}),
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, investigationId) });

      return this.loadInvestigationDetail(tx, workspaceId, investigationId);
    });
  }

  async createObservation(data: ObservationCreateData, audit: AuditDraft): Promise<ObservationRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: audit.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const observation = await tx.investigationObservation.create({
        data: {
          investigationId: data.investigationId,
          title: data.title,
          description: data.description,
          observationType: data.observationType,
          source: data.source,
          confidenceLabel: data.confidenceLabel,
          createdBy: data.createdBy,
        },
        select: observationSelect,
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, observation.id) });

      return mapObservation(observation);
    });
  }

  async updateObservation(
    workspaceId: string,
    investigationId: string,
    observationId: string,
    data: Omit<ObservationCreateData, "investigationId" | "createdBy">,
    audit: AuditDraft,
  ): Promise<ObservationRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.investigationObservation.findFirst({
        where: { id: observationId, investigationId, investigation: { workspaceId } },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const observation = await tx.investigationObservation.update({
        where: { id: observationId },
        data: {
          title: data.title,
          description: data.description,
          observationType: data.observationType,
          source: data.source,
          confidenceLabel: data.confidenceLabel,
        },
        select: observationSelect,
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, observationId) });

      return mapObservation(observation);
    });
  }

  async createHypothesis(data: HypothesisCreateData, audit: AuditDraft): Promise<HypothesisRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: audit.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const links = Array.from(
        new Map(data.observationLinks.map((link) => [link.observationId, link])).values(),
      );

      if (links.length > 0) {
        const observationCount = await tx.investigationObservation.count({
          where: {
            id: { in: links.map((link) => link.observationId) },
            investigationId: data.investigationId,
          },
        });

        if (observationCount !== links.length) {
          throw new Error("An observation does not belong to this investigation.");
        }
      }

      const hypothesis = await tx.hypothesis.create({
        data: {
          investigationId: data.investigationId,
          title: data.title,
          description: data.description,
          vulnerabilityCategory: data.vulnerabilityCategory,
          missingInformation: data.missingInformation,
          status: "IDEA",
          createdBy: data.createdBy,
          observationLinks: {
            create: links.map((link) => ({
              observationId: link.observationId,
              relationshipType: link.relationshipType,
              createdBy: data.createdBy,
            })),
          },
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, hypothesis.id) });

      const detail = await tx.hypothesis.findUniqueOrThrow({
        where: { id: hypothesis.id },
        select: hypothesisDetailSelect,
      });

      return mapHypothesis(detail);
    });
  }

  async updateHypothesis(
    workspaceId: string,
    investigationId: string,
    hypothesisId: string,
    data: Omit<HypothesisCreateData, "investigationId" | "createdBy" | "observationLinks">,
    audit: AuditDraft,
  ): Promise<HypothesisRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.hypothesis.findFirst({
        where: { id: hypothesisId, investigationId, investigation: { workspaceId } },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.hypothesis.update({
        where: { id: hypothesisId },
        data: {
          title: data.title,
          description: data.description,
          vulnerabilityCategory: data.vulnerabilityCategory,
          missingInformation: data.missingInformation,
        },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, hypothesisId) });

      const detail = await tx.hypothesis.findUniqueOrThrow({
        where: { id: hypothesisId },
        select: hypothesisDetailSelect,
      });

      return mapHypothesis(detail);
    });
  }

  async changeHypothesisStatus(
    workspaceId: string,
    investigationId: string,
    hypothesisId: string,
    status: HypothesisStatus,
    audit: AuditDraft,
  ): Promise<HypothesisRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.hypothesis.findFirst({
        where: { id: hypothesisId, investigationId, investigation: { workspaceId } },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.hypothesis.update({
        where: { id: hypothesisId },
        data: { status },
        select: { id: true },
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, hypothesisId) });

      const detail = await tx.hypothesis.findUniqueOrThrow({
        where: { id: hypothesisId },
        select: hypothesisDetailSelect,
      });

      return mapHypothesis(detail);
    });
  }

  async createSessionSummary(
    data: SessionSummaryCreateData,
    audit: AuditDraft,
  ): Promise<SessionSummaryRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: audit.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const summary = await tx.sessionSummary.create({
        data: {
          investigationId: data.investigationId,
          summary: data.summary,
          completedWork: data.completedWork as Prisma.InputJsonValue,
          rejectedHypotheses: data.rejectedHypotheses as Prisma.InputJsonValue,
          unresolvedQuestions: data.unresolvedQuestions as Prisma.InputJsonValue,
          nextActions: data.nextActions as Prisma.InputJsonValue,
          generatedByType: "HUMAN",
          createdBy: data.createdBy,
        },
        select: sessionSummarySelect,
      });

      await tx.auditLog.create({ data: projectAuditRow(audit, summary.id) });

      return mapSessionSummary(summary);
    });
  }

  private async loadInvestigationDetail(
    db: Db,
    workspaceId: string,
    investigationId: string,
  ): Promise<InvestigationDetail | null> {
    const investigation = await db.investigation.findFirst({
      where: { id: investigationId, workspaceId },
      select: investigationDetailSelect,
    });

    return investigation ? mapInvestigationDetail(investigation) : null;
  }

  private async recomputeTargetAuthorization(
    db: Db,
    targetId: string,
    now: Date,
  ): Promise<{ status: string; expiresAt: Date | null }> {
    // The active version is authoritative (ADR-003). A newer draft must not
    // erase an existing authorization; if there is no active version, fall
    // back to the latest decided version, then to the latest draft.
    const versions = await db.scopeVersion.findMany({
      where: { targetId },
      orderBy: { version: "desc" },
      select: {
        version: true,
        status: true,
        effectiveFrom: true,
        effectiveUntil: true,
        approvedBy: true,
        approvedAt: true,
      },
    });

    const snapshot =
      versions.find((version) => version.status === "ACTIVE") ??
      versions.find((version) => version.status !== "DRAFT") ??
      versions[0] ??
      null;

    const derived = deriveTargetAuthorization(snapshot, now);

    await db.target.update({
      where: { id: targetId },
      data: {
        authorizationStatus: derived.status,
        authorizationExpiresAt: derived.expiresAt,
      },
      select: { id: true },
    });

    return derived;
  }
}

export function createResearchStore(db: Db): PrismaResearchStore {
  return new PrismaResearchStore(db);
}
