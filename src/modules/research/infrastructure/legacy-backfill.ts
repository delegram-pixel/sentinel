import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Operator-only, bounded and resumable. It never grants approval or invents provenance. */
export async function backfillLegacyWorkspace(
  db: Prisma.TransactionClient,
  workspaceId: string,
  afterProjectId?: string,
  batchSize = 50,
) {
  const projects = await db.project.findMany({
    where: { workspaceId, ...(afterProjectId ? { id: { gt: afterProjectId } } : {}) },
    orderBy: { id: "asc" },
    take: Math.min(Math.max(batchSize, 1), 100),
    select: {
      id: true,
      name: true,
      description: true,
      projectType: true,
      ownerId: true,
      createdAt: true,
    },
  });
  for (const project of projects) {
    await db.$transaction(async (tx) => {
      const engagement = await tx.engagement.upsert({
        where: { legacyProjectId: project.id },
        create: {
          workspaceId,
          projectId: project.id,
          legacyProjectId: project.id,
          name: project.name,
          objective: project.description,
          engagementType: project.projectType,
          status: "DRAFT",
          createdBy: project.ownerId,
          createdAt: project.createdAt,
        },
        update: {},
        select: { id: true },
      });
      const targets = await tx.target.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          scopeVersions: { select: { id: true, createdBy: true, createdAt: true } },
        },
      });
      for (const target of targets) {
        const asset = await tx.engagementAsset.upsert({
          where: { engagementId_targetId: { engagementId: engagement.id, targetId: target.id } },
          create: { workspaceId, engagementId: engagement.id, targetId: target.id },
          update: {},
          select: { id: true },
        });
        for (const scope of target.scopeVersions)
          await tx.engagementAuthorization.upsert({
            where: { assetId_scopeVersionId: { assetId: asset.id, scopeVersionId: scope.id } },
            create: {
              workspaceId,
              assetId: asset.id,
              scopeVersionId: scope.id,
              source:
                "Legacy scope association; original approval and validity remain authoritative.",
              recordedBy: scope.createdBy,
              recordedAt: scope.createdAt,
            },
            update: {},
          });
      }
      await tx.investigation.updateMany({
        where: { workspaceId, projectId: project.id, engagementId: null },
        data: { engagementId: engagement.id },
      });
      const summaries = await tx.sessionSummary.findMany({
        where: {
          generatedByType: "HUMAN",
          createdBy: { not: null },
          investigation: { workspaceId, projectId: project.id },
        },
        select: {
          id: true,
          investigationId: true,
          summary: true,
          createdBy: true,
          createdAt: true,
        },
      });
      for (const summary of summaries)
        if (summary.createdBy)
          await tx.researchDecision.upsert({
            where: { legacySourceId: `session-summary:${summary.id}` },
            create: {
              workspaceId,
              investigationId: summary.investigationId,
              rationale: summary.summary,
              kind: "RESEARCH_NOTE",
              createdBy: summary.createdBy,
              createdAt: summary.createdAt,
              legacySourceId: `session-summary:${summary.id}`,
            },
            update: {},
          });
    });
  }
  return {
    processed: projects.length,
    cursor: projects.at(-1)?.id ?? afterProjectId ?? null,
    hasMore: projects.length === Math.min(Math.max(batchSize, 1), 100),
  };
}
