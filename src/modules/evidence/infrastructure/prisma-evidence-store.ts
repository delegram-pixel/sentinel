import "server-only";
import { assertEvidenceNotReferenced } from "./evidence-retention";
import {
  createEvidenceRelationship,
  removeEvidenceRelationship,
} from "./prisma-evidence-relationships";

import { Prisma } from "@/generated/prisma/client";
import {
  requireResearchMember,
  lockResearchInvestigation,
} from "@/modules/shared/infrastructure/research-transaction";
import { canReviewResearch, ResearchOperationError } from "@/modules/shared/application/actor";
import type { ResearchActor } from "@/modules/shared/application/actor";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";

import type { AuditEvent } from "@/modules/audit/domain/audit";
import type { FindingStatus } from "@/modules/findings/domain/finding-status";

import type {
  EvidenceActivationData,
  EvidenceAuditDraft,
  EvidenceCreateData,
  EvidenceDetail,
  EvidenceFinalizeData,
  EvidenceFindingLinkRow,
  EvidenceFindingLookup,
  EvidenceLinkCreateData,
  EvidenceMetadataUpdateData,
  EvidenceRow,
  EvidenceStore,
} from "../application/ports";
import type { EvidenceLinkRelationship, EvidenceType, RedactionStatus } from "../domain/evidence";

type Db = Prisma.TransactionClient;

const evidenceBaseSelect = {
  id: true,
  workspaceId: true,
  investigationId: true,
  evidenceType: true,
  title: true,
  description: true,
  fileName: true,
  storageKey: true,
  quarantineKey: true,
  mimeType: true,
  fileSize: true,
  checksum: true,
  source: true,
  collector: true,
  collectedAt: true,
  redactionStatus: true,
  redactionMethod: true,
  scanFindings: true,
  uploadedBy: true,
  redactionReviewedBy: true,
  redactionReviewedAt: true,
  activatedAt: true,
  uploadValidatedAt: true,
  version: true,
  supersedesId: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  investigation: { select: { title: true, projectId: true } },
  links: { select: { id: true } },
} satisfies Prisma.EvidenceSelect;

type EvidenceBaseRecord = Prisma.EvidenceGetPayload<{ select: typeof evidenceBaseSelect }>;

const evidenceLinkSelect = {
  id: true,
  findingId: true,
  relationshipType: true,
  createdAt: true,
  finding: { select: { title: true, status: true } },
} satisfies Prisma.EvidenceLinkSelect;

type EvidenceLinkRecord = Prisma.EvidenceLinkGetPayload<{ select: typeof evidenceLinkSelect }>;

