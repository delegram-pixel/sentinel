import { failure, ResearchOperationError, type DomainResult } from "../domain/result";
export { ResearchOperationError } from "../domain/result";
import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";

export type ResearchActor = { workspaceId: string; userId: string; role: WorkspaceRole };

export async function researchOperation<T>(operation: () => Promise<T>): Promise<DomainResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof ResearchOperationError) return failure(error.code, error.message);
    throw error;
  }
}

export function canReviewResearch(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "REVIEWER";
}
