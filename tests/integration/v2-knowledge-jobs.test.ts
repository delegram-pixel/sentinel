import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { PrismaKnowledgeStore } from "@/modules/knowledge/infrastructure/prisma-knowledge-store";
import {
  PrismaKnowledgeRetrievalStore,
  processKnowledgeDocument,
} from "@/modules/knowledge/infrastructure/prisma-knowledge-retrieval";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
const client = createTestClient();
afterAll(() => client.$disconnect());
describe("reviewed knowledge and durable work", () => {
  it("retrieves reviewed exact sources, preserves offsets and excludes withdrawn/foreign sources", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const foreign = await createTenancy(tx);
      const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
      const store = new PrismaKnowledgeStore(tx);
      const content =
        "Cross site scripting requires an unsafe output context.\nAlternative explanations must be reviewed.";
      const doc = await store.create(actor, {
        title: "Cross site scripting",
        content,
        origin: "PUBLIC_REFERENCE",
        tags: ["xss"],
      });
      const search = new PrismaKnowledgeRetrievalStore(tx);
      expect((await search.retrieve(actor, { query: "scripting", limit: 8 })).results).toEqual([]);
      await store.review(actor, {
        documentId: doc.id,
        expectedStatus: "DRAFT",
        status: "REVIEWED",
        rationale: "Checked the supplied reference",
      });
      await processKnowledgeDocument(tx, actor, doc.id);
      await processKnowledgeDocument(tx, actor, doc.id);
      expect(await tx.knowledgeChunk.count({ where: { documentId: doc.id } })).toBe(1);
      const result = await search.retrieve(actor, { query: "scripting", limit: 8 });
      expect(result.results[0]?.documentId).toBe(doc.id);
      expect(result.results[0]?.content).toBe(content);
      expect(result.results[0]?.endOffset).toBe(content.length);
      expect(
        (
          await search.retrieve(
            { workspaceId: foreign.workspace.id, userId: foreign.user.id, role: "OWNER" },
            { query: "scripting", limit: 8 },
          )
        ).results,
      ).toEqual([]);
      await store.review(actor, {
        documentId: doc.id,
        expectedStatus: "REVIEWED",
        status: "WITHDRAWN",
        rationale: "Reference is no longer applicable",
      });
      expect((await search.retrieve(actor, { query: "scripting", limit: 8 })).results).toEqual([]);
      expect(await tx.knowledgeChunk.count({ where: { documentId: doc.id } })).toBe(1);
    }));
  it("reuses operation keys, fences leases and rejects results after cancellation", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
      const store = new PrismaJobStore(tx);
      const key = randomUUID();
      const first = await store.enqueue(actor, "KNOWLEDGE_INDEX", key, {
        documentId: randomUUID(),
      });
      const persisted = await store.find(actor.workspaceId, first.id);
      expect(await store.enqueue(actor, "KNOWLEDGE_INDEX", key, persisted?.payload)).toEqual(first);
      const job = await store.claim();
      expect(job?.id).toBe(first.id);
      expect(job?.leaseToken).toBeTruthy();
      if (!job) throw new Error("No work claimed");
      expect(await store.claim()).toBeNull();
      expect(await store.heartbeat(job, 40)).toBe(true);
      expect(await store.cancel(actor, job.id)).toBe(true);
      expect(await store.finish(job, { result: "stale" })).toBe(false);
      expect((await store.find(actor.workspaceId, job.id))?.status).toBe("CANCELLED");
    }));
});