function auditRow(event: EvidenceAuditDraft, entityId: string): Prisma.AuditLogCreateInput {
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

function mapEvidence(record: EvidenceBaseRecord): EvidenceRow {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    investigationId: record.investigationId,
    investigationTitle: record.investigation.title,
    projectId: record.investigation.projectId,
    evidenceType: record.evidenceType as EvidenceType,
    title: record.title,
    description: record.description,
    fileName: record.fileName,
    storageKey: record.storageKey,
    quarantineKey: record.quarantineKey,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    checksum: record.checksum,
    source: record.source,
    collector: record.collector,
    collectedAt: record.collectedAt,
    redactionStatus: record.redactionStatus as RedactionStatus,
    redactionMethod: record.redactionMethod,
    scanFindings: record.scanFindings,
    uploadedBy: record.uploadedBy,
    redactionReviewedBy: record.redactionReviewedBy,
    redactionReviewedAt: record.redactionReviewedAt,
    activatedAt: record.activatedAt,
    uploadValidatedAt: record.uploadValidatedAt,
    version: record.version,
    supersedesId: record.supersedesId,
    deletedAt: record.deletedAt,
    findingLinkCount: record.links.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapLink(link: EvidenceLinkRecord): EvidenceFindingLinkRow {
  return {
    id: link.id,
    findingId: link.findingId,
    findingTitle: link.finding.title,
    findingStatus: link.finding.status as FindingStatus,
    relationshipType: link.relationshipType as EvidenceLinkRelationship,
    createdAt: link.createdAt,
  };
}

export class PrismaEvidenceStore implements EvidenceStore {
  constructor(private readonly db: Db) {}
  prepareActivation(actor: ResearchActor, evidenceId: string, data: EvidenceActivationData) {
    return this.db.$transaction(async (tx) => {
      if (!canReviewResearch(await requireResearchMember(tx, actor)))
        throw new ResearchOperationError(
          "FORBIDDEN",
          "A human reviewer must record evidence promotion.",
        );
      const source = await tx.evidence.findFirst({
        where: { id: evidenceId, workspaceId: actor.workspaceId },
        select: { investigationId: true },
      });
      if (!source) throw new ResearchOperationError("NOT_FOUND", "The evidence is unavailable.");
      await lockResearchInvestigation(tx, actor, source.investigationId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Evidence" WHERE id = ${evidenceId}::uuid FOR UPDATE`,
      );
      const evidence = await tx.evidence.findFirst({
        where: {
          id: evidenceId,
          workspaceId: actor.workspaceId,
          deletedAt: null,
          storageKey: null,
          uploadValidatedAt: { not: null },
        },
      });
      if (
        !evidence?.quarantineKey ||
        evidence.checksum !== data.expectedChecksum ||
        evidence.version !== data.expectedVersion
      )
        throw new ResearchOperationError(
          "CONFLICT",
          "The validated upload changed. Refresh before approving it.",
        );
      const operationKey = `promotion:${evidence.id}:v${evidence.version}`;
      const old = await tx.backgroundJob.findUnique({
        where: { workspaceId_operationKey: { workspaceId: actor.workspaceId, operationKey } },
      });
      if (old) {
        const payload = old.payload as { decision?: string; checksum?: string };
        if (
          old.requestedBy !== actor.userId ||
          payload.decision !== data.redactionStatus ||
          payload.checksum !== evidence.checksum ||
          old.status === "CANCELLED"
        )
          throw new ResearchOperationError(
            "CONFLICT",
            "A different promotion review is already recorded. Review its background work.",
          );
        return { id: old.id };
      }
      return new PrismaJobStore(tx).enqueue(actor, "EVIDENCE_PROMOTION", operationKey, {
        evidenceId,
        sourceKey: evidence.quarantineKey,
        destinationKey: data.storageKey,
        decision: data.redactionStatus,
        checksum: evidence.checksum,
        version: evidence.version,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        reviewedAt: data.redactionReviewedAt.toISOString(),
      });
    });
  }

  async findInvestigation(workspaceId: string, investigationId: string) {
    const investigation = await this.db.investigation.findFirst({
      where: { id: investigationId, workspaceId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        project: { select: { status: true } },
        status: true,
      },
    });

    return investigation
      ? {
          id: investigation.id,
          workspaceId: investigation.workspaceId,
          projectId: investigation.projectId,
          projectStatus: investigation.project.status,
          investigationStatus: investigation.status,
        }
      : null;
  }

  async createEvidence(data: EvidenceCreateData, audit: EvidenceAuditDraft): Promise<EvidenceRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: data.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const evidence = await tx.evidence.create({
        data: {
          id: data.id,
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
          evidenceType: data.evidenceType,
          title: data.title,
          description: data.description,
          fileName: data.fileName,
          quarantineKey: data.quarantineKey,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          checksum: data.checksum,
          source: data.source,
          uploadedBy: data.uploadedBy,
        },
        select: evidenceBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, evidence.id) });

      return mapEvidence(evidence);
    });
  }

  async findEvidence(workspaceId: string, evidenceId: string): Promise<EvidenceDetail | null> {
    const record = await this.db.evidence.findFirst({
      where: { id: evidenceId, workspaceId },
      select: {
        ...evidenceBaseSelect,
        links: {
          orderBy: { createdAt: "asc" },
          select: evidenceLinkSelect,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      ...mapEvidence(record),
      findingLinks: record.links.map(mapLink),
    };
  }

  async updateEvidenceMetadata(
    workspaceId: string,
    evidenceId: string,
    data: EvidenceMetadataUpdateData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.evidence.findFirst({
        where: { id: evidenceId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const evidence = await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          title: data.title,
          description: data.description,
          evidenceType: data.evidenceType,
          source: data.source,
        },
        select: evidenceBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, evidence.id) });

      return mapEvidence(evidence);
    });
  }

  async finalizeEvidence(
    workspaceId: string,
    evidenceId: string,
    data: EvidenceFinalizeData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.evidence.findFirst({
        where: {
          id: evidenceId,
          workspaceId,
          storageKey: null,
          deletedAt: null,
          uploadValidatedAt: null,
        },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const evidence = await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          checksum: data.checksum,
          uploadValidatedAt: new Date(),
          scanFindings: data.scanFindings as Prisma.InputJsonValue,
          redactionStatus: data.redactionStatus,
        },
        select: evidenceBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, evidence.id) });

      return mapEvidence(evidence);
    });
  }

  async activateEvidence(
    workspaceId: string,
    evidenceId: string,
    data: EvidenceActivationData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null> {
    return this.db.$transaction(async (tx) => {
      if (
        !canReviewResearch(
          await requireResearchMember(tx, {
            workspaceId,
            userId: audit.userId,
            role: "RESEARCHER",
          }),
        )
      )
        throw new ResearchOperationError(
          "FORBIDDEN",
          "A current human reviewer must approve evidence promotion.",
        );
      const source = await tx.evidence.findFirst({
        where: { id: evidenceId, workspaceId },
        select: { investigationId: true, version: true },
      });
      if (!source) return null;
      await lockResearchInvestigation(
        tx,
        { workspaceId, userId: audit.userId, role: "RESEARCHER" },
        source.investigationId,
      );
      if (data.executionLease) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${data.executionLease.jobId}::uuid FOR UPDATE`,
        );
        if (
          !(await tx.backgroundJob.findFirst({
            where: {
              id: data.executionLease.jobId,
              workspaceId,
              status: "RUNNING",
              leaseToken: data.executionLease.token,
              leaseUntil: { gt: new Date() },
              cancelRequestedAt: null,
            },
          }))
        )
          return null;
      } else {
        const promotion = await tx.backgroundJob.findUnique({
          where: {
            workspaceId_operationKey: {
              workspaceId,
              operationKey: `promotion:${evidenceId}:v${source.version}`,
            },
          },
        });
        if (!promotion) return null;
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${promotion.id}::uuid FOR UPDATE`,
        );
        const current = await tx.backgroundJob.findFirst({
          where: {
            id: promotion.id,
            workspaceId,
            requestedBy: audit.userId,
            kind: "EVIDENCE_PROMOTION",
            status: { in: ["QUEUED", "RUNNING"] },
            cancelRequestedAt: null,
          },
        });
        const payload = current?.payload as
          { destinationKey?: string; checksum?: string; decision?: string } | undefined;
        if (
          !current ||
          payload?.destinationKey !== data.storageKey ||
          payload?.checksum !== data.expectedChecksum ||
          payload?.decision !== data.redactionStatus
        )
          return null;
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Evidence" WHERE id = ${evidenceId}::uuid AND "workspaceId" = ${workspaceId}::uuid FOR UPDATE`,
      );
      const existing = await tx.evidence.findFirst({
        where: {
          id: evidenceId,
          workspaceId,
          uploadValidatedAt: { not: null },
          storageKey: null,
          deletedAt: null,
          ...(data.expectedChecksum ? { checksum: data.expectedChecksum } : {}),
          ...(data.expectedVersion ? { version: data.expectedVersion } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const evidence = await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          storageKey: data.storageKey,
          quarantineKey: null,
          redactionStatus: data.redactionStatus,
          redactionMethod: data.redactionMethod,
          redactionReviewedBy: data.redactionReviewedBy,
          redactionReviewedAt: data.redactionReviewedAt,
          activatedAt: data.activatedAt,
        },
        select: evidenceBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, evidence.id) });

      return mapEvidence(evidence);
    });
  }

  async rejectEvidence(
    workspaceId: string,
    evidenceId: string,
    now: Date,
    note: string,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceRow | null> {
    return this.db.$transaction(async (tx) => {
      if (
        !canReviewResearch(
          await requireResearchMember(tx, {
            workspaceId,
            userId: audit.userId,
            role: "RESEARCHER",
          }),
        )
      )
        throw new ResearchOperationError("FORBIDDEN", "A human reviewer must reject evidence.");
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Evidence" WHERE id = ${evidenceId}::uuid AND "workspaceId" = ${workspaceId}::uuid FOR UPDATE`,
      );
      const existing = await tx.evidence.findFirst({
        where: { id: evidenceId, workspaceId, storageKey: null, deletedAt: null },
        select: { id: true, quarantineKey: true, investigationId: true },
      });

      if (!existing) {
        return null;
      }
      await lockResearchInvestigation(
        tx,
        { workspaceId, userId: audit.userId, role: "RESEARCHER" },
        existing.investigationId,
      );
      await new PrismaJobStore(tx).enqueue(
        { workspaceId, userId: audit.userId, role: "RESEARCHER" },
        "EVIDENCE_CLEANUP",
        `rejection:${evidenceId}`,
        { evidenceId, quarantineKey: existing.quarantineKey },
      );

      const evidence = await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          redactionStatus: "QUARANTINED",
          redactionReviewedBy: audit.userId,
          redactionReviewedAt: now,
          deletedAt: now,
        },
        select: evidenceBaseSelect,
      });

      await tx.auditLog.create({
        data: auditRow({ ...audit, metadata: { ...audit.metadata, note } }, evidence.id),
      });

      return mapEvidence(evidence);
    });
  }

  async softDeleteEvidence(
    workspaceId: string,
    evidenceId: string,
    now: Date,
    audit: EvidenceAuditDraft,
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Evidence" WHERE id = ${evidenceId}::uuid AND "workspaceId" = ${workspaceId}::uuid FOR UPDATE`,
      );
      await assertEvidenceNotReferenced(tx, workspaceId, evidenceId);
      const existing = await tx.evidence.findFirst({
        where: { id: evidenceId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await tx.evidence.update({
        where: { id: evidenceId },
        data: { deletedAt: now },
        select: { id: true },
      });
      await tx.auditLog.create({ data: auditRow(audit, evidenceId) });
      await tx.backgroundJob.upsert({
        where: {
          workspaceId_operationKey: { workspaceId, operationKey: `evidence-cleanup:${evidenceId}` },
        },
        create: {
          workspaceId,
          requestedBy: audit.userId,
          kind: "EVIDENCE_CLEANUP",
          operationKey: `evidence-cleanup:${evidenceId}`,
          payload: { evidenceId },
        },
        update: {},
      });

      return true;
    });
  }

  async listEvidence(workspaceId: string, investigationId?: string): Promise<EvidenceRow[]> {
    const records = await this.db.evidence.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(investigationId ? { investigationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: evidenceBaseSelect,
    });

    return records.map(mapEvidence);
  }

  async listApprovedEvidence(workspaceId: string, investigationId: string): Promise<EvidenceRow[]> {
    const records = await this.db.evidence.findMany({
      where: {
        workspaceId,
        investigationId,
        deletedAt: null,
        redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
      },
      orderBy: { createdAt: "desc" },
      select: evidenceBaseSelect,
    });

    return records.map(mapEvidence);
  }

  async findFindingForLink(
    workspaceId: string,
    findingId: string,
  ): Promise<EvidenceFindingLookup | null> {
    const finding = await this.db.finding.findFirst({
      where: { id: findingId, workspaceId },
      select: { id: true, investigationId: true, status: true },
    });

    return finding
      ? {
          id: finding.id,
          investigationId: finding.investigationId,
          status: finding.status as FindingStatus,
        }
      : null;
  }

  async createLink(
    data: EvidenceLinkCreateData,
    audit: EvidenceAuditDraft,
  ): Promise<EvidenceFindingLinkRow> {
    return this.db.$transaction(async (tx) =>
      mapLink(await createEvidenceRelationship(tx, data, audit)),
    );
  }

  async removeLink(
    workspaceId: string,
    linkId: string,
    audit: EvidenceAuditDraft,
  ): Promise<boolean> {
    return this.db.$transaction((tx) => removeEvidenceRelationship(tx, workspaceId, linkId, audit));
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
