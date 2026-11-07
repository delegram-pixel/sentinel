import { failure } from "@/modules/shared/domain/result";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import {
  importRequestSchema,
  importReviewSchema,
  type ImportRequest,
  type ImportReview,
} from "../domain/tool-import";
export interface ImportStore {
  create(actor: ResearchActor, input: ImportRequest): Promise<{ id: string }>;
  review(actor: ResearchActor, input: ImportReview): Promise<{ id: string }>;
}
export function requestToolImport(store: ImportStore, actor: ResearchActor, input: unknown) {
  const parsed = importRequestSchema.safeParse(input);
  return parsed.success
    ? researchOperation(() => store.create(actor, parsed.data))
    : Promise.resolve(
        failure(
          "VALIDATION_FAILED",
          parsed.error.issues[0]?.message ?? "Check the import details.",
        ),
      );
}
export function reviewImportedResult(store: ImportStore, actor: ResearchActor, input: unknown) {
  const parsed = importReviewSchema.safeParse(input);
  return parsed.success
    ? researchOperation(() => store.review(actor, parsed.data))
    : Promise.resolve(
        failure(
          "VALIDATION_FAILED",
          parsed.error.issues[0]?.message ?? "Check the review details.",
        ),
      );
}
