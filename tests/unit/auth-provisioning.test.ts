import { describe, expect, it, vi } from "vitest";

import type { AuthStore, SessionContext } from "@/modules/auth/application/ports";
import { ensureUserProvisioned, syncUserProfile } from "@/modules/auth/application/provisioning";
import type { AuthenticatedIdentity } from "@/modules/auth/domain/identity";

const identity: AuthenticatedIdentity = {
  authProviderId: "clerk_settings_test",
  displayName: "Researcher",
  email: "researcher@example.test",
  avatarUrl: null,
};

const session: SessionContext = {
  user: {
    id: "user-1",
    displayName: identity.displayName,
    email: identity.email,
    avatarUrl: identity.avatarUrl,
  },
  workspace: { id: "workspace-1", name: "Researcher's workspace", slug: "personal-test" },
  role: "OWNER",
};

function createStore(existing: SessionContext | null) {
  return {
    findByAuthProviderId: vi.fn<AuthStore["findByAuthProviderId"]>().mockResolvedValue(existing),
    createUserWithWorkspace: vi
      .fn<AuthStore["createUserWithWorkspace"]>()
      .mockResolvedValue(session),
    updateUserProfile: vi.fn<AuthStore["updateUserProfile"]>().mockResolvedValue(undefined),
  } satisfies AuthStore;
}

describe("authenticated workspace provisioning", () => {
  it("reuses an existing workspace without provisioning another one", async () => {
    const store = createStore(session);

    expect(await ensureUserProvisioned(store, identity)).toBe(session);
    expect(store.createUserWithWorkspace).not.toHaveBeenCalled();
  });

  it("provisions a missing user through the shared fallback", async () => {
    const store = createStore(null);

    expect(await syncUserProfile(store, identity)).toBe(session);
    expect(store.createUserWithWorkspace).toHaveBeenCalledExactlyOnceWith(identity);
  });

  it("reuses the winning workspace when a concurrent provisioning call completes first", async () => {
    const store = createStore(null);
    store.findByAuthProviderId.mockResolvedValueOnce(null).mockResolvedValueOnce(session);
    store.createUserWithWorkspace.mockRejectedValueOnce(new Error("Concurrent creation"));

    expect(await ensureUserProvisioned(store, identity)).toBe(session);
  });

  it("propagates a failed provision when no concurrent workspace exists", async () => {
    const store = createStore(null);
    const failure = new Error("Database unavailable");
    store.createUserWithWorkspace.mockRejectedValueOnce(failure);

    await expect(ensureUserProvisioned(store, identity)).rejects.toBe(failure);
  });
});

describe("profile refresh after a missed webhook", () => {
  it("does not write an unchanged profile", async () => {
    const store = createStore(session);

    expect(await syncUserProfile(store, identity)).toBe(session);
    expect(store.updateUserProfile).not.toHaveBeenCalled();
  });

  it("refreshes profile details while retaining the workspace and membership", async () => {
    const store = createStore(session);
    const updated = {
      ...identity,
      displayName: "Updated Researcher",
      email: "updated@example.test",
      avatarUrl: "https://example.test/avatar.png",
    };

    const result = await syncUserProfile(store, updated);

    expect(store.updateUserProfile).toHaveBeenCalledExactlyOnceWith(updated);
    expect(result.user).toEqual({
      id: session.user.id,
      displayName: updated.displayName,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
    });
    expect(result.workspace).toBe(session.workspace);
    expect(result.role).toBe(session.role);
    expect(store.createUserWithWorkspace).not.toHaveBeenCalled();
  });

  it("does not report refreshed details when persistence fails", async () => {
    const store = createStore(session);
    const failure = new Error("Profile update failed");
    store.updateUserProfile.mockRejectedValueOnce(failure);

    await expect(
      syncUserProfile(store, { ...identity, displayName: "Updated Researcher" }),
    ).rejects.toBe(failure);
  });
});
