import "server-only";

import { Prisma } from "@/generated/prisma/client";

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
  redactionStatus: true,
  redactionMethod: true,
  scanFindings: true,
  uploadedBy: true,
  redactionReviewedBy: true,
  redactionReviewedAt: true,
  activatedAt: true,
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
    redactionStatus: record.redactionStatus as RedactionStatus,
    redactionMethod: record.redactionMethod,
    scanFindings: record.scanFindings,
    uploadedBy: record.uploadedBy,
    redactionReviewedBy: record.redactionReviewedBy,
    redactionReviewedAt: record.redactionReviewedAt,
    activatedAt: record.activatedAt,
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
        where: { id: evidenceId, workspaceId },
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
          quarantineKey: null,
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
    return this.db.$transaction(async (tx) => {
      const evidence = await tx.evidence.findFirst({
        where: { id: data.evidenceId, workspaceId: data.workspaceId, deletedAt: null },
        select: { id: true, investigationId: true, redactionStatus: true },
      });
      const finding = await tx.finding.findFirst({
        where: { id: data.findingId, workspaceId: data.workspaceId },
        select: { id: true, investigationId: true, status: true },
      });

      if (!evidence || !finding) {
        throw new Error("The evidence or finding does not exist in this workspace.");
      }

      if (evidence.investigationId !== finding.investigationId) {
        throw new Error("Evidence and finding must belong to the same investigation.");
      }

      if (evidence.redactionStatus !== "REDACTED" && evidence.redactionStatus !== "VERIFIED_SAFE") {
        throw new Error("Only approved evidence can be linked to a finding.");
      }

      if (finding.status === "CLOSED") {
        throw new Error("Evidence cannot be linked to a closed finding.");
      }

      const link = await tx.evidenceLink.create({
        data: {
          evidenceId: data.evidenceId,
          findingId: data.findingId,
          relationshipType: data.relationshipType,
        },
        select: evidenceLinkSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, link.id) });

      return mapLink(link);
    });
  }

  async removeLink(
    workspaceId: string,
    linkId: string,
    audit: EvidenceAuditDraft,
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const link = await tx.evidenceLink.findFirst({
        where: { id: linkId, evidence: { workspaceId } },
        select: { id: true },
      });

      if (!link) {
        return false;
      }

      await tx.evidenceLink.delete({ where: { id: linkId } });
      await tx.auditLog.create({ data: auditRow(audit, linkId) });

      return true;
    });
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
