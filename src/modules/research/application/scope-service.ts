import type { Capability, CapabilityActor } from "@/modules/security/domain/capability";
import { failure, type DomainResult } from "@/modules/shared/domain/result";

import { endOfDayUtc, parseDateOnly, startOfDayUtc } from "../domain/fields";
import {
  scopeActivationInputSchema,
  scopeDraftInputSchema,
  validateScopeActivation,
} from "../domain/scope";
import { validateScopeCapability, type ScopeValidationSuccess } from "../domain/scope-validator";
import type { ScopeRow, ScopeStore, TargetStore } from "./ports";

type Actor = {
  userId: string;
  workspaceId: string;
};

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the scope details and try again.";
}

export async function createScopeDraft(
  scopeStore: ScopeStore,
  targetStore: TargetStore,
  actor: Actor,
  targetId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string; version: number }>> {
  const parsed = scopeDraftInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const target = await targetStore.findTargetLookup(actor.workspaceId, targetId);

  if (!target) {
    return failure(
      "TARGET_NOT_FOUND",
      "We can't find that target in this workspace. Open Targets to choose an available one.",
    );
  }

  const effectiveFromDate = parseDateOnly(parsed.data.effectiveFrom);
  const effectiveUntilDate = parseDateOnly(parsed.data.effectiveUntil);

  if (!effectiveFromDate || !effectiveUntilDate) {
    return failure(
      "VALIDATION_FAILED",
      "Check the scope's start and end dates. Both need to be valid dates.",
    );
  }

  const effectiveFrom = startOfDayUtc(effectiveFromDate);
  const effectiveUntil = endOfDayUtc(effectiveUntilDate);

  const scope = await scopeStore.createScopeDraft(
    {
      targetId,
      effectiveFrom,
      effectiveUntil,
      assets: parsed.data.assets,
      permittedActivities: parsed.data.permittedActivities,
      attestationNotes: parsed.data.attestationNotes,
      createdBy: actor.userId,
      now,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "SCOPE_DRAFT_CREATED",
      entityType: "ScopeVersion",
      newValue: {
        targetId,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveUntil: parsed.data.effectiveUntil,
        assetCount: parsed.data.assets.length,
        permittedActivities: parsed.data.permittedActivities,
      },
    },
  );

  return { ok: true, value: { id: scope.id, version: scope.version } };
}

export async function activateScope(
  scopeStore: ScopeStore,
  actor: Actor,
  scopeId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string; version: number }>> {
  const parsed = scopeActivationInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const found = await scopeStore.findScope(actor.workspaceId, scopeId);

  if (!found) {
    return failure(
      "SCOPE_NOT_FOUND",
      "We can't find that scope version in this workspace. Open the target's scope history to choose an available version.",
    );
  }

  const activation = validateScopeActivation(found.scope, parsed.data, now);

  if (!activation.ok) {
    return failure(activation.code, activation.message);
  }

  const authorizationDateValue = parseDateOnly(parsed.data.authorizationDate);

  if (!authorizationDateValue) {
    return failure("VALIDATION_FAILED", "Enter a valid authorization date.");
  }

  const authorizationDate = startOfDayUtc(authorizationDateValue);

  const activated = await scopeStore.activateScope(
    {
      scopeId,
      targetId: found.target.id,
      approvedBy: actor.userId,
      approvedAt: now,
      authorizationSource: parsed.data.authorizationSource,
      authorizationDate,
      attestationNotes: parsed.data.attestationNotes,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "SCOPE_ACTIVATED",
      entityType: "ScopeVersion",
      previousValue: { status: found.scope.status, version: found.scope.version },
      newValue: {
        status: "ACTIVE",
        version: found.scope.version,
        authorizationSource: parsed.data.authorizationSource,
        authorizationDate: parsed.data.authorizationDate,
      },
    },
  );

  return { ok: true, value: { id: activated.id, version: activated.version } };
}

export async function revokeScope(
  scopeStore: ScopeStore,
  actor: Actor,
  scopeId: string,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const found = await scopeStore.findScope(actor.workspaceId, scopeId);

  if (!found) {
    return failure(
      "SCOPE_NOT_FOUND",
      "We can't find that scope version in this workspace. Open the target's scope history to choose an available version.",
    );
  }

  if (found.scope.status !== "ACTIVE") {
    return failure(
      "SCOPE_NOT_ACTIVE",
      "Revocation applies to the active scope version. Check the target's scope history for the current one.",
    );
  }

  const revoked = await scopeStore.revokeScope(actor.workspaceId, scopeId, now, {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    action: "SCOPE_REVOKED",
    entityType: "ScopeVersion",
    previousValue: { status: "ACTIVE", version: found.scope.version },
    newValue: { status: "REVOKED", version: found.scope.version },
  });

  if (!revoked) {
    return failure(
      "SCOPE_NOT_FOUND",
      "We can't find that scope version in this workspace. Open the target's scope history to choose an available version.",
    );
  }

  return { ok: true, value: { id: revoked.id } };
}

/**
 * Action-time authorization for a target-touching capability. This is the
 * function a future passive/active capability must call before doing anything.
 */
export async function validateTargetCapability(
  scopeStore: ScopeStore,
  targetStore: TargetStore,
  actor: Actor,
  targetId: string,
  capability: Capability,
  actorType: CapabilityActor = "HUMAN",
  now: Date = new Date(),
): Promise<DomainResult<ScopeValidationSuccess>> {
  const target = await targetStore.findTargetLookup(actor.workspaceId, targetId);

  if (!target) {
    return failure(
      "TARGET_NOT_FOUND",
      "We can't find that target in this workspace. Open Targets to choose an available one.",
    );
  }

  const activeScope = await scopeStore.findActiveScope(actor.workspaceId, targetId);

  return validateScopeCapability({
    scope: activeScope,
    targetAssetIdentifier: target.assetIdentifier,
    capability,
    actor: actorType,
    now,
  });
}

export function summarizeScope(scope: ScopeRow): string {
  const allowed = scope.assets.filter((asset) => asset.effect === "ALLOWED").length;
  const excluded = scope.assets.filter((asset) => asset.effect === "EXCLUDED").length;

  return `${allowed} allowed, ${excluded} excluded, ${scope.activities.length} activities`;
}
