"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  TargetFormField,
  TargetFormState,
  TargetFormValues,
} from "@/components/research/target-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { createTarget, updateTarget } from "@/modules/research/application/target-service";
import { targetInputSchema } from "@/modules/research/domain/target";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

const TARGET_FIELDS: readonly TargetFormField[] = [
  "name",
  "description",
  "assetIdentifier",
  "assetType",
  "environmentType",
  "programName",
  "programUrl",
  "authorizationSource",
  "authorizationDate",
  "authorizationNotes",
];

function readValues(formData: FormData): TargetFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    assetIdentifier: String(formData.get("assetIdentifier") ?? ""),
    assetType: String(formData.get("assetType") ?? ""),
    environmentType: String(formData.get("environmentType") ?? ""),
    programName: String(formData.get("programName") ?? ""),
    programUrl: String(formData.get("programUrl") ?? ""),
    authorizationSource: String(formData.get("authorizationSource") ?? ""),
    authorizationDate: String(formData.get("authorizationDate") ?? ""),
    authorizationNotes: String(formData.get("authorizationNotes") ?? ""),
  };
}

function toFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Partial<Record<TargetFormField, string>> {
  const errors: Partial<Record<TargetFormField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && TARGET_FIELDS.includes(field as TargetFormField)) {
      const key = field as TargetFormField;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

function invalidState(
  values: TargetFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): TargetFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(issues),
    values,
  };
}

export async function createTargetAction(
  _previousState: TargetFormState,
  formData: FormData,
): Promise<TargetFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const values = readValues(formData);

  if (!projectId) {
    return { status: "error", message: "The project identifier is missing.", values };
  }

  const parsed = targetInputSchema.safeParse(values);

  if (!parsed.success) {
    return invalidState(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await createTarget(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    projectId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/targets");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/targets`);

  redirect(`/dashboard/projects/${projectId}/targets/${result.value.id}`);
}

export async function updateTargetAction(
  _previousState: TargetFormState,
  formData: FormData,
): Promise<TargetFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const values = readValues(formData);

  if (!projectId || !targetId) {
    return { status: "error", message: "The target identifier is missing.", values };
  }

  const parsed = targetInputSchema.safeParse(values);

  if (!parsed.success) {
    return invalidState(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const existing = await store.findTarget(session.workspace.id, targetId);

  if (!existing || existing.projectId !== projectId) {
    return { status: "error", message: "That target does not exist in this project.", values };
  }

  const result = await updateTarget(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    targetId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/targets");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/targets`);
  revalidatePath(`/dashboard/projects/${projectId}/targets/${targetId}`);

  redirect(`/dashboard/projects/${projectId}/targets/${targetId}`);
}
