import "server-only";
import { guardFindingMutation } from "./finding-mutation-guard";
import {
  createEvidenceRelationship,
  removeEvidenceRelationship,
} from "@/modules/evidence/infrastructure/prisma-evidence-relationships";

import { Prisma } from "@/generated/prisma/client";

import type { AuditEvent } from "@/modules/audit/domain/audit";
import type { AssetType } from "@/modules/research/domain/target";
import { assertConclusionMatchesReviewer } from "@/modules/verification/domain/verification-conclusion";

import type { FindingStatus } from "../domain/finding-status";
import type { ResolutionReason, Severity } from "../domain/finding";
import type {
  ApprovedEvidenceRow,
  DuplicateCandidate,
  FindingCreateData,
  FindingDetail,
  FindingEvidenceLinkCreateData,
  FindingEvidenceLinkRow,
  FindingRow,
  FindingSeverityData,
  FindingStore,
  FindingTransitionData,
  FindingUpdateData,
  Phase6AuditDraft,
  VerificationReviewCreateData,
  VerificationReviewRow,
} from "../application/ports";

type Db = Prisma.TransactionClient;

const findingBaseSelect = {
  id: true,
  workspaceId: true,
  investigationId: true,
  hypothesisId: true,
  title: true,
  titleNormalized: true,
  description: true,
  vulnerabilityCategory: true,
  severity: true,
  severityRationale: true,
  affectedAsset: true,
  affectedAssetType: true,
  status: true,
  resolutionReason: true,
  impact: true,
  remediation: true,
  verifiedAt: true,
  createdBy: true,
  approvedBy: true,
  approvedAt: true,
  duplicateOfId: true,
  duplicateConfirmedBy: true,
  duplicateConfirmedAt: true,
  createdAt: true,
  updatedAt: true,
  investigation: { select: { title: true, projectId: true } },
  hypothesis: { select: { title: true } },
  evidenceLinks: { select: { relationshipType: true } },
} satisfies Prisma.FindingSelect;

type FindingBaseRecord = Prisma.FindingGetPayload<{ select: typeof findingBaseSelect }>;

const verificationReviewSelect = {
  id: true,
  findingId: true,
  taskId: true,
  reviewerType: true,
  reviewerUserId: true,
  conclusion: true,
  supportingEvidence: true,
  contradictingEvidence: true,
  missingEvidence: true,
  impactAssessment: true,
  reasoningSummary: true,
  createdAt: true,
} satisfies Prisma.VerificationReviewSelect;

