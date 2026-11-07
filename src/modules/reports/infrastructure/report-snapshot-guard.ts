import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { reportReadinessProblems } from "../domain/report";
import type { ReportEvidenceSnapshot, ReportFindingSnapshot } from "../application/ports";
import { lockResearchInvestigation } from "@/modules/shared/infrastructure/research-transaction";
import type { ResearchActor } from "@/modules/shared/application/actor";

/** Source locks serialize new snapshots with evidence deletion and human finding edits. */
export async function guardReportSnapshot(
  tx: Prisma.TransactionClient,
  actor: ResearchActor,
  investigationId: string,
  findings: ReportFindingSnapshot[],
  evidence: ReportEvidenceSnapshot[],
) {
  await lockResearchInvestigation(tx, actor, investigationId);
  if (!findings.length) return false;
  const ids = [...new Set(findings.map((f) => f.findingId))].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Finding" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`,
  );
  const evidenceIds = [...new Set(evidence.map((e) => e.evidenceId))].sort();
  if (evidenceIds.length)
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Evidence" WHERE id IN (${Prisma.join(evidenceIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`,
    );
  const rows = await tx.finding.findMany({
    where: { id: { in: ids }, workspaceId: actor.workspaceId, investigationId },
    include: { evidenceLinks: { include: { evidence: true } } },
  });
  if (rows.length !== ids.length) return false;
  for (const row of rows) {
    const snapshot = findings.find((f) => f.findingId === row.id)!;
    if (snapshot.sourceUpdatedAt && snapshot.sourceUpdatedAt !== row.updatedAt.toISOString())
      return false;
    if (
      snapshot.title !== row.title ||
      snapshot.status !== row.status ||
      snapshot.severity !== row.severity ||
      snapshot.affectedAsset !== row.affectedAsset ||
      snapshot.affectedAssetType !== row.affectedAssetType
    )
      return false;
    const approved = row.evidenceLinks.filter(
      (l) =>
        !l.evidence.deletedAt &&
        l.evidence.storageKey &&
        ["REDACTED", "VERIFIED_SAFE"].includes(l.evidence.redactionStatus),
    );
    if (
      reportReadinessProblems({
        investigationTitle: "",
        projectName: "",
        targetName: "",
        targetAssetIdentifier: "",
        generatedAt: new Date(),
        findings: [
          {
            ...row,
            evidence: approved.map((l) => ({
              evidenceId: l.evidence.id,
              title: l.evidence.title,
              evidenceType: l.evidence.evidenceType,
              redactionStatus: l.evidence.redactionStatus,
              relationshipType: l.relationshipType,
              version: l.evidence.version,
              checksum: l.evidence.checksum,
            })),
          },
        ],
      }).length
    )
      return false;
    for (const e of evidence.filter((e) => !e.findingId || e.findingId === row.id)) {
      const link = approved.find(
        (l) => l.evidenceId === e.evidenceId && l.relationshipType === e.relationshipType,
      );
      if (!link) {
        if (e.findingId) return false;
        continue;
      }
      if (
        link.evidence.version !== e.version ||
        link.evidence.checksum !== e.checksum ||
        link.evidence.title !== e.title ||
        link.evidence.redactionStatus !== e.redactionStatus
      )
        return false;
    }
  }
  return evidence.every((e) =>
    rows.some(
      (r) =>
        (!e.findingId || r.id === e.findingId) &&
        r.evidenceLinks.some(
          (l) =>
            l.evidenceId === e.evidenceId &&
            l.relationshipType === e.relationshipType &&
            !l.evidence.deletedAt,
        ),
    ),
  );
}
