import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import type { EngagementDetail, EngagementStore } from "../application/ports";
import type {
  AssociateInvestigationInput,
  EngagementAssetInput,
  EngagementAuthorizationInput,
  EngagementInput,
  EngagementStatusInput,
} from "../domain/engagement";

const select = {
  id: true,
  projectId: true,
  name: true,
  objective: true,
  engagementType: true,
  status: true,
  startsAt: true,
  endsAt: true,
  project: { select: { name: true } },
  _count: { select: { assets: true, investigations: true } },
} satisfies Prisma.EngagementSelect;

async function editable(tx: Prisma.TransactionClient, actor: ResearchActor, id: string) {
  await requireResearchMember(tx, actor);
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Engagement" WHERE id = ${id}::uuid AND "workspaceId" = ${actor.workspaceId}::uuid FOR UPDATE`,
  );
  const row = await tx.engagement.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    select: { id: true, projectId: true, status: true, project: { select: { status: true } } },
  });
  if (!row)
    throw new ResearchOperationError(
      "NOT_FOUND",
      "That engagement does not exist in this workspace.",
    );
  if (row.status === "ARCHIVED" || row.project.status === "ARCHIVED")
    throw new ResearchOperationError("ARCHIVED", "Archived engagements cannot be changed.");
  return row;
}

export class PrismaEngagementStore implements EngagementStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  list(workspaceId: string) {
    return this.db.engagement.findMany({
      where: { workspaceId },
      select,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }
  find(workspaceId: string, id: string): Promise<EngagementDetail | null> {
    return this.db.engagement.findFirst({
      where: { id, workspaceId },
      select: {
        ...select,
        assets: {
          select: {
            id: true,
            targetId: true,
            target: { select: { name: true, assetIdentifier: true } },
            authorizations: {
              select: {
                id: true,
                source: true,
                scope: { select: { id: true, version: true, status: true, effectiveUntil: true } },
              },
            },
          },
        },
        investigations: { select: { id: true, title: true, phase: true } },
      },
    });
  }
  create(actor: ResearchActor, input: EngagementInput) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      const project = await tx.project.findFirst({
        where: { id: input.projectId, workspaceId: actor.workspaceId, status: { not: "ARCHIVED" } },
        select: { id: true },
      });
      if (!project)
        throw new ResearchOperationError(
          "NOT_FOUND",
          "Choose an active project in this workspace.",
        );
      const row = await tx.engagement.create({
        data: { ...input, workspaceId: actor.workspaceId, createdBy: actor.userId },
        select: { id: true },
      });
      await researchAudit(tx, actor, "Engagement", row.id, "ENGAGEMENT_CREATED", {
        projectId: input.projectId,
      });
      return row;
    });
  }
  addAsset(actor: ResearchActor, input: EngagementAssetInput) {
    return this.db.$transaction(async (tx) => {
      const engagement = await editable(tx, actor, input.engagementId);
      const target = await tx.target.findFirst({
        where: { id: input.targetId, projectId: engagement.projectId },
        select: { id: true },
      });
      if (!target)
        throw new ResearchOperationError(
          "NOT_FOUND",
          "Choose a target belonging to this engagement's project.",
        );
      const row = await tx.engagementAsset.upsert({
        where: { engagementId_targetId: input },
        create: { ...input, workspaceId: actor.workspaceId },
        update: {},
        select: { id: true },
      });
      await researchAudit(tx, actor, "EngagementAsset", row.id, "ENGAGEMENT_ASSET_ASSOCIATED", {
        targetId: input.targetId,
      });
      return row;
    });
  }
  recordAuthorization(actor: ResearchActor, input: EngagementAuthorizationInput) {
    return this.db.$transaction(async (tx) => {
      await editable(tx, actor, input.engagementId);
      const asset = await tx.engagementAsset.findFirst({
        where: {
          id: input.assetId,
          engagementId: input.engagementId,
          workspaceId: actor.workspaceId,
        },
        select: { targetId: true },
      });
      if (
        !asset ||
        !(await tx.scopeVersion.findFirst({
          where: { id: input.scopeVersionId, targetId: asset.targetId },
          select: { id: true },
        }))
      )
        throw new ResearchOperationError(
          "NOT_FOUND",
          "Choose a scope version belonging to this asset.",
        );
      const row = await tx.engagementAuthorization.upsert({
        where: {
          assetId_scopeVersionId: { assetId: input.assetId, scopeVersionId: input.scopeVersionId },
        },
        create: {
          workspaceId: actor.workspaceId,
          assetId: input.assetId,
          scopeVersionId: input.scopeVersionId,
          source: input.source,
          recordedBy: actor.userId,
        },
        update: {},
        select: { id: true },
      });
      await researchAudit(
        tx,
        actor,
        "EngagementAuthorization",
        row.id,
        "ENGAGEMENT_SCOPE_ASSOCIATED",
        { scopeVersionId: input.scopeVersionId },
      );
      return row;
    });
  }
  associate(actor: ResearchActor, input: AssociateInvestigationInput) {
    return this.db.$transaction(async (tx) => {
      const investigation = await lockResearchInvestigation(tx, actor, input.investigationId);
      const engagement = await editable(tx, actor, input.engagementId);
      const asset = await tx.engagementAsset.findUnique({
        where: {
          engagementId_targetId: { engagementId: engagement.id, targetId: investigation.targetId },
        },
        select: { id: true },
      });
      if (engagement.projectId !== investigation.projectId || !asset)
        throw new ResearchOperationError(
          "INVALID_ASSOCIATION",
          "Associate the investigation's target with this engagement first.",
        );
      if (investigation.engagementId && investigation.engagementId !== engagement.id)
        throw new ResearchOperationError(
          "CONFLICT",
          "This investigation already belongs to another engagement.",
        );
      const row = await tx.investigation.update({
        where: { id: investigation.id },
        data: { engagementId: engagement.id },
        select: { id: true },
      });
      await researchAudit(
        tx,
        actor,
        "Investigation",
        row.id,
        "INVESTIGATION_ENGAGEMENT_ASSOCIATED",
        { engagementId: engagement.id },
      );
      return row;
    });
  }
  changeStatus(actor: ResearchActor, input: EngagementStatusInput) {
    return this.db.$transaction(async (tx) => {
      const row = await editable(tx, actor, input.engagementId);
      if (row.status !== input.expectedStatus)
        throw new ResearchOperationError(
          "CONFLICT",
          "This engagement changed. Refresh before saving.",
        );
      await tx.engagement.update({ where: { id: row.id }, data: { status: input.status } });
      await researchAudit(tx, actor, "Engagement", row.id, "ENGAGEMENT_STATUS_CHANGED", {
        previousStatus: row.status,
        status: input.status,
      });
      return { id: row.id };
    });
  }
}
