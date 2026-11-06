import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaWorkspaceOverviewStore } from "@/modules/workspaces";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

describe("workspace dashboard overview", () => {
  it("counts archived projects, active investigations, and finding states only in the member's workspace", async () => {
    const overview = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);

      await tx.project.create({
        data: {
          workspaceId: own.workspace.id,
          ownerId: own.user.id,
          name: "Archived project",
          slug: "archived",
          status: "ARCHIVED",
          archivedAt: own.now,
        },
      });

      await tx.investigation.createMany({
        data: (["DRAFT", "PAUSED", "COMPLETED", "ARCHIVED"] as const).map((status) => ({
          workspaceId: own.workspace.id,
          projectId: own.project.id,
          targetId: own.target.id,
          createdBy: own.user.id,
          title: `Investigation ${status}`,
          status,
        })),
      });

      await tx.finding.update({
        where: { id: own.finding.id },
        data: { status: "NEEDS_VALIDATION" },
      });
      await tx.finding.update({
        where: { id: other.finding.id },
        data: { status: "NEEDS_VALIDATION" },
      });

      const verifiedFields = {
        workspaceId: own.workspace.id,
        investigationId: own.investigation.id,
        createdBy: own.user.id,
        approvedBy: own.user.id,
        approvedAt: own.now,
        verifiedAt: own.now,
        description: "Verified test fixture.",
        severity: "MEDIUM" as const,
        severityRationale: "Severity assessed by the fixture's human owner.",
        severityAssessedBy: own.user.id,
        severityAssessedAt: own.now,
        affectedAsset: own.target.assetIdentifier,
        affectedAssetType: "DOMAIN" as const,
      };

      await tx.finding.createMany({
        data: [
          {
            ...verifiedFields,
            title: "Confirmed finding",
            titleNormalized: "confirmed finding",
            status: "CONFIRMED",
          },
          {
            ...verifiedFields,
            title: "Reportable finding",
            titleNormalized: "reportable finding",
            status: "REPORTABLE",
            impact: "Test impact",
            remediation: "Test remediation",
          },
          {
            workspaceId: own.workspace.id,
            investigationId: own.investigation.id,
            createdBy: own.user.id,
            title: "Draft finding",
            titleNormalized: "draft finding",
            description: "Unreviewed test fixture.",
            status: "DRAFT",
          },
        ],
      });

      return new PrismaWorkspaceOverviewStore(tx).getOverview({
        userId: own.user.id,
        workspaceId: own.workspace.id,
      });
    });

    expect(overview).toEqual({
      projectCount: 2,
      activeInvestigationCount: 1,
      validationQueueCount: 1,
      confirmedFindingCount: 2,
    });
  });

  it("returns real zero counts for an empty personal workspace", async () => {
    const overview = await withRollback(client, async (tx) => {
      const suffix = randomUUID();
      const user = await tx.user.create({
        data: {
          authProviderId: `clerk_${suffix}`,
          email: `${suffix}@example.test`,
          displayName: "New Researcher",
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: "Empty workspace",
          slug: suffix,
          ownerId: user.id,
          kind: "PERSONAL",
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });

      return new PrismaWorkspaceOverviewStore(tx).getOverview({
        userId: user.id,
        workspaceId: workspace.id,
      });
    });

    expect(overview).toEqual({
      projectCount: 0,
      activeInvestigationCount: 0,
      validationQueueCount: 0,
      confirmedFindingCount: 0,
    });
  });

  it("denies counts from another workspace instead of fabricating an empty overview", async () => {
    const overview = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);

      return new PrismaWorkspaceOverviewStore(tx).getOverview({
        userId: own.user.id,
        workspaceId: other.workspace.id,
      });
    });

    expect(overview).toBeNull();
  });

  it("returns no overview for an unknown workspace", async () => {
    const overview = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);

      return new PrismaWorkspaceOverviewStore(tx).getOverview({
        userId: own.user.id,
        workspaceId: randomUUID(),
      });
    });

    expect(overview).toBeNull();
  });
});
