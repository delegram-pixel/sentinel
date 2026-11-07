import "server-only";
import type { Prisma } from "@/generated/prisma/client";
export async function loadResearchInsights(db: Prisma.TransactionClient, workspaceId: string) {
  const [
    investigations,
    findings,
    evidence,
    missingProvenance,
    assessments,
    knowledge,
    indexedDocuments,
    importRecords,
    remediation,
    outcomes,
    tasks,
    decisions,
  ] = await Promise.all([
    db.investigation.groupBy({ by: ["phase"], where: { workspaceId }, _count: true }),
    db.finding.groupBy({ by: ["status"], where: { workspaceId }, _count: true }),
    db.evidence.groupBy({
      by: ["redactionStatus"],
      where: { workspaceId, deletedAt: null },
      _count: true,
    }),
    db.evidence.count({
      where: { workspaceId, deletedAt: null, OR: [{ collector: null }, { collectedAt: null }] },
    }),
    db.evidenceAssessment.groupBy({ by: ["reviewStatus"], where: { workspaceId }, _count: true }),
    db.knowledgeDocument.groupBy({ by: ["reviewStatus"], where: { workspaceId }, _count: true }),
    db.knowledgeDocument.count({
      where: { workspaceId, reviewStatus: "REVIEWED", chunks: { some: {} } },
    }),
    db.importedResult.groupBy({ by: ["status"], where: { workspaceId }, _count: true }),
    db.remediationPlan.groupBy({ by: ["status"], where: { workspaceId }, _count: true }),
    db.submissionEvent.groupBy({ by: ["outcome"], where: { workspaceId }, _count: true }),
    db.aITask.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, reservedTokens: true },
    }),
    db.researchDecision.count({ where: { workspaceId } }),
  ]);
  return {
    investigations,
    findings,
    evidence,
    missingProvenance,
    assessments,
    knowledge,
    indexedDocuments,
    importRecords,
    remediation,
    outcomes,
    tasks,
    decisions,
  };
}
