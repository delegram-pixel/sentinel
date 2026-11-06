import { afterAll, describe, expect, it } from "vitest";

import {
  changeHypothesisStatus,
  changeInvestigationStatus,
  createHypothesis,
  createInvestigation,
  createObservation,
  createSessionSummary,
  getInvestigation,
  listInvestigations,
  updateHypothesis,
  updateInvestigation,
  updateObservation,
} from "@/modules/research/application/investigation-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

function investigationInput(overrides: Record<string, unknown> = {}) {
  return {
    targetId: "",
    title: "IDOR in invoice export",
    description: "The export endpoint may ignore ownership checks.",
    objective: "Determine whether another tenant's invoice can be exported.",
    category: "Access control",
    ...overrides,
  };
}

function observationInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Export accepts an arbitrary invoice id",
    description: "Replacing the id returns a 200 with another invoice body.",
    observationType: "APPLICATION_BEHAVIOUR",
    source: "Manual request in the practice lab",
    confidenceLabel: "MEDIUM",
    ...overrides,
  };
}

function hypothesisInput(observationId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: "Export endpoint is vulnerable to IDOR",
    description: "The endpoint appears to resolve invoices by supplied id only.",
    vulnerabilityCategory: "IDOR",
    missingInformation: "Confirm the response belongs to a different tenant.",
    observationLinks: [{ observationId, relationshipType: "SUPPORTS" }],
    ...overrides,
  };
}

function summaryInput(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Mapped the export flow and captured the first ownership signal.",
    completedWork: ["Captured the export request", "Compared two tenant ids"],
    rejectedHypotheses: ["Export is disabled for free accounts"],
    unresolvedQuestions: ["Does the response vary by tenant header?"],
    nextActions: ["Repeat with a second invoice", "Capture the response hash"],
    ...overrides,
  };
}

