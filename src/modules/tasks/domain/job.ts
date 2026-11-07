import { z } from "zod";
export const JOB_KINDS = [
  "AI_TASK",
  "KNOWLEDGE_INDEX",
  "TOOL_IMPORT",
  "EVIDENCE_CLEANUP",
  "EVIDENCE_PROMOTION",
] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export const jobOperationKeySchema = z.string().trim().min(8).max(160);
export type JobRow = {
  id: string;
  workspaceId: string;
  requestedBy: string;
  kind: string;
  payload: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  leaseToken: string | null;
  leaseUntil: Date | null;
  cancelRequestedAt: Date | null;
  progress: number;
  result: unknown;
  failureCode: string | null;
  createdAt: Date;
};
export function retryDelay(attempt: number): number {
  return Math.min(60000, 1000 * 2 ** Math.max(0, attempt - 1));
}
