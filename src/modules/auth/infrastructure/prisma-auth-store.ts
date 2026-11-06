import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";

import type { AuthenticatedIdentity } from "../domain/identity";
import type { AuthStore, SessionContext } from "../application/ports";

type DatabaseClient = Prisma.TransactionClient;

function workspaceSlug(authProviderId: string): string {
  const digest = createHash("sha256").update(authProviderId).digest("hex").slice(0, 12);

  return `personal-${digest}`;
}

function workspaceName(displayName: string): string {
  return `${displayName.slice(0, 60)}'s workspace`;
}

/**
 * Prisma-backed identity store. Provisioning is one transaction so a user can
 * never exist without their personal workspace and OWNER membership.
 */
export class PrismaAuthStore implements AuthStore {
  constructor(private readonly db: DatabaseClient) {}

  async findByAuthProviderId(authProviderId: string): Promise<SessionContext | null> {
    const user = await this.db.user.findUnique({
      where: { authProviderId },
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        memberships: {
          where: { workspace: { kind: "PERSONAL" } },
          orderBy: { joinedAt: "asc" },
          take: 1,
          select: {
            role: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const membership = user?.memberships[0];

    if (!user || !membership) {
      return null;
    }

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      workspace: membership.workspace,
      role: membership.role,
    };
  }

  async createUserWithWorkspace(identity: AuthenticatedIdentity): Promise<SessionContext> {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { authProviderId: identity.authProviderId },
        create: {
          authProviderId: identity.authProviderId,
          email: identity.email,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
        },
        update: {
          email: identity.email,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
        },
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      });

      const existingWorkspace = await tx.workspace.findFirst({
        where: { ownerId: user.id, kind: "PERSONAL" },
        select: { id: true, name: true, slug: true },
      });

      const workspace =
        existingWorkspace ??
        (await tx.workspace.create({
          data: {
            name: workspaceName(user.displayName),
            slug: workspaceSlug(identity.authProviderId),
            kind: "PERSONAL",
            ownerId: user.id,
          },
          select: { id: true, name: true, slug: true },
        }));

      if (!existingWorkspace) {
        await tx.auditLog.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            action: "WORKSPACE_PROVISIONED",
            entityType: "Workspace",
            entityId: workspace.id,
            newValue: { kind: "PERSONAL", role: "OWNER" },
            metadata: { source: "clerk" },
          },
        });
      }

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
        },
        create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
        update: { role: "OWNER" },
      });

      return {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
        workspace,
        role: "OWNER",
      };
    });
  }

  async updateUserProfile(identity: AuthenticatedIdentity): Promise<void> {
    await this.db.user.update({
      where: { authProviderId: identity.authProviderId },
      data: {
        email: identity.email,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
      },
      select: { id: true },
    });
  }
}
