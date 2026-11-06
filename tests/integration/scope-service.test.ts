import { afterAll, describe, expect, it } from "vitest";

import {
  activateScope,
  createScopeDraft,
  revokeScope,
  validateTargetCapability,
} from "@/modules/research/application/scope-service";
import { getTarget } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

function dateOnly(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function draftInput(assetIdentifier: string) {
  return {
    effectiveFrom: dateOnly(-1),
    effectiveUntil: dateOnly(7),
    assets: [
      {
        assetIdentifier,
        assetType: "DOMAIN",
        matchType: "DOMAIN",
        effect: "ALLOWED",
        notes: "",
      },
    ],
    permittedActivities: ["READ_PROJECT_CONTEXT", "AI_ANALYZE_SUPPLIED_CONTENT"],
    attestationNotes: "Draft for the next review window.",
  };
}

function activationInput() {
  return {
    authorizationSource: "Program policy and signed authorization",
    authorizationDate: dateOnly(-1),
    attestationNotes: "Activated after reviewing the draft.",
    acknowledged: true,
  };
}

describe("scope service", () => {
  it("creates a new draft version without erasing the active authorization", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const draft = await createScopeDraft(
        store,
        store,
        actor,
        tenancy.target.id,
        draftInput(tenancy.target.assetIdentifier),
      );
      const target = await getTarget(store, tenancy.workspace.id, tenancy.target.id);
      const audit = await tx.auditLog.findFirst({
        where: { action: "SCOPE_DRAFT_CREATED" },
      });

      return { draft, target, audit };
    });

    expect(result.draft).toMatchObject({ ok: true, value: { version: 2 } });
    expect(result.target?.authorizationStatus).toBe("AUTHORIZED");
    expect(result.target?.scopes.map((scope) => scope.status)).toEqual(["DRAFT", "ACTIVE"]);
    expect(result.audit?.newValue).toMatchObject({ version: 2 });
  });

  it("activates a draft, supersedes the previous active version, and updates target authorization", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const draft = await createScopeDraft(
        store,
        store,
        actor,
        tenancy.target.id,
        draftInput(tenancy.target.assetIdentifier),
      );

      if (!draft.ok) {
        throw new Error("Expected the draft to be created.");
      }

      const activation = await activateScope(store, actor, draft.value.id, activationInput());
      const target = await getTarget(store, tenancy.workspace.id, tenancy.target.id);
      const audit = await tx.auditLog.findFirst({
        where: { action: "SCOPE_ACTIVATED" },
      });

      return { draft, activation, target, audit };
    });

    expect(result.activation).toMatchObject({ ok: true, value: { version: 2 } });
    expect(result.target?.authorizationStatus).toBe("AUTHORIZED");
    expect(result.target?.authorizationSource).toBe("Program policy and signed authorization");
    expect(result.target?.scopes.map((scope) => scope.status)).toEqual(["ACTIVE", "SUPERSEDED"]);
    expect(result.audit?.newValue).toMatchObject({
      status: "ACTIVE",
      version: 2,
    });
  });

  it("revokes the active scope and blocks target capabilities", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const allowedBefore = await validateTargetCapability(
        store,
        store,
        actor,
        tenancy.target.id,
        "READ_PROJECT_CONTEXT",
      );
      const revocation = await revokeScope(store, actor, tenancy.scope.id);
      const target = await getTarget(store, tenancy.workspace.id, tenancy.target.id);
      const deniedAfter = await validateTargetCapability(
        store,
        store,
        actor,
        tenancy.target.id,
        "READ_PROJECT_CONTEXT",
      );

      return { allowedBefore, revocation, target, deniedAfter };
    });

    expect(result.allowedBefore.ok).toBe(true);
    expect(result.revocation.ok).toBe(true);
    expect(result.target?.authorizationStatus).toBe("REVOKED");
    expect(result.target?.scopes[0]?.status).toBe("REVOKED");
    expect(result.deniedAfter).toMatchObject({ ok: false, code: "SCOPE_NOT_CONFIGURED" });
  });

  it("refuses activation without an acknowledgment or with a future authorization date", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const draft = await createScopeDraft(
        store,
        store,
        actor,
        tenancy.target.id,
        draftInput(tenancy.target.assetIdentifier),
      );

      if (!draft.ok) {
        throw new Error("Expected the draft to be created.");
      }

      const withoutAcknowledgment = await activateScope(store, actor, draft.value.id, {
        ...activationInput(),
        acknowledged: false,
      });
      const futureDate = await activateScope(store, actor, draft.value.id, {
        ...activationInput(),
        authorizationDate: dateOnly(2),
      });

      return { withoutAcknowledgment, futureDate };
    });

    expect(result.withoutAcknowledgment).toMatchObject({ ok: false });
    expect(result.futureDate).toMatchObject({
      ok: false,
      code: "AUTHORIZATION_DATE_IN_FUTURE",
    });
  });

  it("refuses to reactivate or revoke a version that is not in the required state", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const activateActive = await activateScope(store, actor, tenancy.scope.id, activationInput());

      const draft = await createScopeDraft(
        store,
        store,
        actor,
        tenancy.target.id,
        draftInput(tenancy.target.assetIdentifier),
      );

      if (!draft.ok) {
        throw new Error("Expected the draft to be created.");
      }

      const revokeDraft = await revokeScope(store, actor, draft.value.id);

      return { activateActive, revokeDraft };
    });

    expect(result.activateActive).toMatchObject({ ok: false, code: "SCOPE_NOT_DRAFT" });
    expect(result.revokeDraft).toMatchObject({ ok: false, code: "SCOPE_NOT_ACTIVE" });
  });

  it("isolates scope versions between workspaces", async () => {
    const result = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const ownActor = { userId: own.user.id, workspaceId: own.workspace.id };

      const createInForeignTarget = await createScopeDraft(
        store,
        store,
        ownActor,
        other.target.id,
        draftInput(other.target.assetIdentifier),
      );
      const activateForeignScope = await activateScope(
        store,
        ownActor,
        other.scope.id,
        activationInput(),
      );
      const revokeForeignScope = await revokeScope(store, ownActor, other.scope.id);

      return { createInForeignTarget, activateForeignScope, revokeForeignScope };
    });

    expect(result.createInForeignTarget).toMatchObject({
      ok: false,
      code: "TARGET_NOT_FOUND",
    });
    expect(result.activateForeignScope).toMatchObject({
      ok: false,
      code: "SCOPE_NOT_FOUND",
    });
    expect(result.revokeForeignScope).toMatchObject({
      ok: false,
      code: "SCOPE_NOT_FOUND",
    });
  });
});
