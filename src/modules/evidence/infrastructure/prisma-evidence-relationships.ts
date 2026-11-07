import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError } from "@/modules/shared/application/actor";
import {
  assertEvidenceRelationshipMutable,
  assertEvidenceUnlinkAllowed,
} from "../domain/relationship";
import type { EvidenceAuditDraft, EvidenceLinkCreateData } from "../application/ports";

const select = {
  id: true,
  evidenceId: true,
  findingId: true,
  relationshipType: true,
  createdAt: true,
  finding: { select: { title: true, status: true } },
  evidence: { select: { title: true, evidenceType: true, redactionStatus: true } },
} satisfies Prisma.EvidenceLinkSelect;

async function lockedFinding(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  id: string,
  userId: string,
) {
  if (
    !(await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    }))
  )
    throw new ResearchOperationError("FORBIDDEN", "You no longer have access to this workspace.");
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Finding" WHERE id = ${id}::uuid AND "workspaceId" = ${workspaceId}::uuid FOR UPDATE`,
  );
  const row = await tx.finding.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      investigationId: true,
      status: true,
      investigation: { select: { status: true, project: { select: { status: true } } } },
    },
  });
  if (!row)
    throw new ResearchOperationError("NOT_FOUND", "The finding does not exist in this workspace.");
  assertEvidenceRelationshipMutable({
    status: row.status,
    investigationStatus: row.investigation.status,
    projectStatus: row.investigation.project.status,
  });
  return row;
}
async function auditLink(tx: Prisma.TransactionClient, event: EvidenceAuditDraft, id: string) {
  await tx.auditLog.create({
    data: {
      workspaceId: event.workspaceId,
      userId: event.userId,
      action: event.action,
      entityType: "EvidenceLink",
      entityId: id,
      previousValue: event.previousValue as Prisma.InputJsonValue | undefined,
      newValue: event.newValue as Prisma.InputJsonValue | undefined,
    },
  });
}
export async function createEvidenceRelationship(
  tx: Prisma.TransactionClient,
  input: EvidenceLinkCreateData,
  audit: EvidenceAuditDraft,
) {
  const finding = await lockedFinding(tx, input.workspaceId, input.findingId, audit.userId);
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Evidence" WHERE id = ${input.evidenceId}::uuid AND "workspaceId" = ${input.workspaceId}::uuid FOR UPDATE`,
  );
  const evidence = await tx.evidence.findFirst({
    where: {
      id: input.evidenceId,
      workspaceId: input.workspaceId,
      investigationId: finding.investigationId,
      deletedAt: null,
      storageKey: { not: null },
      redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
    },
    select: { id: true },
  });
  if (!evidence)
    throw new ResearchOperationError(
      "EVIDENCE_NOT_APPROVED",
      "Choose approved evidence from the same investigation.",
    );
  const link = await tx.evidenceLink.upsert({
    where: {
      evidenceId_findingId_relationshipType: {
        evidenceId: input.evidenceId,
        findingId: input.findingId,
        relationshipType: input.relationshipType,
      },
    },
    create: {
      evidenceId: input.evidenceId,
      findingId: input.findingId,
      relationshipType: input.relationshipType,
    },
    update: {},
    select,
  });
  await auditLink(tx, audit, link.id);
  return link;
}
export async function removeEvidenceRelationship(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  linkId: string,
  audit: EvidenceAuditDraft,
) {
  const link = await tx.evidenceLink.findFirst({
    where: { id: linkId, finding: { workspaceId }, evidence: { workspaceId } },
    select: { id: true, findingId: true, relationshipType: true },
  });
  if (!link) return false;
  const finding = await lockedFinding(tx, workspaceId, link.findingId, audit.userId);
  const supportCount = await tx.evidenceLink.count({
    where: {
      findingId: finding.id,
      id: { not: link.id },
      relationshipType: "SUPPORTS",
      evidence: {
        deletedAt: null,
        redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
        storageKey: { not: null },
      },
    },
  });
  assertEvidenceUnlinkAllowed(finding.status, link.relationshipType, supportCount);
  const removed = await tx.evidenceLink.deleteMany({ where: { id: linkId } });
  if (removed.count) await auditLink(tx, audit, linkId);
  return removed.count === 1;
}
