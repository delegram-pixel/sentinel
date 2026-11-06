import { z } from "zod";

import { failure, type DomainResult } from "@/modules/shared/domain/result";

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "RESEARCHER", "REVIEWER"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export type WorkspaceMembership = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type WorkspaceAccessContext = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

/**
 * Workspace is the sole tenancy root (ADR-001). A requested workspace ID is
 * never trusted without a membership lookup.
 */
export function resolveWorkspaceAccess(
  userId: string,
  requestedWorkspaceId: string,
  memberships: readonly WorkspaceMembership[],
): DomainResult<WorkspaceAccessContext> {
  if (!userId || !requestedWorkspaceId) {
    return failure("WORKSPACE_ACCESS_DENIED", "A user and workspace are required.");
  }

  const membership = memberships.find(
    (candidate) => candidate.userId === userId && candidate.workspaceId === requestedWorkspaceId,
  );

  if (!membership) {
    return failure(
      "WORKSPACE_ACCESS_DENIED",
      "The user is not a member of the requested workspace.",
    );
  }

  return {
    ok: true,
    value: {
      userId,
      workspaceId: requestedWorkspaceId,
      role: membership.role,
    },
  };
}

/**
 * Use before reading or mutating any resource that carries a workspace ID.
 */
export function assertResourceInWorkspace(
  resourceWorkspaceId: string,
  context: WorkspaceAccessContext,
): DomainResult<true> {
  if (resourceWorkspaceId !== context.workspaceId) {
    return failure(
      "CROSS_WORKSPACE_ACCESS",
      "The resource does not belong to the requesting workspace.",
    );
  }

  return { ok: true, value: true };
}

export function canAccessWorkspace(
  userId: string,
  requestedWorkspaceId: string,
  memberships: readonly WorkspaceMembership[],
): boolean {
  return resolveWorkspaceAccess(userId, requestedWorkspaceId, memberships).ok;
}

export function hasRole(context: WorkspaceAccessContext, roles: readonly WorkspaceRole[]): boolean {
  return roles.includes(context.role);
}
