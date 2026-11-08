"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  ArchiveProjectState,
  ProjectFormField,
  ProjectFormState,
  ProjectFormValues,
} from "@/components/research/project-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  archiveProject,
  createProject,
  updateProject,
} from "@/modules/research/application/project-service";
import { projectInputSchema } from "@/modules/research/domain/project";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

const PROJECT_FIELDS: readonly ProjectFormField[] = ["name", "description", "projectType"];

function readValues(formData: FormData): ProjectFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    projectType: String(formData.get("projectType") ?? ""),
  };
}

function readProjectId(formData: FormData): string {
  return String(formData.get("projectId") ?? "");
}

function toFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Partial<Record<ProjectFormField, string>> {
  const errors: Partial<Record<ProjectFormField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && PROJECT_FIELDS.includes(field as ProjectFormField)) {
      const key = field as ProjectFormField;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

function invalidState(
  values: ProjectFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): ProjectFormState {
  return {
    status: "error",
    message: "A few details need attention. Check the highlighted fields, then try again.",
    fieldErrors: toFieldErrors(issues),
    values,
  };
}

export async function createProjectAction(
  _previousState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values = readValues(formData);
  const parsed = projectInputSchema.safeParse(values);

  if (!parsed.success) {
    return invalidState(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await createProject(
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");

  redirect(`/dashboard/projects/${result.value.id}`);
}

export async function updateProjectAction(
  _previousState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const projectId = readProjectId(formData);
  const values = readValues(formData);

  if (!projectId) {
    return {
      status: "error",
      message: "We couldn't identify the project. Reopen it from Projects, then try again.",
      values,
    };
  }

  const parsed = projectInputSchema.safeParse(values);

  if (!parsed.success) {
    return invalidState(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await updateProject(
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    projectId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");

  redirect(`/dashboard/projects/${projectId}`);
}

export async function archiveProjectAction(
  _previousState: ArchiveProjectState,
  formData: FormData,
): Promise<ArchiveProjectState> {
  const projectId = readProjectId(formData);

  if (!projectId) {
    return {
      status: "error",
      message: "We couldn't identify the project. Reopen it from Projects, then try again.",
    };
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await archiveProject(
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    projectId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");

  redirect("/dashboard/projects");
}
