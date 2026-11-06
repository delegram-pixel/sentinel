import type { Prisma } from "@/generated/prisma/client";

import type {
  WorkspaceOverview,
  WorkspaceOverviewAccess,
  WorkspaceOverviewStore,
} from "../application/ports";

type DatabaseClient = Pick<Prisma.TransactionClient, "workspace">;

/** Aggregate only relations of a workspace the requesting user has joined. */
export class PrismaWorkspaceOverviewStore implements WorkspaceOverviewStore {
  constructor(private readonly db: DatabaseClient) {}

  async getOverview(access: WorkspaceOverviewAccess): Promise<WorkspaceOverview | null> {
    const where = {
      id: access.workspaceId,
      members: { some: { userId: access.userId } },
    };

    // A transaction client shares one PostgreSQL connection, so query serially.
    const overview = await this.db.workspace.findFirst({
      where,
      select: {
        _count: {
          select: {
            projects: true,
            investigations: { where: { status: "ACTIVE" } },
            findings: { where: { status: "NEEDS_VALIDATION" } },
          },
        },
      },
    });

    if (!overview) return null;

    const confirmed = await this.db.workspace.findFirst({
      where,
      select: {
        _count: {
          select: {
            findings: { where: { status: { in: ["CONFIRMED", "REPORTABLE"] } } },
          },
        },
      },
    });

    if (!confirmed) {
      return null;
    }

    return {
      projectCount: overview._count.projects,
      activeInvestigationCount: overview._count.investigations,
      validationQueueCount: overview._count.findings,
      confirmedFindingCount: confirmed._count.findings,
    };
  }
}
