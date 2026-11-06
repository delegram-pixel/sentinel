import { describe, expect, it } from "vitest";

import {
  assertResourceInWorkspace,
  canAccessWorkspace,
  hasRole,
  resolveWorkspaceAccess,
  type WorkspaceMembership,
} from "@/modules/workspaces/domain/ownership";

const memberships: WorkspaceMembership[] = [
  { userId: "user-1", workspaceId: "workspace-1", role: "OWNER" },
  { userId: "user-2", workspaceId: "workspace-1", role: "RESEARCHER" },
];

describe("workspace ownership guards", () => {
  it("resolves access from membership rather than a supplied id", () => {
    const result = resolveWorkspaceAccess("user-1", "workspace-1", memberships);

    expect(result).toEqual({
      ok: true,
      value: { userId: "user-1", workspaceId: "workspace-1", role: "OWNER" },
    });
  });

  it("denies a workspace the user does not belong to", () => {
    const result = resolveWorkspaceAccess("user-2", "workspace-2", memberships);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WORKSPACE_ACCESS_DENIED");
    }
  });

  it("denies access when identifiers are missing", () => {
    expect(canAccessWorkspace("", "workspace-1", memberships)).toBe(false);
    expect(canAccessWorkspace("user-1", "", memberships)).toBe(false);
  });

  it("detects cross-workspace resources", () => {
    const access = resolveWorkspaceAccess("user-1", "workspace-1", memberships);

    expect(access.ok).toBe(true);
    if (!access.ok) {
      return;
    }

    expect(assertResourceInWorkspace("workspace-1", access.value).ok).toBe(true);
    expect(assertResourceInWorkspace("workspace-2", access.value).ok).toBe(false);
  });

  it("checks roles on an already-resolved context", () => {
    const access = resolveWorkspaceAccess("user-2", "workspace-1", memberships);

    expect(access.ok).toBe(true);
    if (!access.ok) {
      return;
    }

    expect(hasRole(access.value, ["RESEARCHER", "REVIEWER"])).toBe(true);
    expect(hasRole(access.value, ["OWNER"])).toBe(false);
  });
});
