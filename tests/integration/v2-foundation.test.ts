import { afterAll, describe, expect, it } from "vitest";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { PrismaEngagementStore } from "@/modules/engagements/infrastructure/prisma-engagement-store";
import { PrismaDecisionStore } from "@/modules/research/infrastructure/prisma-decision-store";
import { PrismaKnowledgeStore } from "@/modules/knowledge/infrastructure/prisma-knowledge-store";
import { backfillLegacyWorkspace } from "@/modules/research/infrastructure/legacy-backfill";
const client = createTestClient();
afterAll(() => client.$disconnect());
describe("V2 foundation isolation and preservation", () => {
  it("maps legacy records idempotently without changing approvals or original history", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const summary = await tx.sessionSummary.create({
        data: {
          investigationId: t.investigation.id,
          summary: "Human research note",
          generatedByType: "HUMAN",
          createdBy: t.user.id,
        },
      });
      const before = await tx.scopeVersion.findUniqueOrThrow({ where: { id: t.scope.id } });
      await backfillLegacyWorkspace(tx, t.workspace.id);
      await backfillLegacyWorkspace(tx, t.workspace.id);
      expect(await tx.engagement.count({ where: { workspaceId: t.workspace.id } })).toBe(1);
      expect(await tx.engagementAsset.count({ where: { workspaceId: t.workspace.id } })).toBe(1);
      expect(await tx.researchDecision.count({ where: { workspaceId: t.workspace.id } })).toBe(1);
      expect(await tx.scopeVersion.findUniqueOrThrow({ where: { id: t.scope.id } })).toEqual(
        before,
      );
      expect(await tx.sessionSummary.findUniqueOrThrow({ where: { id: summary.id } })).toEqual(
        summary,
      );
      expect(
        (await tx.investigation.findUniqueOrThrow({ where: { id: t.investigation.id } })).status,
      ).toBe(t.investigation.status);
      expect(
        (await tx.engagement.findFirstOrThrow({ where: { workspaceId: t.workspace.id } })).status,
      ).toBe("DRAFT");
    }));
  it("denies foreign projects/assets, decisions and knowledge review by a researcher", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const foreign = await createTenancy(tx);
      const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
      const engagements = new PrismaEngagementStore(tx);
      await expect(
        engagements.create(actor, {
          projectId: foreign.project.id,
          name: "Foreign",
          engagementType: "LEARNING_LAB",
        }),
      ).rejects.toThrow(/active project/);
      const e = await engagements.create(actor, {
        projectId: t.project.id,
        name: "Audit",
        engagementType: "LEARNING_LAB",
      });
      await expect(
        engagements.addAsset(actor, { engagementId: e.id, targetId: foreign.target.id }),
      ).rejects.toThrow(/belonging/);
      const decisions = new PrismaDecisionStore(tx);
      await expect(
        decisions.record(actor, {
          investigationId: t.investigation.id,
          kind: "RESEARCH_NOTE",
          rationale: "Check foreign source",
          sourceRefs: [{ kind: "FINDING", id: foreign.finding.id, relationship: "SUPPORTS" }],
        }),
      ).rejects.toThrow(/unavailable/);
      const knowledge = new PrismaKnowledgeStore(tx);
      const doc = await knowledge.create(actor, {
        title: "Reference",
        content: "Supplied note",
        origin: "AI_INTERPRETATION",
        tags: [],
      });
      expect((await knowledge.find(t.workspace.id, doc.id))?.reviewStatus).toBe("DRAFT");
      expect(await knowledge.find(foreign.workspace.id, doc.id)).toBeNull();
      await tx.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: t.workspace.id, userId: t.user.id } },
        data: { role: "RESEARCHER" },
      });
      await expect(
        knowledge.review(actor, {
          documentId: doc.id,
          expectedStatus: "DRAFT",
          status: "REVIEWED",
          rationale: "Review",
        }),
      ).rejects.toThrow(/reviewer/);
    }));
  it("does not permit activation without validated upload provenance", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      await expect(
        tx.evidence.create({
          data: {
            workspaceId: t.workspace.id,
            investigationId: t.investigation.id,
            uploadedBy: t.user.id,
            title: "Unvalidated",
            fileName: "log.txt",
            evidenceType: "LOG",
            mimeType: "text/plain",
            fileSize: 10,
            checksum: "a".repeat(64),
            storageKey: "active/unvalidated",
            redactionStatus: "VERIFIED_SAFE",
            redactionMethod: "HUMAN_REVIEW",
            redactionReviewedBy: t.user.id,
            redactionReviewedAt: t.now,
          },
        }),
      ).rejects.toThrow();
    }));
});
