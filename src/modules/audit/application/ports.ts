export type AuditHistoryAccess = {
  userId: string;
  workspaceId: string;
};

export type AuditHistoryEntry = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: Date;
};

export interface AuditHistoryStore {
  /** Return recent events only when the user belongs to the workspace. */
  listWorkspaceHistory(access: AuditHistoryAccess, limit?: number): Promise<AuditHistoryEntry[]>;
}
