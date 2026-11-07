import { z } from "zod";
import { assetMatchesRule } from "@/modules/research/domain/scope-validator";
import type { ScopeValidationRecord } from "@/modules/research/domain/scope-validator";
import { ResearchOperationError } from "@/modules/shared/domain/result";
const rationale = z.string().trim().min(10).max(8000);
export const remediationInputSchema = z.object({
  findingId: z.uuid(),
  title: z.string().trim().min(3).max(200),
  description: rationale,
});
export const remediationStatusSchema = z.object({
  planId: z.uuid(),
  expectedStatus: z.enum(["PLANNED", "IN_PROGRESS", "READY_FOR_RETEST"]),
  status: z.enum(["PLANNED", "IN_PROGRESS", "READY_FOR_RETEST"]),
  rationale,
});
export const retestRequestSchema = z.object({
  planId: z.uuid(),
  assetId: z.uuid(),
  scopeVersionId: z.uuid(),
  activity: z.enum(["ACTIVE_TEST", "PASSIVE_FETCH"]),
  rationale,
});
export const retestReviewSchema = z.object({
  retestId: z.uuid(),
  suppliedResults: z.string().trim().min(1).max(50_000),
  evidenceIds: z.array(z.uuid()).min(1).max(50),
  conclusion: z.enum(["RESOLVED", "PERSISTS", "INCONCLUSIVE"]),
  rationale,
});
export const remediationClosureSchema = z.object({
  planId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime(),
  rationale,
});
export const submissionInputSchema = z
  .object({
    findingId: z.uuid().optional(),
    reportId: z.uuid().optional(),
    outcome: z.enum([
      "SUBMITTED",
      "ACCEPTED",
      "DUPLICATE",
      "INFORMATIONAL",
      "REJECTED",
      "WITHDRAWN",
    ]),
    destination: z.string().trim().min(1).max(300),
    externalReference: z.string().trim().max(500).optional(),
    occurredAt: z.iso.datetime(),
    rationale,
  })
  .refine((v) => v.findingId || v.reportId, "Choose a report or finding.");

/** Checks a human's documented manual retest request; does not grant executable capabilities. */
export function validateManualRetestScope(
  scope: ScopeValidationRecord & { approvedBy: string | null; approvedAt: Date | null },
  asset: string,
  activity: string,
  now: Date,
) {
  if (
    scope.status !== "ACTIVE" ||
    !scope.approvedBy ||
    !scope.approvedAt ||
    !scope.effectiveFrom ||
    !scope.effectiveUntil ||
    scope.effectiveFrom > now ||
    scope.effectiveUntil < now
  )
    throw new ResearchOperationError(
      "SCOPE_NOT_ACTIVE",
      "A current human-approved scope is required for a manual retest request.",
    );
  const matching = scope.assets.filter((a) =>
    assetMatchesRule(asset, a.assetIdentifier, a.matchType),
  );
  if (
    matching.some((a) => a.effect === "EXCLUDED") ||
    !matching.some((a) => a.effect === "ALLOWED")
  )
    throw new ResearchOperationError(
      "ASSET_NOT_IN_SCOPE",
      "This asset is not permitted by the retest scope.",
    );
  if (
    !scope.activities.some((a) => a.activity === activity && a.effect === "PERMITTED") ||
    scope.activities.some((a) => a.activity === activity && a.effect === "PROHIBITED")
  )
    throw new ResearchOperationError(
      "CAPABILITY_NOT_PERMITTED",
      "The manual retest activity is not permitted by this scope.",
    );
}
