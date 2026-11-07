import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { ResearchActor } from "@/modules/shared/application/actor";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import { requireResearchMember } from "@/modules/shared/infrastructure/research-transaction";
import { chunkDocument } from "../domain/chunk";
import type {
  KnowledgeRetrievalStore,
  RetrievalInput,
  RetrievedKnowledge,
} from "../application/retrieval-service";
import type { JobRow } from "@/modules/tasks";

export async function processKnowledgeDocument(
  db: Prisma.TransactionClient,
  actor: ResearchActor,
  documentId: string,
  job?: JobRow,
) {
  return db.$transaction(async (tx) => {
    await requireResearchMember(tx, actor);
    if (job) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${job.id}::uuid FOR UPDATE`,
      );
      if (
        !(await tx.backgroundJob.findFirst({
          where: {
            id: job.id,
            workspaceId: actor.workspaceId,
            status: "RUNNING",
            leaseToken: job.leaseToken,
            leaseUntil: { gt: new Date() },
            cancelRequestedAt: null,
          },
        }))
      )
        throw new ResearchOperationError(
          "JOB_CANCELLED",
          "The work was cancelled or its lease expired.",
        );
    }
    const document = await tx.knowledgeDocument.findFirst({
      where: { id: documentId, workspaceId: actor.workspaceId, reviewStatus: "REVIEWED" },
      select: { id: true, version: true, content: true },
    });
    if (!document)
      throw new ResearchOperationError(
        "SOURCE_UNAVAILABLE",
        "The document is no longer reviewed or accessible.",
      );
    const chunks = chunkDocument(document.content).map((chunk) => ({
      ...chunk,
      checksum: createHash("sha256").update(chunk.content).digest("hex"),
      documentId,
      documentVersion: document.version,
      workspaceId: actor.workspaceId,
    }));
    await tx.knowledgeChunk.createMany({ data: chunks, skipDuplicates: true });
    return { documentId, chunks: chunks.length };
  });
}
export class PrismaKnowledgeRetrievalStore implements KnowledgeRetrievalStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  retrieve(actor: ResearchActor, input: RetrievalInput) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      let engagementId = input.engagementId;
      if (input.investigationId) {
        const investigation = await tx.investigation.findFirst({
          where: { id: input.investigationId, workspaceId: actor.workspaceId },
          select: { engagementId: true },
        });
        if (!investigation || (engagementId && investigation.engagementId !== engagementId))
          throw new ResearchOperationError(
            "FORBIDDEN",
            "The research context is unavailable in this workspace.",
          );
        engagementId = investigation.engagementId ?? undefined;
      }
      if (
        engagementId &&
        !(await tx.engagement.findFirst({
          where: { id: engagementId, workspaceId: actor.workspaceId },
          select: { id: true },
        }))
      )
        throw new ResearchOperationError(
          "FORBIDDEN",
          "The engagement is unavailable in this workspace.",
        );
      const engagementFilter = engagementId
        ? Prisma.sql`(d."engagementId" IS NULL OR d."engagementId" = ${engagementId}::uuid)`
        : Prisma.sql`d."engagementId" IS NULL`;
      const investigationFilter = input.investigationId
        ? Prisma.sql`(d."investigationId" IS NULL OR d."investigationId" = ${input.investigationId}::uuid)`
        : Prisma.sql`d."investigationId" IS NULL`;
      const results = await tx.$queryRaw<RetrievedKnowledge[]>(Prisma.sql`
        SELECT c.id AS "chunkId", d.id AS "documentId", c."documentVersion", d.title, c.content, c.checksum,
          s.id AS "sourceId", s.origin::text, s.url, c."startOffset", c."endOffset",
          ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', ${input.query}))::float8 AS score
        FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id = c."documentId" AND d."workspaceId" = c."workspaceId"
          JOIN "KnowledgeSource" s ON s.id = d."sourceId" AND s."workspaceId" = d."workspaceId"
        WHERE c."workspaceId" = ${actor.workspaceId}::uuid AND d."reviewStatus" = 'REVIEWED' AND c."documentVersion" = d.version
          AND ${engagementFilter} AND ${investigationFilter}
          AND (to_tsvector('english', c.content) @@ websearch_to_tsquery('english', ${input.query}) OR lower(d.title) = lower(${input.query}) OR ${input.query} = ANY(d.tags))
        ORDER BY (lower(d.title) = lower(${input.query})) DESC, score DESC, d.id, c.sequence LIMIT ${input.limit}`);
      const record = await tx.retrievalRecord.create({
        data: {
          workspaceId: actor.workspaceId,
          requestedBy: actor.userId,
          engagementId,
          investigationId: input.investigationId,
          query: input.query,
          strategy: "EXACT_FULL_TEXT_V1",
          filters: {
            reviewStatus: "REVIEWED",
            engagementId: engagementId ?? null,
            investigationId: input.investigationId ?? null,
          },
          results: JSON.parse(
            JSON.stringify(
              results.map((r) => ({
                chunkId: r.chunkId,
                documentId: r.documentId,
                documentVersion: r.documentVersion,
                score: r.score,
                checksum: r.checksum,
              })),
            ),
          ),
        },
        select: { id: true },
      });
      return { retrievalId: record.id, results };
    });
  }
}