type VerificationReviewRecord = Prisma.VerificationReviewGetPayload<{
  select: typeof verificationReviewSelect;
}>;

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function auditRow(event: Phase6AuditDraft, entityId: string): Prisma.AuditLogCreateInput {
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

function mapReview(review: VerificationReviewRecord): VerificationReviewRow {
  return {
    id: review.id,
    findingId: review.findingId,
    taskId: review.taskId,
    reviewerType: review.reviewerType,
    reviewerUserId: review.reviewerUserId,
    conclusion: review.conclusion,
    supportingEvidence: stringArray(review.supportingEvidence),
    contradictingEvidence: stringArray(review.contradictingEvidence),
    missingEvidence: stringArray(review.missingEvidence),
    impactAssessment: review.impactAssessment,
    reasoningSummary: review.reasoningSummary,
    createdAt: review.createdAt,
  };
}

function mapFinding(record: FindingBaseRecord): FindingRow {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    investigationId: record.investigationId,
    investigationTitle: record.investigation.title,
    projectId: record.investigation.projectId,
    hypothesisId: record.hypothesisId,
    hypothesisTitle: record.hypothesis?.title ?? null,
    title: record.title,
    titleNormalized: record.titleNormalized,
    description: record.description,
    vulnerabilityCategory: record.vulnerabilityCategory,
    severity: record.severity as Severity,
    severityRationale: record.severityRationale,
    affectedAsset: record.affectedAsset,
    affectedAssetType: record.affectedAssetType as AssetType | null,
    status: record.status as FindingStatus,
    resolutionReason: record.resolutionReason as ResolutionReason | null,
    impact: record.impact,
    remediation: record.remediation,
    verifiedAt: record.verifiedAt,
    createdBy: record.createdBy,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    duplicateOfId: record.duplicateOfId,
    duplicateConfirmedBy: record.duplicateConfirmedBy,
    duplicateConfirmedAt: record.duplicateConfirmedAt,
    supportingEvidenceCount: record.evidenceLinks.filter(
      (link) => link.relationshipType === "SUPPORTS",
    ).length,
    evidenceLinkCount: record.evidenceLinks.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapEvidenceLink(link: {
  id: string;
  evidenceId: string;
  relationshipType: FindingEvidenceLinkRow["relationshipType"];
  createdAt: Date;
  evidence: {
    title: string;
    evidenceType: FindingEvidenceLinkRow["evidenceType"];
    redactionStatus: FindingEvidenceLinkRow["redactionStatus"];
  };
}): FindingEvidenceLinkRow {
  return {
    id: link.id,
    evidenceId: link.evidenceId,
    evidenceTitle: link.evidence.title,
    evidenceType: link.evidence.evidenceType,
    redactionStatus: link.evidence.redactionStatus,
    relationshipType: link.relationshipType,
    createdAt: link.createdAt,
  };
}

export class PrismaFindingStore implements FindingStore {
  constructor(private readonly db: Db) {}

  async findInvestigation(workspaceId: string, investigationId: string) {
    return this.db.investigation
      .findFirst({
        where: { id: investigationId, workspaceId },
        select: {
          id: true,
          workspaceId: true,
          projectId: true,
          project: { select: { status: true } },
          status: true,
        },
      })
      .then((investigation) =>
        investigation
          ? {
              id: investigation.id,
              workspaceId: investigation.workspaceId,
              projectId: investigation.projectId,
              projectStatus: investigation.project.status,
              investigationStatus: investigation.status,
            }
          : null,
      );
  }

  async findHypothesis(
    workspaceId: string,
    investigationId: string,
    hypothesisId: string,
  ): Promise<{ id: string; title: string } | null> {
    return this.db.hypothesis.findFirst({
      where: {
        id: hypothesisId,
        investigationId,
        investigation: { workspaceId },
      },
      select: { id: true, title: true },
    });
  }

  async listFindings(workspaceId: string, investigationId?: string): Promise<FindingRow[]> {
    const records = await this.db.finding.findMany({
      where: {
        workspaceId,
        ...(investigationId ? { investigationId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: findingBaseSelect,
    });

    return records.map(mapFinding);
  }

  async findFinding(workspaceId: string, findingId: string): Promise<FindingDetail | null> {
    const record = await this.db.finding.findFirst({
      where: { id: findingId, workspaceId },
      select: {
        ...findingBaseSelect,
        evidenceLinks: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            evidenceId: true,
            relationshipType: true,
            createdAt: true,
            evidence: {
              select: {
                title: true,
                evidenceType: true,
                redactionStatus: true,
              },
            },
          },
        },
        verificationReviews: {
          orderBy: { createdAt: "desc" },
          select: verificationReviewSelect,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      ...mapFinding(record),
      evidenceLinks: record.evidenceLinks.map(mapEvidenceLink),
      verificationReviews: record.verificationReviews.map(mapReview),
    };
  }

  async createFinding(data: FindingCreateData, audit: Phase6AuditDraft): Promise<FindingRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: data.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      if (data.hypothesisId) {
        const hypothesis = await tx.hypothesis.findFirst({
          where: { id: data.hypothesisId, investigationId: data.investigationId },
          select: { id: true },
        });

        if (!hypothesis) {
          throw new Error("The hypothesis does not belong to this investigation.");
        }
      }

      const finding = await tx.finding.create({
        data: {
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
          hypothesisId: data.hypothesisId,
          title: data.title,
          titleNormalized: data.titleNormalized,
          description: data.description,
          vulnerabilityCategory: data.vulnerabilityCategory,
          affectedAsset: data.affectedAsset,
          affectedAssetType: data.affectedAssetType,
          impact: data.impact,
          remediation: data.remediation,
          createdBy: data.createdBy,
        },
        select: findingBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, finding.id) });

      return mapFinding(finding);
    });
  }

  async updateFinding(
    workspaceId: string,
    findingId: string,
    data: FindingUpdateData,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null> {
    return this.db.$transaction(async (tx) => {
      if (!(await guardFindingMutation(tx, audit, findingId, data.expectedUpdatedAt))) return null;
      const existing = await tx.finding.findFirst({
        where: { id: findingId, workspaceId },
        select: { id: true, hypothesisId: true, investigationId: true },
      });

      if (!existing) {
        return null;
      }

      if (data.hypothesisId) {
        const hypothesis = await tx.hypothesis.findFirst({
          where: { id: data.hypothesisId, investigationId: existing.investigationId },
          select: { id: true },
        });

        if (!hypothesis) {
          throw new Error("The hypothesis does not belong to this investigation.");
        }
      }

      const finding = await tx.finding.update({
        where: { id: findingId },
        data: {
          hypothesisId: data.hypothesisId,
          title: data.title,
          titleNormalized: data.titleNormalized,
          description: data.description,
          vulnerabilityCategory: data.vulnerabilityCategory,
          affectedAsset: data.affectedAsset,
          affectedAssetType: data.affectedAssetType,
          impact: data.impact,
          remediation: data.remediation,
        },
        select: findingBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, finding.id) });

      return mapFinding(finding);
    });
  }

  async assessSeverity(
    workspaceId: string,
    findingId: string,
    data: FindingSeverityData,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null> {
    return this.db.$transaction(async (tx) => {
      if (!(await guardFindingMutation(tx, audit, findingId, data.expectedUpdatedAt))) return null;
      const existing = await tx.finding.findFirst({
        where: { id: findingId, workspaceId },
        select: { id: true, status: true },
      });

      if (!existing) {
        return null;
      }

      const finding = await tx.finding.update({
        where: { id: findingId },
        data: {
          severity: data.severity,
          severityRationale: data.severityRationale,
          affectedAsset: data.affectedAsset,
          affectedAssetType: data.affectedAssetType,
          severityAssessedBy: data.assessedBy,
          severityAssessedAt: data.assessedAt,
        },
        select: findingBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, finding.id) });

      return mapFinding(finding);
    });
  }

  async transitionFinding(
    workspaceId: string,
    findingId: string,
    data: FindingTransitionData,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null> {
    return this.db.$transaction(async (tx) => {
      if (!(await guardFindingMutation(tx, audit, findingId, data.expectedUpdatedAt, data.status)))
        return null;
      const existing = await tx.finding.findFirst({
        where: { id: findingId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const finding = await tx.finding.update({
        where: { id: findingId },
        data: {
          status: data.status,
          resolutionReason: data.resolutionReason,
          ...(data.approvedBy !== undefined ? { approvedBy: data.approvedBy } : {}),
          ...(data.approvedAt !== undefined ? { approvedAt: data.approvedAt } : {}),
          ...(data.verifiedAt !== undefined ? { verifiedAt: data.verifiedAt } : {}),
        },
        select: findingBaseSelect,
      });

      await tx.auditLog.create({ data: auditRow(audit, finding.id) });

      if (data.status === "CLOSED") {
        if (!data.rationale || data.rationale.trim().length < 10)
          throw new Error("A human closure rationale is required.");
        await tx.researchDecision.create({
          data: {
            workspaceId,
            investigationId: finding.investigationId,
            findingId: finding.id,
            kind: "CLOSE_FINDING",
            rationale: data.rationale,
            sourceRefs: [{ kind: "FINDING", id: finding.id, relationship: "CONTEXT" }],
            createdBy: audit.userId,
          },
        });
      }

      return mapFinding(finding);
    });
  }

  async createVerificationReview(
    data: VerificationReviewCreateData,
    transition: FindingTransitionData | null,
    audit: Phase6AuditDraft,
  ): Promise<{ review: VerificationReviewRow; finding: FindingRow } | null> {
    if (!assertConclusionMatchesReviewer(data.reviewerType, data.conclusion)) {
      throw new Error(
        "The verification conclusion does not match the reviewer type. Only a human reviewer may record CONFIRMED.",
      );
    }

    return this.db.$transaction(async (tx) => {
      if (
        !(await guardFindingMutation(
          tx,
          audit,
          data.findingId,
          data.expectedUpdatedAt,
          transition?.status,
        ))
      )
        return null;
      const existing = await tx.finding.findFirst({
        where: { id: data.findingId, workspaceId: audit.workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const review = await tx.verificationReview.create({
        data: {
          basis: {
            snapshotVersion: 1,
            findingUpdatedAt: data.expectedUpdatedAt?.toISOString() ?? null,
            availableApprovedLinkedEvidence: await tx.evidenceLink.findMany({
              where: {
                findingId: data.findingId,
                evidence: {
                  deletedAt: null,
                  storageKey: { not: null },
                  redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
                },
              },
              select: {
                relationshipType: true,
                evidence: { select: { id: true, version: true, checksum: true } },
              },
            }),
          },
          findingId: data.findingId,
          taskId: data.taskId ?? null,
          reviewerType: data.reviewerType,
          reviewerUserId: data.reviewerUserId,
          conclusion: data.conclusion,
          supportingEvidence: data.supportingEvidence ?? [],
          contradictingEvidence: data.contradictingEvidence ?? [],
          missingEvidence: data.missingEvidence ?? [],
          impactAssessment: data.impactAssessment,
          reasoningSummary: data.reasoningSummary,
        },
        select: verificationReviewSelect,
      });

      const finding = transition
        ? await tx.finding.update({
            where: { id: data.findingId },
            data: {
              status: transition.status,
              resolutionReason: transition.resolutionReason,
              ...(transition.approvedBy !== undefined ? { approvedBy: transition.approvedBy } : {}),
              ...(transition.approvedAt !== undefined ? { approvedAt: transition.approvedAt } : {}),
              ...(transition.verifiedAt !== undefined ? { verifiedAt: transition.verifiedAt } : {}),
            },
            select: findingBaseSelect,
          })
        : await tx.finding.findUniqueOrThrow({
            where: { id: data.findingId },
            select: findingBaseSelect,
          });

      await tx.auditLog.create({ data: auditRow(audit, finding.id) });

      if (data.reviewerType === "HUMAN")
        await tx.researchDecision.create({
          data: {
            workspaceId: audit.workspaceId,
            investigationId: finding.investigationId,
            findingId: finding.id,
            kind: data.conclusion === "NEEDS_MORE_EVIDENCE" ? "MORE_RESEARCH" : "RESEARCH_NOTE",
            rationale:
              data.reasoningSummary?.trim() ||
              `Human verification conclusion: ${data.conclusion}. Historical review ${review.id}.`,
            sourceRefs: [{ kind: "VERIFICATION_REVIEW", id: review.id, relationship: "CONTEXT" }],
            legacySourceId: `human-review:${review.id}`,
            createdBy: audit.userId,
          },
        });

      return { review: mapReview(review), finding: mapFinding(finding) };
    });
  }

  async listVerificationReviews(
    workspaceId: string,
    findingId: string,
  ): Promise<VerificationReviewRow[]> {
    const finding = await this.db.finding.findFirst({
      where: { id: findingId, workspaceId },
      select: { id: true },
    });

    if (!finding) {
      return [];
    }

    const reviews = await this.db.verificationReview.findMany({
      where: { findingId },
      orderBy: { createdAt: "desc" },
      select: verificationReviewSelect,
    });

    return reviews.map(mapReview);
  }

  async findSimilarFindings(input: {
    workspaceId: string;
    investigationId: string;
    titleNormalized: string;
    vulnerabilityCategory: string | null;
    excludeFindingId?: string;
  }): Promise<DuplicateCandidate[]> {
    const categoryFilter = input.vulnerabilityCategory
      ? Prisma.sql`AND "vulnerabilityCategory" = ${input.vulnerabilityCategory}`
      : Prisma.empty;
    const excludeFilter = input.excludeFindingId
      ? Prisma.sql`AND "id" <> ${input.excludeFindingId}::uuid`
      : Prisma.empty;

    const rows = await this.db.$queryRaw<Array<{ id: string; similarity: number }>>(
      Prisma.sql`
        SELECT "id", similarity("titleNormalized", ${input.titleNormalized}) AS similarity
        FROM "Finding"
        WHERE "workspaceId" = ${input.workspaceId}::uuid
          AND "investigationId" = ${input.investigationId}::uuid
          ${excludeFilter}
          ${categoryFilter}
          AND similarity("titleNormalized", ${input.titleNormalized}) >= 0.55
        ORDER BY similarity DESC
        LIMIT 5
      `,
    );

    if (rows.length === 0) {
      return [];
    }

    const findings = await this.db.finding.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: {
        id: true,
        title: true,
        status: true,
        vulnerabilityCategory: true,
      },
    });
    const byId = new Map(findings.map((finding) => [finding.id, finding]));

    return rows.flatMap((row) => {
      const finding = byId.get(row.id);

      return finding
        ? [
            {
              id: finding.id,
              title: finding.title,
              status: finding.status as FindingStatus,
              vulnerabilityCategory: finding.vulnerabilityCategory,
              similarity: Number(row.similarity),
            },
          ]
        : [];
    });
  }

  async findDuplicateTarget(
    workspaceId: string,
    findingId: string,
  ): Promise<{ id: string; duplicateOfId: string | null; investigationId: string } | null> {
    return this.db.finding.findFirst({
      where: { id: findingId, workspaceId },
      select: { id: true, duplicateOfId: true, investigationId: true },
    });
  }

  async confirmDuplicate(
    workspaceId: string,
    findingId: string,
    canonicalFindingId: string,
    userId: string,
    now: Date,
    audit: Phase6AuditDraft,
  ): Promise<FindingRow | null> {
    if (findingId === canonicalFindingId) {
      throw new Error("A finding cannot be a duplicate of itself.");
    }

    return this.db.$transaction(async (tx) => {
      const finding = await tx.finding.findFirst({
        where: { id: findingId, workspaceId },
        select: { id: true, investigationId: true, status: true },
      });
      const canonical = await tx.finding.findFirst({
        where: { id: canonicalFindingId, workspaceId },
        select: { id: true, investigationId: true, duplicateOfId: true },
      });

      if (!finding || !canonical) {
        return null;
      }

      if (canonical.investigationId !== finding.investigationId) {
        throw new Error("The duplicate must belong to the same investigation.");
      }

      const seen = new Set<string>([canonical.id]);
      let cursor = canonical.duplicateOfId;

      while (cursor) {
        if (cursor === finding.id) {
          throw new Error("That duplicate relationship would create a cycle.");
        }

        if (seen.has(cursor)) {
          break;
        }

        seen.add(cursor);

        const parent = await tx.finding.findUnique({
          where: { id: cursor },
          select: { duplicateOfId: true },
        });
        cursor = parent?.duplicateOfId ?? null;
      }

      const updated = await tx.finding.update({
        where: { id: findingId },
        data: {
          duplicateOfId: canonicalFindingId,
          duplicateConfirmedBy: userId,
          duplicateConfirmedAt: now,
          status: "REJECTED",
          resolutionReason: "DUPLICATE",
        },
        select: findingBaseSelect,
      });

      await tx.auditLog.create({
        data: auditRow(
          {
            ...audit,
            previousValue: { status: finding.status, duplicateOfId: null },
            newValue: {
              status: "REJECTED",
              resolutionReason: "DUPLICATE",
              duplicateOfId: canonicalFindingId,
            },
          },
          updated.id,
        ),
      });

      return mapFinding(updated);
    });
  }

  async listApprovedEvidence(
    workspaceId: string,
    investigationId: string,
  ): Promise<ApprovedEvidenceRow[]> {
    return this.db.evidence.findMany({
      where: {
        workspaceId,
        investigationId,
        deletedAt: null,
        redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        evidenceType: true,
        redactionStatus: true,
      },
    });
  }

  async createEvidenceLink(
    data: FindingEvidenceLinkCreateData,
    audit: Phase6AuditDraft,
  ): Promise<FindingEvidenceLinkRow> {
    return this.db.$transaction(async (tx) =>
      mapEvidenceLink(await createEvidenceRelationship(tx, data, audit)),
    );
  }

  async removeEvidenceLink(
    workspaceId: string,
    linkId: string,
    audit: Phase6AuditDraft,
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
