import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
import {
  knowledgeInputSchema,
  knowledgeRelationSchema,
  knowledgeReviewSchema,
  type KnowledgeInput,
  type KnowledgeRelationInput,
  type KnowledgeReviewInput,
} from "../domain/knowledge";

export type KnowledgeRow = {
  id: string;
  title: string;
  tags: string[];
  version: number;
  reviewStatus: string;
  createdAt: Date;
  source: { origin: string; url: string | null };
};
export type KnowledgeDetail = KnowledgeRow & {
  content: string;
  sourceId: string;
  engagementId: string | null;
  investigationId: string | null;
  reviewedAt: Date | null;
  creator: { displayName: string };
  source: KnowledgeRow["source"] & { publishedAt: Date | null; retrievedAt: Date | null };
};
export interface KnowledgeStore {
  list(workspaceId: string, query?: string): Promise<KnowledgeRow[]>;
  find(workspaceId: string, id: string): Promise<KnowledgeDetail | null>;
  create(actor: ResearchActor, input: KnowledgeInput): Promise<{ id: string }>;
  review(actor: ResearchActor, input: KnowledgeReviewInput): Promise<{ id: string }>;
  relate(actor: ResearchActor, input: KnowledgeRelationInput): Promise<{ id: string }>;
}
function operation<T>(
  schema: z.ZodType<T>,
  input: unknown,
  run: (data: T) => Promise<{ id: string }>,
) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return Promise.resolve(
      failure(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Check the knowledge details.",
      ),
    );
  return researchOperation(() => run(parsed.data));
}
export const createKnowledgeDocument = (
  store: KnowledgeStore,
  actor: ResearchActor,
  input: unknown,
) => operation(knowledgeInputSchema, input, (data) => store.create(actor, data));
export const reviewKnowledgeDocument = (
  store: KnowledgeStore,
  actor: ResearchActor,
  input: unknown,
) => operation(knowledgeReviewSchema, input, (data) => store.review(actor, data));
export const relateKnowledgeDocuments = (
  store: KnowledgeStore,
  actor: ResearchActor,
  input: unknown,
) => operation(knowledgeRelationSchema, input, (data) => store.relate(actor, data));
