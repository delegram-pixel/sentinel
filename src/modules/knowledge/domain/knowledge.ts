import { z } from "zod";

export const KNOWLEDGE_ORIGINS = [
  "USER_NOTE",
  "PUBLIC_REFERENCE",
  "IMPORTED_RESULT",
  "AI_INTERPRETATION",
  "HUMAN_REVIEWED",
] as const;
const optionalId = z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional());
const optionalDate = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional());
export const knowledgeInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(3).max(100000),
  origin: z.enum(KNOWLEDGE_ORIGINS),
  url: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .url()
      .refine(
        (v) => ["http:", "https:"].includes(new URL(v).protocol),
        "Use an HTTP or HTTPS source URL.",
      )
      .optional(),
  ),
  publishedAt: optionalDate,
  retrievedAt: optionalDate,
  engagementId: optionalId,
  investigationId: optionalId,
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});
export const knowledgeReviewSchema = z.object({
  documentId: z.uuid(),
  expectedStatus: z.enum(["DRAFT", "REVIEWED", "WITHDRAWN"]),
  status: z.enum(["REVIEWED", "WITHDRAWN"]),
  rationale: z.string().trim().min(3).max(2000),
});
export const knowledgeRelationSchema = z
  .object({
    fromId: z.uuid(),
    toId: z.uuid(),
    relationship: z.enum(["SUPPORTS", "CONTRADICTS", "CONTEXT", "SUPERSEDES"]),
    rationale: z.string().trim().min(3).max(2000),
  })
  .refine((v) => v.fromId !== v.toId, "A document cannot relate to itself.");
export type KnowledgeInput = z.infer<typeof knowledgeInputSchema>;
export type KnowledgeReviewInput = z.infer<typeof knowledgeReviewSchema>;
export type KnowledgeRelationInput = z.infer<typeof knowledgeRelationSchema>;
