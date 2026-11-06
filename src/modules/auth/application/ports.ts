import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";

import type { AuthenticatedIdentity } from "../domain/identity";

export type SessionUser = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

export type SessionWorkspace = {
  id: string;
  name: string;
  slug: string;
};

export type SessionContext = {
  user: SessionUser;
  workspace: SessionWorkspace;
  role: WorkspaceRole;
};

/**
 * Persistence port for identity synchronization and workspace provisioning.
 * The Prisma implementation is the only place that knows the table shape.
 */
export interface AuthStore {
  findByAuthProviderId(authProviderId: string): Promise<SessionContext | null>;
  /**
   * Idempotently create the user, their personal workspace, and the OWNER
   * membership in one transaction (ADR-001, ADR-014).
   */
  createUserWithWorkspace(identity: AuthenticatedIdentity): Promise<SessionContext>;
  updateUserProfile(identity: AuthenticatedIdentity): Promise<void>;
}