describe("investigation service", () => {
  it("creates an investigation against a registered target without requiring an active scope", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      await tx.scopeVersion.update({
        where: { id: tenancy.scope.id },
        data: { status: "REVOKED" },
      });

      const created = await createInvestigation(
        store,
        store,
        store,
        actor,
        tenancy.project.id,
        investigationInput({ targetId: tenancy.target.id }),
      );

      if (!created.ok) {
        throw new Error("Expected the investigation to be created.");
      }

      const investigation = await getInvestigation(store, tenancy.workspace.id, created.value.id);
      const audit = await tx.auditLog.findFirst({
        where: { entityId: created.value.id, action: "INVESTIGATION_CREATED" },
      });

      return { created, investigation, audit };
    });

    expect(result.created.ok).toBe(true);
    expect(result.investigation).toMatchObject({
      title: "IDOR in invoice export",
      status: "DRAFT",
      targetId: expect.any(String),
      observationCount: 0,
      hypothesisCount: 0,
      summaryCount: 0,
    });
    expect(result.audit?.newValue).toMatchObject({
      title: "IDOR in invoice export",
      status: "DRAFT",
    });
  });

  it("enforces investigation status transitions and timestamp rules", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const created = await createInvestigation(
        store,
        store,
        store,
        actor,
        tenancy.project.id,
        investigationInput({ targetId: tenancy.target.id }),
      );

      if (!created.ok) {
        throw new Error("Expected the investigation to be created.");
      }

      const id = created.value.id;
      const startedAt = new Date("2026-11-01T09:00:00.000Z");
      const resumedAt = new Date("2026-11-02T09:00:00.000Z");
      const completedAt = new Date("2026-11-03T09:00:00.000Z");

      const invalid = await changeInvestigationStatus(
        store,
        store,
        actor,
        id,
        "COMPLETED",
        startedAt,
      );
      const active = await changeInvestigationStatus(store, store, actor, id, "ACTIVE", startedAt);
      const paused = await changeInvestigationStatus(store, store, actor, id, "PAUSED", resumedAt);
      const resumed = await changeInvestigationStatus(store, store, actor, id, "ACTIVE", resumedAt);
      const completed = await changeInvestigationStatus(
        store,
        store,
        actor,
        id,
        "COMPLETED",
        completedAt,
      );
      const investigation = await getInvestigation(store, tenancy.workspace.id, id);

      return { invalid, active, paused, resumed, completed, investigation };
    });

    expect(result.invalid).toMatchObject({ ok: false, code: "INVALID_STATUS_TRANSITION" });
    expect(result.active.ok).toBe(true);
    expect(result.paused.ok).toBe(true);
    expect(result.resumed.ok).toBe(true);
    expect(result.completed.ok).toBe(true);
    expect(result.investigation).toMatchObject({
      status: "COMPLETED",
      startedAt: new Date("2026-11-01T09:00:00.000Z"),
      completedAt: new Date("2026-11-03T09:00:00.000Z"),
    });
  });

  it("records observations, links them to hypotheses, and advances hypothesis status", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const createdObservation = await createObservation(
        store,
        store,
        actor,
        tenancy.investigation.id,
        observationInput(),
      );

      if (!createdObservation.ok) {
        throw new Error("Expected the observation to be created.");
      }

      const updatedObservation = await updateObservation(
        store,
        store,
        actor,
        tenancy.investigation.id,
        createdObservation.value.id,
        observationInput({ confidenceLabel: "HIGH" }),
      );

      const createdHypothesis = await createHypothesis(
        store,
        store,
        actor,
        tenancy.investigation.id,
        hypothesisInput(createdObservation.value.id),
      );

      if (!createdHypothesis.ok) {
        throw new Error("Expected the hypothesis to be created.");
      }

      const observed = await changeHypothesisStatus(
        store,
        store,
        actor,
        tenancy.investigation.id,
        createdHypothesis.value.id,
        "OBSERVED",
      );
      const needsValidation = await changeHypothesisStatus(
        store,
        store,
        actor,
        tenancy.investigation.id,
        createdHypothesis.value.id,
        "NEEDS_VALIDATION",
      );
      const confirmed = await changeHypothesisStatus(
        store,
        store,
        actor,
        tenancy.investigation.id,
        createdHypothesis.value.id,
        "CONFIRMED",
      );
      const renamed = await updateHypothesis(
        store,
        store,
        actor,
        tenancy.investigation.id,
        createdHypothesis.value.id,
        {
          title: "Export endpoint leaks cross-tenant invoices",
          description: "Confirmed with two tenants.",
          vulnerabilityCategory: "IDOR",
          missingInformation: "",
        },
      );

      const investigation = await getInvestigation(
        store,
        tenancy.workspace.id,
        tenancy.investigation.id,
      );

      return {
        updatedObservation,
        observed,
        needsValidation,
        confirmed,
        renamed,
        investigation,
      };
    });

    expect(result.updatedObservation).toMatchObject({
      ok: true,
      value: { id: expect.any(String) },
    });
    expect(result.investigation?.observations[0]).toMatchObject({
      confidenceLabel: "HIGH",
    });
    expect(result.investigation?.hypotheses[0]).toMatchObject({
      title: "Export endpoint leaks cross-tenant invoices",
      status: "CONFIRMED",
      observationLinks: [
        expect.objectContaining({
          relationshipType: "SUPPORTS",
          observation: expect.objectContaining({ title: "Export accepts an arbitrary invoice id" }),
        }),
      ],
    });
    expect(result.observed.ok).toBe(true);
    expect(result.needsValidation.ok).toBe(true);
    expect(result.confirmed.ok).toBe(true);
    expect(result.renamed.ok).toBe(true);
  });

  it("records manual session summaries with structured continuity notes", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const created = await createSessionSummary(
        store,
        store,
        actor,
        tenancy.investigation.id,
        summaryInput(),
      );

      if (!created.ok) {
        throw new Error("Expected the summary to be created.");
      }

      const investigation = await getInvestigation(
        store,
        tenancy.workspace.id,
        tenancy.investigation.id,
      );
      const audit = await tx.auditLog.findFirst({
        where: { entityId: created.value.id, action: "SESSION_SUMMARY_CREATED" },
      });

      return { created, investigation, audit };
    });

    expect(result.created.ok).toBe(true);
    expect(result.investigation?.summaries[0]).toMatchObject({
      summary: "Mapped the export flow and captured the first ownership signal.",
      completedWork: ["Captured the export request", "Compared two tenant ids"],
      rejectedHypotheses: ["Export is disabled for free accounts"],
      unresolvedQuestions: ["Does the response vary by tenant header?"],
      nextActions: ["Repeat with a second invoice", "Capture the response hash"],
      generatedByType: "HUMAN",
    });
    expect(result.audit?.newValue).toMatchObject({ generatedByType: "HUMAN" });
  });

  it("isolates investigations and their child records between workspaces", async () => {
    const result = await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: own.user.id, workspaceId: own.workspace.id };

      const lookup = await getInvestigation(store, own.workspace.id, other.investigation.id);
      const update = await updateInvestigation(store, store, actor, other.investigation.id, {
        title: "Hijacked",
        description: "",
        objective: "",
        category: "",
      });
      const observation = await createObservation(
        store,
        store,
        actor,
        other.investigation.id,
        observationInput(),
      );
      const hypotheses = await createHypothesis(
        store,
        store,
        actor,
        other.investigation.id,
        hypothesisInput("00000000-0000-0000-0000-000000000000"),
      );
      const ownList = await listInvestigations(store, own.workspace.id);
      const otherList = await listInvestigations(store, other.workspace.id);

      return { lookup, update, observation, hypotheses, ownList, otherList };
    });

    expect(result.lookup).toBeNull();
    expect(result.update).toMatchObject({ ok: false, code: "INVESTIGATION_NOT_FOUND" });
    expect(result.observation).toMatchObject({
      ok: false,
      code: "INVESTIGATION_NOT_FOUND",
    });
    expect(result.hypotheses).toMatchObject({
      ok: false,
      code: "INVESTIGATION_NOT_FOUND",
    });
    expect(result.ownList.map((investigation) => investigation.id)).not.toContain(
      result.otherList[0]?.id,
    );
  });

  it("rejects changes to archived projects and archived investigations", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaResearchStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };

      const updateInput = {
        title: "Updated title",
        description: "",
        objective: "",
        category: "",
      };

      await tx.project.update({
        where: { id: tenancy.project.id },
        data: { status: "ARCHIVED", archivedAt: tenancy.now },
      });

      const archivedProjectUpdate = await updateInvestigation(
        store,
        store,
        actor,
        tenancy.investigation.id,
        updateInput,
      );
      const archivedProjectObservation = await createObservation(
        store,
        store,
        actor,
        tenancy.investigation.id,
        observationInput(),
      );

      await tx.project.update({
        where: { id: tenancy.project.id },
        data: { status: "ACTIVE", archivedAt: null },
      });
      await tx.investigation.update({
        where: { id: tenancy.investigation.id },
        data: { status: "ARCHIVED" },
      });

      const archivedInvestigationUpdate = await updateInvestigation(
        store,
        store,
        actor,
        tenancy.investigation.id,
        updateInput,
      );

      return {
        archivedProjectUpdate,
        archivedProjectObservation,
        archivedInvestigationUpdate,
      };
    });

    expect(result.archivedProjectUpdate).toMatchObject({ ok: false, code: "PROJECT_ARCHIVED" });
    expect(result.archivedProjectObservation).toMatchObject({
      ok: false,
      code: "PROJECT_ARCHIVED",
    });
    expect(result.archivedInvestigationUpdate).toMatchObject({
      ok: false,
      code: "INVESTIGATION_ARCHIVED",
    });
  });
});
