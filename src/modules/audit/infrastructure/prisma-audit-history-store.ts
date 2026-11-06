import type { Prisma } from "@/generated/prisma/client";

import type {
  AuditHistoryAccess,
  AuditHistoryEntry,
  AuditHistoryStore,
} from "../application/ports";

type DatabaseClient = Pick<Prisma.TransactionClient, "auditLog">;

const HISTORY_LIMIT = 20;

export class PrismaAuditHistoryStore implements AuditHistoryStore {
  constructor(private readonly db: DatabaseClient) {}

  async listWorkspaceHistory(
    access: AuditHistoryAccess,
    limit = HISTORY_LIMIT,
  ): Promise<AuditHistoryEntry[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(HISTORY_LIMIT, Math.trunc(limit)))
      : HISTORY_LIMIT;

    const events = await this.db.auditLog.findMany({
      where: {
        workspaceId: access.workspaceId,
        workspace: { members: { some: { userId: access.userId } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: boundedLimit,
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { displayName: true } },
      },
    });

    return events.map(({ user, ...event }) => ({
      ...event,
      actorName: user?.displayName ?? null,
    }));
  }
}
