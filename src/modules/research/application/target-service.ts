import { failure, type DomainResult } from "@/modules/shared/domain/result";

import { parseDateOnly, startOfDayUtc } from "../domain/fields";
import { targetInputSchema, targetUpdateInputSchema, type TargetInput } from "../domain/target";
import type {
  ProjectStore,
  TargetCreateData,
  TargetDetail,
  TargetListRow,
  TargetStore,
} from "./ports";

type Actor = {
  userId: string;
  workspaceId: string;
};

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the target details and try again.";
}

function toCreateData(projectId: string, input: TargetInput): TargetCreateData {
  return {
    projectId,
    name: input.name,
    description: input.description,
    assetIdentifier: input.assetIdentifier,
    assetType: input.assetType,
    environmentType: input.environmentType,
    programName: input.programName,
    programUrl: input.programUrl,
    authorizationSource: input.authorizationSource,
    authorizationDate: input.authorizationDate
      ? startOfDayUtc(parseDateOnly(input.authorizationDate) ?? new Date())
      : null,
    authorizationNotes: input.authorizationNotes,
  };
}

export function listTargets(store: TargetStore, workspaceId: string): Promise<TargetListRow[]> {
  return store.listTargets(workspaceId);
}

export function getTarget(
  store: TargetStore,
  workspaceId: string,
  targetId: string,
): Promise<TargetDetail | null> {
  return store.findTarget(workspaceId, targetId);
}

export async function createTarget(
  projectStore: ProjectStore,
  targetStore: TargetStore,
  actor: Actor,
  projectId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = targetInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const project = await projectStore.findProjectLookup(actor.workspaceId, projectId);

  if (!project) {
    return failure(
      "PROJECT_NOT_FOUND",
      "We can't find that project in this workspace. Open Projects to choose an available one.",
    );
  }

  if (project.status === "ARCHIVED") {
    return failure(
      "PROJECT_ARCHIVED",
      "This project is archived. Choose an active project to register a target.",
    );
  }

  if (await targetStore.targetAssetExists(projectId, parsed.data.assetIdentifier)) {
    return failure(
      "TARGET_DUPLICATE",
      "This asset identifier is already registered in this project. Open the existing target or enter a different identifier.",
    );
  }

  const target = await targetStore.createTarget(toCreateData(projectId, parsed.data), {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    action: "TARGET_CREATED",
    entityType: "Target",
    newValue: {
      name: parsed.data.name,
      assetIdentifier: parsed.data.assetIdentifier,
      assetType: parsed.data.assetType,
      environmentType: parsed.data.environmentType,
      authorizationStatus: "UNVERIFIED",
    },
  });

  return { ok: true, value: { id: target.id } };
}

export async function updateTarget(
  projectStore: ProjectStore,
  targetStore: TargetStore,
  actor: Actor,
  targetId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = targetUpdateInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const existing = await targetStore.findTarget(actor.workspaceId, targetId);

  if (!existing) {
    return failure(
      "TARGET_NOT_FOUND",
      "We can't find that target in this workspace. Open Targets to choose an available one.",
    );
  }

  const project = await projectStore.findProjectLookup(actor.workspaceId, existing.projectId);

  if (!project) {
    return failure(
      "PROJECT_NOT_FOUND",
      "We can't find that project in this workspace. Open Projects to choose an available one.",
    );
  }

  if (project.status === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "This project is archived, so its targets are read-only.");
  }

  if (
    await targetStore.targetAssetExists(
      existing.projectId,
      parsed.data.assetIdentifier,
      existing.id,
    )
  ) {
    return failure(
      "TARGET_DUPLICATE",
      "This asset identifier is already registered in this project. Open the existing target or enter a different identifier.",
    );
  }

  const updated = await targetStore.updateTarget(
    actor.workspaceId,
    targetId,
    toCreateData(existing.projectId, parsed.data),
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "TARGET_UPDATED",
      entityType: "Target",
      previousValue: {
        name: existing.name,
        assetIdentifier: existing.assetIdentifier,
        environmentType: existing.environmentType,
      },
      newValue: {
        name: parsed.data.name,
        assetIdentifier: parsed.data.assetIdentifier,
        environmentType: parsed.data.environmentType,
      },
    },
  );

  if (!updated) {
    return failure(
      "TARGET_NOT_FOUND",
      "We can't find that target in this workspace. Open Targets to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}
