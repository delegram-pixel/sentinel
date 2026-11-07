import { z } from "zod";
import { failure } from "@/modules/shared/domain/result";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import {
  remediationInputSchema,
  remediationStatusSchema,
  retestRequestSchema,
  retestReviewSchema,
  remediationClosureSchema,
  submissionInputSchema,
} from "../domain/remediation";
export interface RemediationStore {
  create(
    actor: ResearchActor,
    input: z.infer<typeof remediationInputSchema>,
  ): Promise<{ id: string }>;
  changeStatus(
    actor: ResearchActor,
    input: z.infer<typeof remediationStatusSchema>,
  ): Promise<{ id: string }>;
  requestRetest(
    actor: ResearchActor,
    input: z.infer<typeof retestRequestSchema>,
  ): Promise<{ id: string }>;
  reviewRetest(
    actor: ResearchActor,
    input: z.infer<typeof retestReviewSchema>,
  ): Promise<{ id: string }>;
  close(
    actor: ResearchActor,
    input: z.infer<typeof remediationClosureSchema>,
  ): Promise<{ id: string }>;
  recordSubmission(
    actor: ResearchActor,
    input: z.infer<typeof submissionInputSchema>,
  ): Promise<{ id: string }>;
}
function run<T>(schema: z.ZodType<T>, input: unknown, action: (v: T) => Promise<{ id: string }>) {
  const p = schema.safeParse(input);
  return p.success
    ? researchOperation(() => action(p.data))
    : Promise.resolve(
        failure("VALIDATION_FAILED", p.error.issues[0]?.message ?? "Check the details."),
      );
}
export const createRemediation = (s: RemediationStore, a: ResearchActor, v: unknown) =>
  run(remediationInputSchema, v, (x) => s.create(a, x));
export const changeRemediationStatus = (s: RemediationStore, a: ResearchActor, v: unknown) =>
  run(remediationStatusSchema, v, (x) => s.changeStatus(a, x));
export const requestManualRetest = (s: RemediationStore, a: ResearchActor, v: unknown) =>
  run(retestRequestSchema, v, (x) => s.requestRetest(a, x));
export const reviewManualRetest = (s: RemediationStore, a: ResearchActor, v: unknown) =>
  run(retestReviewSchema, v, (x) => s.reviewRetest(a, x));
export const closeRemediation = (s: RemediationStore, a: ResearchActor, v: unknown) =>
  run(remediationClosureSchema, v, (x) => s.close(a, x));
export const recordSubmissionOutcome = (s: RemediationStore, a: ResearchActor, v: unknown) =>
  run(submissionInputSchema, v, (x) => s.recordSubmission(a, x));
