import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { canonicalJson } from "@/modules/shared/domain/json";
import {
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import type { ResearchActor } from "@/modules/shared/application/actor";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import { slugifyProjectName } from "@/modules/research/domain/project";
import { endOfDayUtc, parseDateOnly } from "@/modules/research/domain/fields";
import { bountyReviewSchema, scopeIdentifier, targetForAsset } from "../domain/bounty-import";

export async function saveBountyProject(
  db: Prisma.TransactionClient,
  actor: ResearchActor,
  raw: unknown,
): Promise<{ id: string }> {
  const parsed = bountyReviewSchema.safeParse(raw);
  if (!parsed.success)
    throw new ResearchOperationError(
      "VALIDATION_FAILED",
      parsed.error.issues[0]?.message ?? "Check the imported details.",
    );
  const input = parsed.data;
  const fingerprint = createHash("sha256").update(canonicalJson(input)).digest("hex");
  return db.$transaction(
    async (tx) => {
      await requireResearchMember(tx, actor);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Workspace" WHERE id = ${actor.workspaceId}::uuid FOR UPDATE`,
      );
      const job = await tx.backgroundJob.findFirst({
        where: {
          id: input.importJobId,
          workspaceId: actor.workspaceId,
          requestedBy: actor.userId,
          kind: "BOUNTY_IMPORT",
          status: "SUCCEEDED",
        },
      });
      if (!job)
        throw new ResearchOperationError(
          "NOT_FOUND",
          "Reopen your completed bounty import before saving.",
        );
      const previous = job.result as { savedProjectId?: string; fingerprint?: string } | null;
      if (previous?.savedProjectId) {
        if (previous.fingerprint !== fingerprint)
          throw new ResearchOperationError(
            "CONFLICT",
            "This import has already been saved. Open its project to make further changes.",
          );
        return { id: previous.savedProjectId };
      }
      const base = slugifyProjectName(input.project.name);
      let slug = base;
      for (
        let attempt = 2;
        await tx.project.findUnique({
          where: { workspaceId_slug: { workspaceId: actor.workspaceId, slug } },
          select: { id: true },
        });
        attempt++
      )
        slug = `${base}-${attempt}`;
      const project = await tx.project.create({
        data: {
          workspaceId: actor.workspaceId,
          ownerId: actor.userId,
          name: input.project.name,
          description: input.project.description,
          projectType: "BUG_BOUNTY",
          slug,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "Project", project.id, "PROJECT_CREATED", {
        source: "BOUNTY_IMPORT",
        importJobId: job.id,
      });
      for (const asset of input.assets.filter((asset) => asset.effect === "ALLOWED")) {
        const target = await tx.target.create({
          data: {
            projectId: project.id,
            ...targetForAsset(asset, input),
            authorizationStatus: "UNVERIFIED",
          },
          select: { id: true },
        });
        await researchAudit(tx, actor, "Target", target.id, "TARGET_CREATED", {
          source: "BOUNTY_IMPORT",
          authorizationStatus: "UNVERIFIED",
        });
        const scope = await tx.scopeVersion.create({
          data: {
            targetId: target.id,
            version: 1,
            status: "DRAFT",
            createdBy: actor.userId,
            effectiveFrom: input.effectiveFrom ? parseDateOnly(input.effectiveFrom) : null,
            effectiveUntil: input.effectiveUntil
              ? endOfDayUtc(parseDateOnly(input.effectiveUntil)!)
              : null,
            attestationNotes: input.authorizationNotes,
            // Each target gets its own boundary and all exclusions. Allowed
            // siblings never expand the authority of this target's draft.
            assets: {
              create: [asset, ...input.assets.filter((row) => row.effect === "EXCLUDED")].map(
                (row) => ({
                  assetIdentifier: scopeIdentifier(row.assetIdentifier),
                  assetType: row.assetType,
                  matchType: row.matchType,
                  effect: row.effect,
                  notes: row.notes,
                }),
              ),
            },
            activities: {
              create: [...new Set(input.permittedActivities)].map((activity) => ({
                activity,
                effect: "PERMITTED" as const,
              })),
            },
          },
          select: { id: true },
        });
        await researchAudit(tx, actor, "ScopeVersion", scope.id, "SCOPE_DRAFT_CREATED", {
          source: "BOUNTY_IMPORT",
          targetId: target.id,
        });
      }
      await tx.backgroundJob.update({
        where: { id: job.id },
        data: {
          result: { ...(job.result as Prisma.JsonObject), savedProjectId: project.id, fingerprint },
        },
      });
      return project;
    },
    { timeout: 30_000 },
  );
}
