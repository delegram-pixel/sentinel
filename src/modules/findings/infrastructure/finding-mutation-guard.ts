import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { confirmationReadiness, reportabilityReadiness } from "../domain/finding";
import { canReviewResearch } from "@/modules/shared/application/actor";
import { requireResearchMember } from "@/modules/shared/infrastructure/research-transaction";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import type { Phase6AuditDraft } from "../application/ports";

export async function guardFindingMutation(
  tx: Prisma.TransactionClient,
  audit: Phase6AuditDraft,
  id: string,
  expectedUpdatedAt?: Date,
  nextStatus?: string,
) {
  const role = await requireResearchMember(tx, {
    workspaceId: audit.workspaceId,
    userId: audit.userId,
    role: "RESEARCHER",
  });
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Finding" WHERE id = ${id}::uuid AND "workspaceId" = ${audit.workspaceId}::uuid FOR UPDATE`,
  );
  const row = await tx.finding.findFirst({
    where: { id, workspaceId: audit.workspaceId },
    select: {
      updatedAt: true,
      status: true,
      severity: true,
      severityRationale: true,
      affectedAsset: true,
      affectedAssetType: true,
      impact: true,
      remediation: true,
      investigation: { select: { status: true, project: { select: { status: true } } } },
    },
  });
  if (!row) return false;
  if (row.investigation.status === "ARCHIVED" || row.investigation.project.status === "ARCHIVED")
    return false;
  if (!expectedUpdatedAt || row.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return false;
  if (row.status === "CLOSED") return false;
  if (
    nextStatus &&
    ["CONFIRMED", "REPORTABLE", "REJECTED", "FALSE_POSITIVE", "CLOSED"].includes(nextStatus) &&
    !canReviewResearch(role)
  )
    throw new ResearchOperationError("FORBIDDEN", "A human reviewer must approve this change.");
  if (nextStatus === "CONFIRMED" || nextStatus === "REPORTABLE") {
    const supportsEvidenceCount = await tx.evidenceLink.count({
      where: {
        findingId: id,
        relationshipType: "SUPPORTS",
        evidence: {
          workspaceId: audit.workspaceId,
          deletedAt: null,
          storageKey: { not: null },
          redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
        },
      },
    });
    const problems = (nextStatus === "REPORTABLE" ? reportabilityReadiness : confirmationReadiness)(
      { ...row, supportsEvidenceCount },
    );
    if (problems.length) return false;
    if (
      nextStatus === "REPORTABLE" &&
      !(await tx.verificationReview.findFirst({
        where: { findingId: id, reviewerType: "HUMAN", conclusion: "CONFIRMED" },
        select: { id: true },
      }))
    )
      return false;
  }
  return true;
}
