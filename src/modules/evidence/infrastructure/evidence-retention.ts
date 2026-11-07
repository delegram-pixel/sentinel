import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError } from "@/modules/shared/domain/result";
export async function assertEvidenceNotReferenced(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  evidenceId: string,
) {
  const checks = [
    await tx.evidenceLink.count({ where: { evidenceId } }),
    await tx.evidenceResearchLink.count({ where: { evidenceId, workspaceId } }),
    await tx.evidenceAssessment.count({ where: { evidenceId, workspaceId } }),
    await tx.verificationReview.count({
      where: {
        finding: { workspaceId },
        OR: [
          { supportingEvidence: { array_contains: [evidenceId] } },
          { contradictingEvidence: { array_contains: [evidenceId] } },
          {
            basis: {
              path: ["availableApprovedLinkedEvidence"],
              array_contains: [{ evidence: { id: evidenceId } }],
            },
          },
        ],
      },
    }),
    await tx.reportRevision.count({
      where: { report: { workspaceId }, evidenceSnapshot: { array_contains: [{ evidenceId }] } },
    }),
    await tx.aITask.count({
      where: {
        workspaceId,
        OR: [
          { inputContext: { path: ["evidence"], array_contains: [{ id: evidenceId }] } },
          {
            inputContext: { path: ["sourceManifest", "evidenceIds"], array_contains: [evidenceId] },
          },
        ],
      },
    }),
    await tx.researchDecision.count({
      where: {
        workspaceId,
        sourceRefs: { array_contains: [{ kind: "EVIDENCE", id: evidenceId }] },
      },
    }),
    await tx.retestRecord.count({
      where: { workspaceId, evidenceIds: { array_contains: [{ id: evidenceId }] } },
    }),
    await tx.evidence.count({ where: { workspaceId, supersedesId: evidenceId } }),
  ];
  if (checks.some((count) => count > 0))
    throw new ResearchOperationError(
      "EVIDENCE_IN_USE",
      "This evidence is referenced by research, an assessment, AI context or a report revision and must be retained.",
    );
}
