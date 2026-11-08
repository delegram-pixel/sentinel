import { afterAll, describe, expect, it } from "vitest";

import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  updateProject,
} from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

describe("project service", () => {
  it("creates a project, generates a unique slug, and records an audit event", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const first = await createProject(store, actor, {
        name: "Local Lab",
        description: "Practice target research",
        projectType: "LEARNING_LAB",
      });
      const second = await createProject(store, actor, {
        name: "Local Lab",
        description: "",
        projectType: "BUG_BOUNTY",
      });

      if (!first.ok || !second.ok) {
        throw new Error("Expected both projects to be created.");
      }

      const projects = await listProjects(store, tenancy.workspace.id);
      const audits = await tx.auditLog.findMany({
        where: { workspaceId: tenancy.workspace.id, action: "PROJECT_CREATED" },
        orderBy: { createdAt: "asc" },
      });

      return { first, second, projects, audits };
    });

    expect(result.first.value.slug).toBe("local-lab");
    expect(result.second.value.slug).toBe("local-lab-2");
    expect(result.projects).toHaveLength(3);
    expect(result.audits).toHaveLength(2);
    expect(result.audits[0]?.entityType).toBe("Project");
    expect(result.audits[0]?.newValue).toMatchObject({ name: "Local Lab" });
  });

  it("updates a project and keeps the slug stable", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const update = await updateProject(store, actor, tenancy.project.id, {
        name: "Renamed Lab",
        description: "Updated description",
        projectType: "AUTHORIZED_ASSESSMENT",
      });
      const project = await getProject(store, tenancy.workspace.id, tenancy.project.id);

      if (!project) {
        throw new Error("Expected the project to still exist.");
      }

      const audit = await tx.auditLog.findFirst({
        where: { entityId: tenancy.project.id, action: "PROJECT_UPDATED" },
      });

      return { update, project, audit };
    });

    expect(result.update.ok).toBe(true);
    expect(result.project.name).toBe("Renamed Lab");
    expect(result.project.slug).toMatch(/^local-lab-/);
    expect(result.project.projectType).toBe("AUTHORIZED_ASSESSMENT");
    expect(result.audit?.previousValue).toMatchObject({ name: "Local Lab" });
    expect(result.audit?.newValue).toMatchObject({ name: "Renamed Lab" });
  });

  it("rejects updates to an archived project", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const archived = await archiveProject(store, actor, tenancy.project.id);
      const update = await updateProject(store, actor, tenancy.project.id, {
        name: "Changed",
        description: "",
        projectType: "LEARNING_LAB",
      });

      return { archived, update };
    });

    expect(result.archived.ok).toBe(true);
    expect(result.update).toEqual({
      ok: false,
      code: "PROJECT_ARCHIVED",
      message: "This project is archived. You can revisit its history, but editing is closed.",
    });
  });

  it("archives a project once and records why it can no longer change", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const first = await archiveProject(store, actor, tenancy.project.id);
      const second = await archiveProject(store, actor, tenancy.project.id);
      const project = await getProject(store, tenancy.workspace.id, tenancy.project.id);
      const audits = await tx.auditLog.findMany({
        where: { entityId: tenancy.project.id, action: "PROJECT_ARCHIVED" },
      });

      return { first, second, project, audits };
    });

    expect(result.first.ok).toBe(true);
    expect(result.second).toMatchObject({ ok: false, code: "PROJECT_ARCHIVED" });
    expect(result.project?.status).toBe("ARCHIVED");
    expect(result.audits).toHaveLength(1);
  });

  it("uses the generated slug as a stable URL-safe identifier", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      return createProject(store, actor, {
        name: "  Café & Lab!!  ",
        description: "Unicode name",
        projectType: "INTERNAL_RESEARCH",
      });
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.slug).toBe("cafe-lab");
  });

  it("isolates projects between workspaces", async () => {
    const result = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);

      const ownProjects = await listProjects(store, own.workspace.id);
      const otherProjects = await listProjects(store, other.workspace.id);
      const foreignLookup = await getProject(store, own.workspace.id, other.project.id);
      const foreignUpdate = await updateProject(
        store,
        { userId: own.user.id, workspaceId: own.workspace.id },
        other.project.id,
        {
          name: "Hijacked",
          description: "",
          projectType: "LEARNING_LAB",
        },
      );

      return { ownProjects, otherProjects, foreignLookup, foreignUpdate };
    });

    expect(result.ownProjects.map((project) => project.id)).toContain(result.ownProjects[0]?.id);
    expect(result.ownProjects).toHaveLength(1);
    expect(result.otherProjects).toHaveLength(1);
    expect(result.ownProjects[0]?.id).not.toBe(result.otherProjects[0]?.id);
    expect(result.foreignLookup).toBeNull();
    expect(result.foreignUpdate).toMatchObject({ ok: false, code: "PROJECT_NOT_FOUND" });
  });

  it("rejects project input that fails canonical validation", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);

      return createProject(
        store,
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        { name: "A", description: "", projectType: "LEARNING_LAB" },
      );
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });
});
