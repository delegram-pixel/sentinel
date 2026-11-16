import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { MockAIProvider } from "@/modules/ai/application/mock-provider";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { processNextResearchJob } from "@/modules/tasks/infrastructure/worker";
import { executeBountyImport } from "@/modules/bounty/infrastructure/bounty-import-worker";
import { saveBountyProject } from "@/modules/bounty/infrastructure/save-bounty-project";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();
afterAll(() => client.$disconnect());
const source = {
  programUrl: "https://example.com/bounty",
  details:
    "Example Bounty. Allowed: app.example.com. Excluded: admin.example.com. No denial of service.",
  readUrl: false,
};
const extracted = {
  name: "Example Bounty",
  description: "Example research",
  programName: "Example",
  authorizationNotes: "No denial of service.",
  effectiveFrom: null,
  effectiveUntil: null,
  assets: [
    {
      assetIdentifier: "app.example.com",
      assetType: "DOMAIN",
      matchType: "EXACT",
      effect: "ALLOWED",
      notes: "",
      sourceQuote: "Allowed: app.example.com.",
    },
    {
      assetIdentifier: "admin.example.com",
      assetType: "DOMAIN",
      matchType: "EXACT",
      effect: "EXCLUDED",
      notes: "",
      sourceQuote: "Excluded: admin.example.com.",
    },
  ],
  warnings: [],
};
function review(importJobId: string) {
  return {
    importJobId,
    operationKey: randomUUID(),
    project: {
      name: extracted.name,
      description: extracted.description,
      projectType: "BUG_BOUNTY",
    },
    programName: extracted.programName,
    programUrl: source.programUrl,
    authorizationSource: source.programUrl,
    authorizationNotes: extracted.authorizationNotes,
    effectiveFrom: "",
    effectiveUntil: "",
    permittedActivities: ["AI_ANALYZE_SUPPLIED_CONTENT"],
    assets: extracted.assets,
    acknowledged: true,
  };
}

describe("bounty import", () => {
  it("processes queued extraction and saves reviewed targets as unverified with incomplete draft scopes", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };
      const jobs = new PrismaJobStore(tx);
      const queued = await jobs.enqueue(actor, "BOUNTY_IMPORT", randomUUID(), source);
      await processNextResearchJob(tx, {
        store: new PrismaAIStore(tx),
        provider: new MockAIProvider({ outputs: { RECON_ANALYSIS: extracted } }),
      });
      const job = await jobs.find(actor.workspaceId, queued.id);
      expect(job?.status).toBe("SUCCEEDED");
      const input = review(queued.id);
      const saved = await saveBountyProject(tx, actor, input);
      const repeated = await saveBountyProject(tx, actor, input);
      const project = await tx.project.findUniqueOrThrow({
        where: { id: saved.id },
        include: { targets: { include: { scopeVersions: { include: { assets: true } } } } },
      });
      const audits = await tx.auditLog.findMany({
        where: { entityId: { in: [saved.id, ...project.targets.map((target) => target.id)] } },
      });
      return { project, audits, repeated, saved };
    });
    expect(result.repeated).toEqual(result.saved);
    expect(result.project.targets).toHaveLength(1);
    expect(result.project.targets[0]).toMatchObject({
      authorizationStatus: "UNVERIFIED",
      authorizationDate: null,
      assetIdentifier: "app.example.com",
    });
    expect(result.project.targets[0]?.scopeVersions[0]).toMatchObject({
      status: "DRAFT",
      effectiveFrom: null,
      effectiveUntil: null,
      approvedBy: null,
    });
    expect(
      result.project.targets[0]?.scopeVersions[0]?.assets.map((asset) => asset.effect).sort(),
    ).toEqual(["ALLOWED", "EXCLUDED"]);
    expect(result.audits.map((audit) => audit.action)).toContain("PROJECT_CREATED");
  });
  it("rejects imports from another workspace, unreviewed data and duplicate assets without partial projects", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const other = await createTenancy(tx);
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };
      const job = await tx.backgroundJob.create({
        data: {
          requestedBy: other.user.id,
          workspaceId: other.workspace.id,
          kind: "BOUNTY_IMPORT",
          operationKey: randomUUID(),
          payload: source,
          status: "SUCCEEDED",
          result: { draft: extracted },
        },
      });
      const before = await tx.project.count();
      await expect(saveBountyProject(tx, actor, review(job.id))).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        saveBountyProject(tx, actor, { ...review(job.id), acknowledged: false }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      await expect(
        saveBountyProject(tx, actor, {
          ...review(job.id),
          assets: [extracted.assets[0], extracted.assets[0]],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      expect(await tx.project.count()).toBe(before);
    });
  });
  it("does not call the provider after a cancelled or uncertain import", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };
      const jobs = new PrismaJobStore(tx);
      await jobs.enqueue(actor, "BOUNTY_IMPORT", randomUUID(), source);
      const job = (await jobs.claim())!;
      let calls = 0;
      const deps = {
        store: new PrismaAIStore(tx),
        provider: {
          name: "MOCK",
          async generate() {
            calls++;
            throw new Error("Should not run");
          },
        },
      };
      await jobs.cancel(actor, job.id);
      await expect(executeBountyImport(tx, deps, job)).rejects.toMatchObject({
        code: "JOB_LEASE_LOST",
      });
      await expect(
        executeBountyImport(tx, deps, { ...job, result: { started: true } }),
      ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
      expect(calls).toBe(0);
    });
  });
});
