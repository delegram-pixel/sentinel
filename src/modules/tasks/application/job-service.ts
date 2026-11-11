import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
import { jobOperationKeySchema, type JobKind, type JobRow } from "../domain/job";
export interface JobStore {
  enqueue(
    actor: ResearchActor,
    kind: JobKind,
    operationKey: string,
    payload: unknown,
  ): Promise<{ id: string }>;
  find(workspaceId: string, id: string): Promise<JobRow | null>;
  list(workspaceId: string): Promise<JobRow[]>;
  cancel(actor: ResearchActor, id: string): Promise<boolean>;
  claim(): Promise<JobRow | null>;
  heartbeat(job: JobRow, progress?: number): Promise<boolean>;
  finish(job: JobRow, result: unknown): Promise<boolean>;
  defer(job: JobRow, availableAt: Date, progress: number): Promise<boolean>;
  fail(job: JobRow, failureCode: string, retryable: boolean): Promise<boolean>;
}
export async function enqueueResearchJob(
  store: JobStore,
  actor: ResearchActor,
  kind: JobKind,
  key: string,
  payload: unknown,
) {
  const parsed = jobOperationKeySchema.safeParse(key);
  if (!parsed.success) return failure("VALIDATION_FAILED", "Supply a stable request identifier.");
  return researchOperation(() => store.enqueue(actor, kind, parsed.data, payload));
}
export async function cancelResearchJob(store: JobStore, actor: ResearchActor, id: string) {
  return researchOperation(() => store.cancel(actor, id));
}
