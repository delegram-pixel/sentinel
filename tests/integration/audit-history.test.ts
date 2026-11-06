import { afterAll, describe, expect, it } from "vitest";

import { PrismaAuditHistoryStore } from "@/modules/audit";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

describe("workspace audit history", () => {
  it("returns the member's workspace activity without raw audit payloads", async () => {
    const entries = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);

      await tx.auditLog.createMany({
        data: [
          {
            workspaceId: own.workspace.id,
            userId: own.user.id,
            action: "WORKSPACE_PROVISIONED",
            entityType: "Workspace",
            entityId: own.workspace.id,
            newValue: { kind: "PERSONAL", role: "OWNER" },
            metadata: { source: "integration-test" },
          },
          {
            workspaceId: other.workspace.id,
            userId: other.user.id,
            action: "PROJECT_CREATED",
            entityType: "Project",
            entityId: other.project.id,
          },
        ],
      });

      return new PrismaAuditHistoryStore(tx).listWorkspaceHistory({
        userId: own.user.id,
        workspaceId: own.workspace.id,
      });
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "WORKSPACE_PROVISIONED",
      actorName: "Test Researcher",
    });
    expect(entries[0]).not.toHaveProperty("newValue");
    expect(entries[0]).not.toHaveProperty("previousValue");
    expect(entries[0]).not.toHaveProperty("metadata");
    expect(entries[0]).not.toHaveProperty("entityId");
    expect(entries[0]).not.toHaveProperty("user");
  });

  it("denies history from a workspace the requesting user has not joined", async () => {
    const entries = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);

      await tx.auditLog.create({
        data: {
          workspaceId: other.workspace.id,
          userId: other.user.id,
          action: "WORKSPACE_PROVISIONED",
          entityType: "Workspace",
          entityId: other.workspace.id,
        },
      });

      return new PrismaAuditHistoryStore(tx).listWorkspaceHistory({
        userId: own.user.id,
        workspaceId: other.workspace.id,
      });
    });

    expect(entries).toEqual([]);
  });

  it("returns only the newest 20 events and preserves events without an actor", async () => {
    const { entries, recent, capped } = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const start = Date.UTC(2026, 10, 5);

      await tx.auditLog.createMany({
        data: Array.from({ length: 25 }, (_, index) => ({
          workspaceId: own.workspace.id,
          userId: null,
          action: "PROJECT_UPDATED",
          entityType: "Project",
          entityId: own.project.id,
          createdAt: new Date(start + index * 60_000),
        })),
      });

      const store = new PrismaAuditHistoryStore(tx);
      const access = {
        userId: own.user.id,
        workspaceId: own.workspace.id,
      };

      return {
        entries: await store.listWorkspaceHistory(access),
        recent: await store.listWorkspaceHistory(access, 5),
        capped: await store.listWorkspaceHistory(access, 100),
      };
    });

    expect(entries).toHaveLength(20);
    expect(entries[0]?.createdAt).toEqual(new Date("2026-11-05T00:24:00.000Z"));
    expect(entries.at(-1)?.createdAt).toEqual(new Date("2026-11-05T00:05:00.000Z"));
    expect(entries.every((entry) => entry.actorName === null)).toBe(true);
    expect(recent).toHaveLength(5);
    expect(recent.at(-1)?.createdAt).toEqual(new Date("2026-11-05T00:20:00.000Z"));
    expect(capped).toEqual(entries);
  });
});
