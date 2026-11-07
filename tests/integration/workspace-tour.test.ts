import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import {
  WORKSPACE_TOUR_VERSION,
  shouldShowWorkspaceTour,
} from "@/modules/auth/domain/workspace-tour";
import { PrismaAuthStore } from "@/modules/auth/infrastructure/prisma-auth-store";
import { PrismaWorkspaceTourStore } from "@/modules/auth/infrastructure/prisma-workspace-tour-store";

import { createTestClient, withRollback } from "./helpers/database";

const client = createTestClient();
afterAll(async () => {
  await client.$disconnect();
});

describe("persistent workspace tour progress", () => {
  it("enrolls newly provisioned users and retains completed progress across repeat provisioning and profile sync", async () => {
    const suffix = randomUUID();
    const identity = {
      authProviderId: `tour_${suffix}`,
      email: `tour-${suffix}@example.test`,
      displayName: "New Researcher",
      avatarUrl: null,
    };
    const authStore = new PrismaAuthStore(client);
    const tourStore = new PrismaWorkspaceTourStore(client);
    let userId: string | undefined;
    try {
      const session = await authStore.createUserWithWorkspace(identity);
      userId = session.user.id;
      expect(shouldShowWorkspaceTour(await tourStore.readProgress(userId))).toBe(true);
      await tourStore.dismiss(userId);
      const completed = await tourStore.readProgress(userId);
      expect(completed?.onboardingCompletedAt).toBeInstanceOf(Date);
      expect(shouldShowWorkspaceTour(completed)).toBe(false);
      await authStore.createUserWithWorkspace(identity);
      await authStore.updateUserProfile({ ...identity, displayName: "Updated Researcher" });
      expect(await tourStore.readProgress(userId)).toEqual(completed);
      // A legacy account recovered through the same upsert must stay legacy.
      await client.user.update({
        where: { id: userId },
        data: { onboardingVersion: 1, onboardingCompletedAt: null },
      });
      await authStore.createUserWithWorkspace(identity);
      expect(await tourStore.readProgress(userId)).toEqual({
        onboardingVersion: 1,
        onboardingCompletedAt: null,
      });
    } finally {
      if (userId) {
        await client.auditLog.deleteMany({ where: { userId } });
        await client.workspace.deleteMany({ where: { ownerId: userId } });
        await client.user.delete({ where: { id: userId } });
      }
    }
  });

  it("persists one user's dismissal once without changing another user's progress", async () => {
    await withRollback(client, async (tx) => {
      const suffix = randomUUID();
      const first = await tx.user.create({
        data: {
          authProviderId: `tour_a_${suffix}`,
          email: `a-${suffix}@example.test`,
          displayName: "First",
          onboardingVersion: WORKSPACE_TOUR_VERSION,
        },
      });
      const second = await tx.user.create({
        data: {
          authProviderId: `tour_b_${suffix}`,
          email: `b-${suffix}@example.test`,
          displayName: "Second",
          onboardingVersion: WORKSPACE_TOUR_VERSION,
        },
      });
      const store = new PrismaWorkspaceTourStore(tx);
      await store.dismiss(first.id);
      const completed = await store.readProgress(first.id);
      await store.dismiss(first.id);
      expect(await store.readProgress(first.id)).toEqual(completed);
      expect(shouldShowWorkspaceTour(await store.readProgress(second.id))).toBe(true);
    });
  });

  it("preserves legacy and future-version progress when replaying the current tour", async () => {
    await withRollback(client, async (tx) => {
      const suffix = randomUUID();
      const legacy = await tx.user.create({
        data: {
          authProviderId: `tour_legacy_${suffix}`,
          email: `legacy-${suffix}@example.test`,
          displayName: "Existing",
        },
      });
      const future = await tx.user.create({
        data: {
          authProviderId: `tour_future_${suffix}`,
          email: `future-${suffix}@example.test`,
          displayName: "Future",
          onboardingVersion: WORKSPACE_TOUR_VERSION + 1,
        },
      });
      const store = new PrismaWorkspaceTourStore(tx);
      for (const user of [legacy, future]) {
        const before = await store.readProgress(user.id);
        await store.dismiss(user.id);
        expect(await store.readProgress(user.id)).toEqual(before);
        expect(shouldShowWorkspaceTour(before)).toBe(false);
      }
    });
  });
});
