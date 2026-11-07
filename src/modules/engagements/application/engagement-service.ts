import { z } from "zod";
import { researchOperation, type ResearchActor } from "@/modules/shared/application/actor";
import { failure } from "@/modules/shared/domain/result";
import {
  associateInvestigationSchema,
  engagementAssetSchema,
  engagementAuthorizationSchema,
  engagementInputSchema,
  engagementStatusSchema,
} from "../domain/engagement";
import type { EngagementStore } from "./ports";

function parseOperation<T>(
  schema: z.ZodType<T>,
  input: unknown,
  operation: (value: T) => Promise<{ id: string }>,
) {
  const result = schema.safeParse(input);
  if (!result.success)
    return Promise.resolve(
      failure(
        "VALIDATION_FAILED",
        result.error.issues[0]?.message ?? "Check the engagement details.",
      ),
    );
  return researchOperation(() => operation(result.data));
}
export const createEngagement = (store: EngagementStore, actor: ResearchActor, input: unknown) =>
  parseOperation(engagementInputSchema, input, (data) => store.create(actor, data));
export const addEngagementAsset = (store: EngagementStore, actor: ResearchActor, input: unknown) =>
  parseOperation(engagementAssetSchema, input, (data) => store.addAsset(actor, data));
export const recordEngagementAuthorization = (
  store: EngagementStore,
  actor: ResearchActor,
  input: unknown,
) =>
  parseOperation(engagementAuthorizationSchema, input, (data) =>
    store.recordAuthorization(actor, data),
  );
export const associateInvestigation = (
  store: EngagementStore,
  actor: ResearchActor,
  input: unknown,
) => parseOperation(associateInvestigationSchema, input, (data) => store.associate(actor, data));
export const changeEngagementStatus = (
  store: EngagementStore,
  actor: ResearchActor,
  input: unknown,
) => parseOperation(engagementStatusSchema, input, (data) => store.changeStatus(actor, data));
