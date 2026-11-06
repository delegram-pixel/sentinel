import type { WorkspaceAccessContext } from "../domain/ownership";

export type WorkspaceOverviewAccess = Pick<WorkspaceAccessContext, "userId" | "workspaceId">;

export type WorkspaceOverview = {
  projectCount: number;
  activeInvestigationCount: number;
  validationQueueCount: number;
  confirmedFindingCount: number;
};

export interface WorkspaceOverviewStore {
  getOverview(access: WorkspaceOverviewAccess): Promise<WorkspaceOverview | null>;
}
