import { z } from "zod";
import { PROJECT_TYPES } from "@/modules/research/domain/project";

export const ENGAGEMENT_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
const optionalDate = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);
export const engagementInputSchema = z
  .object({
    projectId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    objective: z.string().trim().max(4000).optional(),
    engagementType: z.enum(PROJECT_TYPES),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, {
    message: "The end date must follow the start date.",
    path: ["endsAt"],
  });
export const engagementAssetSchema = z.object({ engagementId: z.uuid(), targetId: z.uuid() });
export const engagementAuthorizationSchema = z.object({
  engagementId: z.uuid(),
  assetId: z.uuid(),
  scopeVersionId: z.uuid(),
  source: z.string().trim().min(3).max(2000),
});
export const associateInvestigationSchema = z.object({
  engagementId: z.uuid(),
  investigationId: z.uuid(),
});
export const engagementStatusSchema = z.object({
  engagementId: z.uuid(),
  expectedStatus: z.enum(ENGAGEMENT_STATUSES),
  status: z.enum(ENGAGEMENT_STATUSES),
});
export type EngagementInput = z.infer<typeof engagementInputSchema>;
export type EngagementAssetInput = z.infer<typeof engagementAssetSchema>;
export type EngagementAuthorizationInput = z.infer<typeof engagementAuthorizationSchema>;
export type AssociateInvestigationInput = z.infer<typeof associateInvestigationSchema>;
export type EngagementStatusInput = z.infer<typeof engagementStatusSchema>;
