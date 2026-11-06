import { afterAll, describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

function createAiTask(
  tx: Prisma.TransactionClient,
  tenancy: Awaited<ReturnType<typeof createTenancy>>,
) {
  return tx.aITask.create({
    data: {
      workspaceId: tenancy.workspace.id,
      investigationId: tenancy.investigation.id,
      taskType: "EVIDENCE_REVIEW",
      provider: "ANTHROPIC",
      model: "claude-test",
      promptTemplateId: "verification.review",
      promptVersion: "1",
      contextVersion: "test-context",
      idempotencyKey: `task-${tenancy.investigation.id}`,
      inputTokenBudget: 1_000,
      outputTokenBudget: 500,
      requestedBy: tenancy.user.id,
    },
  });
}

describe("schema and migration", () => {
  it("creates the full tenancy chain and reads it back through relations", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);

      return tx.workspace.findUniqueOrThrow({
        where: { id: tenancy.workspace.id },
        include: {
          owner: true,
          members: true,
          projects: {
            include: {
              targets: {
                include: {
                  scopeVersions: {
                    include: { assets: true, activities: true, approver: true },
                  },
                  investigations: {
                    include: { findings: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    expect(result.owner.email).toContain("@example.test");
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.role).toBe("OWNER");
    expect(result.projects[0]?.targets[0]?.scopeVersions[0]?.assets).toHaveLength(1);
    expect(result.projects[0]?.targets[0]?.scopeVersions[0]?.activities[0]?.activity).toBe(
      "READ_PROJECT_CONTEXT",
    );
    expect(result.projects[0]?.targets[0]?.scopeVersions[0]?.approver?.id).toBe(result.owner.id);
    expect(result.projects[0]?.targets[0]?.investigations[0]?.findings[0]?.title).toBe(
      "Reflected input",
    );
  });

  it("allows only one personal workspace per owner", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);

        await tx.workspace.create({
          data: {
            name: "Second Personal Workspace",
            slug: `second-${tenancy.user.id}`,
            kind: "PERSONAL",
            ownerId: tenancy.user.id,
          },
        });
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows a team workspace alongside a personal workspace", async () => {
    const workspaces = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);

      await tx.workspace.create({
        data: {
          name: "Team Workspace",
          slug: `team-${tenancy.user.id}`,
          kind: "TEAM",
          ownerId: tenancy.user.id,
        },
      });

      return tx.workspace.count({ where: { ownerId: tenancy.user.id } });
    });

    expect(workspaces).toBe(2);
  });

  it("requires a resolution reason when a finding is rejected", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);

        await tx.finding.update({
          where: { id: tenancy.finding.id },
          data: { status: "REJECTED" },
        });
      }),
    ).rejects.toThrow(/Finding_rejected_resolution_check/);

    const accepted = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);

      return tx.finding.update({
        where: { id: tenancy.finding.id },
        data: { status: "REJECTED", resolutionReason: "DUPLICATE" },
        select: { status: true, resolutionReason: true },
      });
    });

    expect(accepted).toEqual({ status: "REJECTED", resolutionReason: "DUPLICATE" });
  });

  it("requires severity and an affected asset before a finding is confirmed", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);

        await tx.finding.update({
          where: { id: tenancy.finding.id },
          data: { status: "CONFIRMED" },
        });
      }),
    ).rejects.toThrow(/Finding_confirmed_readiness_check/);

    const confirmed = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);

      return tx.finding.update({
        where: { id: tenancy.finding.id },
        data: {
          status: "CONFIRMED",
          severity: "HIGH",
          severityRationale: "Stored XSS with session impact.",
          severityAssessedBy: tenancy.user.id,
          severityAssessedAt: tenancy.now,
          affectedAsset: "/profile",
          affectedAssetType: "APPLICATION",
        },
        select: { status: true, severity: true, affectedAsset: true },
      });
    });

    expect(confirmed).toEqual({
      status: "CONFIRMED",
      severity: "HIGH",
      affectedAsset: "/profile",
    });
  });

  it("prevents an AI reviewer from confirming a finding", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);
        const task = await createAiTask(tx, tenancy);

        await tx.verificationReview.create({
          data: {
            findingId: tenancy.finding.id,
            taskId: task.id,
            reviewerType: "AI",
            conclusion: "CONFIRMED",
          },
        });
      }),
    ).rejects.toThrow(/VerificationReview_actor_conclusion_check/);
  });

  it("accepts a human confirmation review", async () => {
    const review = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);

      return tx.verificationReview.create({
        data: {
          findingId: tenancy.finding.id,
          reviewerType: "HUMAN",
          reviewerUserId: tenancy.user.id,
          conclusion: "CONFIRMED",
          reasoningSummary: "Reproduced with a clean browser session.",
        },
        select: { conclusion: true, reviewerType: true },
      });
    });

    expect(review).toEqual({ conclusion: "CONFIRMED", reviewerType: "HUMAN" });
  });

  it("allows at most one active scope version per target", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);

        await tx.scopeVersion.create({
          data: {
            targetId: tenancy.target.id,
            version: 2,
            status: "ACTIVE",
            createdBy: tenancy.user.id,
            approvedBy: tenancy.user.id,
            approvedAt: tenancy.now,
            effectiveFrom: tenancy.now,
            effectiveUntil: tenancy.effectiveUntil,
          },
        });
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("requires a complete attestation before a scope can be active", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);

        await tx.scopeVersion.create({
          data: {
            targetId: tenancy.target.id,
            version: 2,
            status: "ACTIVE",
            createdBy: tenancy.user.id,
            effectiveFrom: tenancy.now,
          },
        });
      }),
    ).rejects.toThrow(/ScopeVersion_active_attestation_check/);
  });

  it("enables trigram duplicate detection", async () => {
    const result = await withRollback(client, async (tx) => {
      const [similarity] = await tx.$queryRaw<Array<{ score: number }>>`
        SELECT similarity('reflected input', 'reflected user input') AS score
      `;

      const indexes = await tx.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'Finding_titleNormalized_trgm_idx'
      `;

      return { score: similarity?.score, indexes };
    });

    expect(Number(result.score)).toBeGreaterThan(0.5);
    expect(result.indexes.map((index) => index.indexname)).toContain(
      "Finding_titleNormalized_trgm_idx",
    );
  });

  it("rejects a finding that duplicates itself", async () => {
    await expect(
      withRollback(client, async (tx) => {
        const tenancy = await createTenancy(tx);

        await tx.finding.update({
          where: { id: tenancy.finding.id },
          data: {
            duplicateOfId: tenancy.finding.id,
            duplicateConfirmedBy: tenancy.user.id,
            duplicateConfirmedAt: tenancy.now,
          },
        });
      }),
    ).rejects.toThrow(/Finding_duplicate_self_check/);
  });
});
