import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
export const retrievalInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  engagementId: z.uuid().optional(),
  investigationId: z.uuid().optional(),
  limit: z.number().int().min(1).max(12).default(8),
});
export type RetrievalInput = z.infer<typeof retrievalInputSchema>;
export type RetrievedKnowledge = {
  chunkId: string;
  documentId: string;
  documentVersion: number;
  title: string;
  content: string;
  checksum: string;
  sourceId: string;
  origin: string;
  url: string | null;
  score: number;
  startOffset: number;
  endOffset: number;
};
export interface KnowledgeRetrievalStore {
  retrieve(
    actor: ResearchActor,
    input: RetrievalInput,
  ): Promise<{ retrievalId: string; results: RetrievedKnowledge[] }>;
}
export async function retrieveKnowledge(
  store: KnowledgeRetrievalStore,
  actor: ResearchActor,
  raw: unknown,
) {
  const parsed = retrievalInputSchema.safeParse(raw);
  if (!parsed.success) return failure("VALIDATION_FAILED", "Enter a bounded research query.");
  return researchOperation(() => store.retrieve(actor, parsed.data));
}
