import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  canReviewResearch,
  ResearchOperationError,
  type ResearchActor,
} from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import type { KnowledgeDetail, KnowledgeStore } from "../application/knowledge-service";
import type {
  KnowledgeInput,
  KnowledgeRelationInput,
  KnowledgeReviewInput,
} from "../domain/knowledge";

const select = {
  id: true,
  title: true,
  tags: true,
  version: true,
  reviewStatus: true,
  createdAt: true,
  source: { select: { origin: true, url: true } },
} satisfies Prisma.KnowledgeDocumentSelect;
export class PrismaKnowledgeStore implements KnowledgeStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  list(workspaceId: string, query = "") {
    return this.db.knowledgeDocument.findMany({
      where: {
        workspaceId,
        ...(query
          ? {
              OR: [
                { title: { contains: query.slice(0, 200), mode: "insensitive" as const } },
                { tags: { has: query.slice(0, 60) } },
              ],
            }
          : {}),
      },
      select,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  find(workspaceId: string, id: string): Promise<KnowledgeDetail | null> {
    return this.db.knowledgeDocument.findFirst({
      where: { id, workspaceId },
      select: {
        ...select,
        content: true,
        sourceId: true,
        engagementId: true,
        investigationId: true,
        reviewedAt: true,
        creator: { select: { displayName: true } },
        source: { select: { origin: true, url: true, publishedAt: true, retrievedAt: true } },
      },
    });
  }
  create(actor: ResearchActor, input: KnowledgeInput) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      if (
        input.engagementId &&
        !(await tx.engagement.findFirst({
          where: {
            id: input.engagementId,
            workspaceId: actor.workspaceId,
            status: { not: "ARCHIVED" },
            project: { status: { not: "ARCHIVED" } },
          },
          select: { id: true },
        }))
      )
        throw new ResearchOperationError(
          "NOT_FOUND",
          "Choose an active engagement in this workspace.",
        );
      if (input.investigationId) {
        const investigation = await lockResearchInvestigation(tx, actor, input.investigationId);
        if (input.engagementId && investigation.engagementId !== input.engagementId)
          throw new ResearchOperationError(
            "INVALID_ASSOCIATION",
            "The investigation belongs to a different engagement.",
          );
      }
      const source = await tx.knowledgeSource.create({
        data: {
          workspaceId: actor.workspaceId,
          title: input.title,
          origin: input.origin,
          url: input.url,
          publishedAt: input.publishedAt,
          retrievedAt: input.retrievedAt,
        },
        select: { id: true },
      });
      const row = await tx.knowledgeDocument.create({
        data: {
          workspaceId: actor.workspaceId,
          sourceId: source.id,
          title: input.title,
          content: input.content,
          tags: input.tags,
          engagementId: input.engagementId,
          investigationId: input.investigationId,
          createdBy: actor.userId,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "KnowledgeDocument", row.id, "KNOWLEDGE_CREATED", {
        sourceId: source.id,
        origin: input.origin,
      });
      return row;
    });
  }
  review(actor: ResearchActor, input: KnowledgeReviewInput) {
    return this.db.$transaction(async (tx) => {
      const role = await requireResearchMember(tx, actor);
      if (!canReviewResearch(role))
        throw new ResearchOperationError(
          "FORBIDDEN",
          "A workspace owner, administrator or reviewer must review knowledge.",
        );
      const changed = await tx.knowledgeDocument.updateMany({
        where: {
          id: input.documentId,
          workspaceId: actor.workspaceId,
          reviewStatus: input.expectedStatus,
        },
        data: { reviewStatus: input.status, reviewedBy: actor.userId, reviewedAt: new Date() },
      });
      if (!changed.count)
        throw new ResearchOperationError(
          "CONFLICT",
          "The document changed or is unavailable. Refresh before reviewing.",
        );
      if (input.status === "REVIEWED") {
        const document = await tx.knowledgeDocument.findUniqueOrThrow({
          where: { id: input.documentId },
          select: { version: true },
        });
        await tx.backgroundJob.upsert({
          where: {
            workspaceId_operationKey: {
              workspaceId: actor.workspaceId,
              operationKey: `knowledge-index:${input.documentId}:v${document.version}`,
            },
          },
          create: {
            workspaceId: actor.workspaceId,
            requestedBy: actor.userId,
            kind: "KNOWLEDGE_INDEX",
            operationKey: `knowledge-index:${input.documentId}:v${document.version}`,
            payload: { documentId: input.documentId },
          },
          update: {},
        });
      }
      await researchAudit(tx, actor, "KnowledgeDocument", input.documentId, "KNOWLEDGE_REVIEWED", {
        status: input.status,
        rationale: input.rationale,
      });
      return { id: input.documentId };
    });
  }
  relate(actor: ResearchActor, input: KnowledgeRelationInput) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      const count = await tx.knowledgeDocument.count({
        where: { id: { in: [input.fromId, input.toId] }, workspaceId: actor.workspaceId },
      });
      if (count !== 2)
        throw new ResearchOperationError(
          "NOT_FOUND",
          "Both documents must belong to this workspace.",
        );
      const row = await tx.knowledgeRelation.upsert({
        where: {
          fromId_toId_relationship: {
            fromId: input.fromId,
            toId: input.toId,
            relationship: input.relationship,
          },
        },
        create: { ...input, workspaceId: actor.workspaceId },
        update: {},
        select: { id: true },
      });
      await researchAudit(tx, actor, "KnowledgeRelation", row.id, "KNOWLEDGE_RELATED", {
        fromId: input.fromId,
        toId: input.toId,
        relationship: input.relationship,
      });
      return row;
    });
  }
}
