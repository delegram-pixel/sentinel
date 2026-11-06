import { failure, type DomainResult } from "@/modules/shared/domain/result";

import {
  canEditProject,
  projectInputSchema,
  slugifyProjectName,
  type ProjectInput,
} from "../domain/project";
import type { ProjectDetail, ProjectListRow, ProjectLookup, ProjectStore } from "./ports";

type Actor = {
  userId: string;
  workspaceId: string;
};

const MAX_SLUG_ATTEMPTS = 25;

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the project details and try again.";
}

async function uniqueSlug(store: ProjectStore, workspaceId: string, name: string): Promise<string> {
  const base = slugifyProjectName(name);

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;

    if (!(await store.projectSlugExists(workspaceId, candidate))) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

export function listProjects(store: ProjectStore, workspaceId: string): Promise<ProjectListRow[]> {
  return store.listProjects(workspaceId);
}

export function getProject(
  store: ProjectStore,
  workspaceId: string,
  projectId: string,
): Promise<ProjectDetail | null> {
  return store.findProject(workspaceId, projectId);
}

export function getProjectLookup(
  store: ProjectStore,
  workspaceId: string,
  projectId: string,
): Promise<ProjectLookup | null> {
  return store.findProjectLookup(workspaceId, projectId);
}

export async function createProject(
  store: ProjectStore,
  actor: Actor,
  rawInput: unknown,
): Promise<DomainResult<{ id: string; slug: string }>> {
  const parsed = projectInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const input: ProjectInput = parsed.data;
  const slug = await uniqueSlug(store, actor.workspaceId, input.name);

  const project = await store.createProject(
    {
      workspaceId: actor.workspaceId,
      ownerId: actor.userId,
      name: input.name,
      slug,
      description: input.description,
      projectType: input.projectType,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "PROJECT_CREATED",
      entityType: "Project",
      newValue: { name: input.name, slug, projectType: input.projectType },
    },
  );

  return { ok: true, value: { id: project.id, slug: project.slug } };
}

export async function updateProject(
  store: ProjectStore,
  actor: Actor,
  projectId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = projectInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const existing = await store.findProject(actor.workspaceId, projectId);

  if (!existing) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  if (!canEditProject(existing.status)) {
    return failure("PROJECT_ARCHIVED", "An archived project cannot be edited.");
  }

  const updated = await store.updateProject(
    actor.workspaceId,
    projectId,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      projectType: parsed.data.projectType,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "PROJECT_UPDATED",
      entityType: "Project",
      previousValue: {
        name: existing.name,
        description: existing.description,
        projectType: existing.projectType,
      },
      newValue: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        projectType: parsed.data.projectType,
      },
    },
  );

  if (!updated) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  return { ok: true, value: { id: updated.id } };
}

export async function archiveProject(
  store: ProjectStore,
  actor: Actor,
  projectId: string,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const existing = await store.findProject(actor.workspaceId, projectId);

  if (!existing) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  if (existing.status === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "That project is already archived.");
  }

  const archived = await store.archiveProject(actor.workspaceId, projectId, now, {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    action: "PROJECT_ARCHIVED",
    entityType: "Project",
    previousValue: { status: existing.status },
    newValue: { status: "ARCHIVED", archivedAt: now.toISOString() },
  });

  if (!archived) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  return { ok: true, value: { id: archived.id } };
}
