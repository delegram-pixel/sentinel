"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  ScopeActivationField,
  ScopeActivationFormState,
  ScopeDraftField,
  ScopeDraftFormState,
  ScopeRevokeState,
} from "@/components/research/scope-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  activateScope,
  createScopeDraft,
  revokeScope,
} from "@/modules/research/application/scope-service";
import { scopeActivationInputSchema, scopeDraftInputSchema } from "@/modules/research/domain/scope";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

const DRAFT_FIELDS: readonly ScopeDraftField[] = [
  "effectiveFrom",
  "effectiveUntil",
  "assets",
  "permittedActivities",
  "attestationNotes",
];

const ACTIVATION_FIELDS: readonly ScopeActivationField[] = [
  "authorizationSource",
  "authorizationDate",
  "attestationNotes",
  "acknowledged",
];

function scopePath(projectId: string, targetId: string, scopeId: string): string {
  return `/dashboard/projects/${projectId}/targets/${targetId}/scopes/${scopeId}`;
}

function revalidateScopeViews(projectId: string, targetId: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/targets");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/targets`);
  revalidatePath(`/dashboard/projects/${projectId}/targets/${targetId}`);
}

function readAssets(formData: FormData) {
  const identifiers = formData.getAll("assetIdentifier").map(String);
  const assetTypes = formData.getAll("assetType").map(String);
  const matchTypes = formData.getAll("matchType").map(String);
  const effects = formData.getAll("effect").map(String);
  const notes = formData.getAll("assetNotes").map(String);

  return identifiers.map((assetIdentifier, index) => ({
    assetIdentifier,
    assetType: assetTypes[index] ?? "",
    matchType: matchTypes[index] ?? "",
    effect: effects[index] ?? "",
    notes: notes[index] ?? "",
  }));
}

function readActivities(formData: FormData): string[] {
  return formData.getAll("permittedActivities").map(String);
}

function draftFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Partial<Record<ScopeDraftField, string>> {
  const errors: Partial<Record<ScopeDraftField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && DRAFT_FIELDS.includes(field as ScopeDraftField)) {
      const key = field as ScopeDraftField;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

function activationFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Partial<Record<ScopeActivationField, string>> {
  const errors: Partial<Record<ScopeActivationField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && ACTIVATION_FIELDS.includes(field as ScopeActivationField)) {
      const key = field as ScopeActivationField;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

export async function createScopeDraftAction(
  _previousState: ScopeDraftFormState,
  formData: FormData,
): Promise<ScopeDraftFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const input = {
    effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
    effectiveUntil: String(formData.get("effectiveUntil") ?? ""),
    assets: readAssets(formData),
    permittedActivities: readActivities(formData),
    attestationNotes: String(formData.get("attestationNotes") ?? ""),
  };

  if (!projectId || !targetId) {
    return {
      status: "error",
      message:
        "We couldn't identify the target. Reopen it from the project's Targets page, then try again.",
    };
  }

  const parsed = scopeDraftInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "A few details need attention. Check the highlighted fields, then try again.",
      fieldErrors: draftFieldErrors(parsed.error.issues),
    };
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const target = await store.findTargetLookup(session.workspace.id, targetId);

  if (!target || target.projectId !== projectId) {
    return {
      status: "error",
      message:
        "We can't find that target in this project. Choose one from the project's Targets page.",
    };
  }

  const result = await createScopeDraft(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    targetId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateScopeViews(projectId, targetId);
  redirect(scopePath(projectId, targetId, result.value.id));
}

export async function activateScopeAction(
  _previousState: ScopeActivationFormState,
  formData: FormData,
): Promise<ScopeActivationFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "");
  const input = {
    authorizationSource: String(formData.get("authorizationSource") ?? ""),
    authorizationDate: String(formData.get("authorizationDate") ?? ""),
    attestationNotes: String(formData.get("attestationNotes") ?? ""),
    acknowledged: formData.get("acknowledged") === "on",
  };

  if (!projectId || !targetId || !scopeId) {
    return {
      status: "error",
      message:
        "We couldn't identify the scope. Reopen it from the target's scope history, then try again.",
    };
  }

  const parsed = scopeActivationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "A few details need attention. Check the highlighted fields, then try again.",
      fieldErrors: activationFieldErrors(parsed.error.issues),
    };
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const found = await store.findScope(session.workspace.id, scopeId);

  if (!found || found.target.projectId !== projectId) {
    return {
      status: "error",
      message:
        "We can't find that scope in this project. Open the target's scope history to choose an available version.",
    };
  }

  const result = await activateScope(
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    scopeId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateScopeViews(projectId, targetId);
  revalidatePath(scopePath(projectId, targetId, scopeId));
  redirect(scopePath(projectId, targetId, scopeId));
}

export async function revokeScopeAction(
  _previousState: ScopeRevokeState,
  formData: FormData,
): Promise<ScopeRevokeState> {
  const projectId = String(formData.get("projectId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "");

  if (!projectId || !targetId || !scopeId) {
    return {
      status: "error",
      message:
        "We couldn't identify the scope. Reopen it from the target's scope history, then try again.",
    };
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const found = await store.findScope(session.workspace.id, scopeId);

  if (!found || found.target.projectId !== projectId) {
    return {
      status: "error",
      message:
        "We can't find that scope in this project. Open the target's scope history to choose an available version.",
    };
  }

  const result = await revokeScope(
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    scopeId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateScopeViews(projectId, targetId);
  revalidatePath(scopePath(projectId, targetId, scopeId));
  redirect(scopePath(projectId, targetId, scopeId));
}
