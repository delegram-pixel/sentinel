import { afterAll, describe, expect, it } from "vitest";

import {
  createTarget,
  getTarget,
  listTargets,
  updateTarget,
} from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

function targetInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Staging app",
    description: "A target for testing",
    assetIdentifier: "staging.example.test",
    assetType: "DOMAIN",
    environmentType: "PRACTICE_LAB",
    programName: "Local practice",
    programUrl: "https://example.test/program",
    authorizationSource: "Self-attested local lab",
    authorizationDate: "2026-11-01",
    authorizationNotes: "Read-only activities only.",
    ...overrides,
  };
}

describe("target service", () => {
  it("creates a target with derived authorization state and an audit event", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const created = await createTarget(store, store, actor, tenancy.project.id, targetInput());

      if (!created.ok) {
        throw new Error("Expected the target to be created.");
      }

      const target = await getTarget(store, tenancy.workspace.id, created.value.id);
      const audit = await tx.auditLog.findFirst({
        where: { entityId: created.value.id, action: "TARGET_CREATED" },
      });

      return { created, target, audit };
    });

    expect(result.created.ok).toBe(true);
    expect(result.target?.name).toBe("Staging app");
    expect(result.target?.authorizationStatus).toBe("UNVERIFIED");
    expect(result.target?.authorizationDate?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(result.target?.projectId).toBe(result.target?.project.id);
    expect(result.audit?.newValue).toMatchObject({
      assetIdentifier: "staging.example.test",
      authorizationStatus: "UNVERIFIED",
    });
  });

  it("rejects a duplicate asset identifier within the same project", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const first = await createTarget(store, store, actor, tenancy.project.id, targetInput());
      const second = await createTarget(store, store, actor, tenancy.project.id, targetInput());

      return { first, second };
    });

    expect(result.first.ok).toBe(true);
    expect(result.second).toMatchObject({ ok: false, code: "TARGET_DUPLICATE" });
  });

  it("treats asset identifiers as case-insensitive within a project", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const first = await createTarget(
        store,
        store,
        actor,
        tenancy.project.id,
        targetInput({ assetIdentifier: "Staging.Example.Test" }),
      );
      const second = await createTarget(
        store,
        store,
        actor,
        tenancy.project.id,
        targetInput({ assetIdentifier: "staging.example.test" }),
      );

      return { first, second };
    });

    expect(result.first.ok).toBe(true);
    expect(result.second).toMatchObject({ ok: false, code: "TARGET_DUPLICATE" });
  });

  it("does not add targets to an archived project", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      await tx.project.update({
        where: { id: tenancy.project.id },
        data: { status: "ARCHIVED", archivedAt: tenancy.now },
      });

      return createTarget(store, store, actor, tenancy.project.id, targetInput());
    });

    expect(result).toMatchObject({ ok: false, code: "PROJECT_ARCHIVED" });
  });

  it("updates a target without tripping its own uniqueness constraint", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const created = await createTarget(store, store, actor, tenancy.project.id, targetInput());

      if (!created.ok) {
        throw new Error("Expected the target to be created.");
      }

      const update = await updateTarget(store, store, actor, created.value.id, {
        ...targetInput(),
        name: "Renamed app",
        assetIdentifier: "api.example.test",
        assetType: "API",
      });
      const target = await getTarget(store, tenancy.workspace.id, created.value.id);
      const audit = await tx.auditLog.findFirst({
        where: { entityId: created.value.id, action: "TARGET_UPDATED" },
      });

      return { update, target, audit };
    });

    expect(result.update.ok).toBe(true);
    expect(result.target?.name).toBe("Renamed app");
    expect(result.target?.assetIdentifier).toBe("api.example.test");
    expect(result.target?.assetType).toBe("API");
    expect(result.audit?.previousValue).toMatchObject({ name: "Staging app" });
    expect(result.audit?.newValue).toMatchObject({ name: "Renamed app" });
  });

  it("isolates targets between workspaces", async () => {
    const result = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const ownActor = { userId: own.user.id, workspaceId: own.workspace.id };

      const lookup = await getTarget(store, own.workspace.id, other.target.id);
      const update = await updateTarget(store, store, ownActor, other.target.id, targetInput());
      const createInForeignProject = await createTarget(
        store,
        store,
        ownActor,
        other.project.id,
        targetInput(),
      );
      const ownTargets = await listTargets(store, own.workspace.id);
      const otherTargets = await listTargets(store, other.workspace.id);

      return { lookup, update, createInForeignProject, ownTargets, otherTargets };
    });

    expect(result.lookup).toBeNull();
    expect(result.update).toMatchObject({ ok: false, code: "TARGET_NOT_FOUND" });
    expect(result.createInForeignProject).toMatchObject({ ok: false, code: "PROJECT_NOT_FOUND" });
    expect(result.ownTargets.map((target) => target.id)).not.toContain(result.otherTargets[0]?.id);
    expect(result.ownTargets).toHaveLength(1);
    expect(result.otherTargets).toHaveLength(1);
  });

  it("rejects malformed target input before touching the database", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);

      return createTarget(
        store,
        store,
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        tenancy.project.id,
        targetInput({ name: "A", programUrl: "not-a-url" }),
      );
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });
});
