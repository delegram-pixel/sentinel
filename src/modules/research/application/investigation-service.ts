import { transitionHypothesis } from "@/modules/hypotheses/domain/hypothesis-status";
import { failure, type DomainResult } from "@/modules/shared/domain/result";

import {
  canEditInvestigation,
  canTransitionInvestigation,
  hypothesisInputSchema,
  hypothesisStatusSchema,
  hypothesisUpdateSchema,
  investigationInputSchema,
  investigationStatusSchema,
  investigationUpdateSchema,
  observationInputSchema,
  sessionSummaryInputSchema,
} from "../domain/investigation";
import type {
  HypothesisRow,
  InvestigationDetail,
  InvestigationListRow,
  InvestigationStore,
  ObservationRow,
  ProjectStore,
  SessionSummaryRow,
  TargetStore,
} from "./ports";

type Actor = {
  userId: string;
  workspaceId: string;
};

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the investigation details and try again.";
}

async function loadEditableInvestigation(
  store: InvestigationStore,
  projectStore: ProjectStore,
  workspaceId: string,
  investigationId: string,
): Promise<DomainResult<InvestigationDetail>> {
  const investigation = await store.findInvestigation(workspaceId, investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  const project = await projectStore.findProjectLookup(workspaceId, investigation.projectId);

  if (!project) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  if (project.status === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "Investigations in an archived project cannot be changed.");
  }

  if (!canEditInvestigation(investigation.status)) {
    return failure("INVESTIGATION_ARCHIVED", "An archived investigation cannot be changed.");
  }

  return { ok: true, value: investigation };
}

export function listInvestigations(
  store: InvestigationStore,
  workspaceId: string,
  projectId?: string,
): Promise<InvestigationListRow[]> {
  return store.listInvestigations(workspaceId, projectId);
}

export function getInvestigation(
  store: InvestigationStore,
  workspaceId: string,
  investigationId: string,
): Promise<InvestigationDetail | null> {
  return store.findInvestigation(workspaceId, investigationId);
}

export async function createInvestigation(
  store: InvestigationStore,
  projectStore: ProjectStore,
  targetStore: TargetStore,
  actor: Actor,
  projectId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = investigationInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const project = await projectStore.findProjectLookup(actor.workspaceId, projectId);

  if (!project) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  if (project.status === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "Investigations cannot be added to an archived project.");
  }

  const target = await targetStore.findTargetLookup(actor.workspaceId, parsed.data.targetId);

  if (!target || target.projectId !== projectId) {
    return failure("TARGET_NOT_FOUND", "That target does not exist in this project.");
  }

  const investigation = await store.createInvestigation(
    {
      workspaceId: actor.workspaceId,
      projectId,
      targetId: parsed.data.targetId,
      title: parsed.data.title,
      description: parsed.data.description,
      objective: parsed.data.objective,
      category: parsed.data.category,
      createdBy: actor.userId,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "INVESTIGATION_CREATED",
      entityType: "Investigation",
      newValue: {
        projectId,
        targetId: parsed.data.targetId,
        title: parsed.data.title,
        status: "DRAFT",
      },
    },
  );

  return { ok: true, value: { id: investigation.id } };
}

export async function updateInvestigation(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = investigationUpdateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const existing = loaded.value;

  const updated = await store.updateInvestigation(
    actor.workspaceId,
    investigationId,
    {
      title: parsed.data.title,
      description: parsed.data.description,
      objective: parsed.data.objective,
      category: parsed.data.category,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "INVESTIGATION_UPDATED",
      entityType: "Investigation",
      previousValue: {
        title: existing.title,
        description: existing.description,
        objective: existing.objective,
        category: existing.category,
      },
      newValue: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        objective: parsed.data.objective ?? null,
        category: parsed.data.category ?? null,
      },
    },
  );

  if (!updated) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function changeInvestigationStatus(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  rawStatus: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = investigationStatusSchema.safeParse(rawStatus);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", "Choose a valid investigation status.");
  }

  const existing = await store.findInvestigation(actor.workspaceId, investigationId);

  if (!existing) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  const project = await projectStore.findProjectLookup(actor.workspaceId, existing.projectId);

  if (!project) {
    return failure("PROJECT_NOT_FOUND", "That project does not exist in this workspace.");
  }

  if (project.status === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "Investigations in an archived project cannot be changed.");
  }

  if (existing.status === "ARCHIVED") {
    return failure("INVESTIGATION_ARCHIVED", "An archived investigation cannot be changed.");
  }

  if (!canTransitionInvestigation(existing.status, parsed.data)) {
    return failure(
      "INVALID_STATUS_TRANSITION",
      `An investigation cannot move from ${existing.status} to ${parsed.data}.`,
    );
  }

  const updated = await store.changeInvestigationStatus(
    actor.workspaceId,
    investigationId,
    parsed.data,
    now,
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "INVESTIGATION_STATUS_CHANGED",
      entityType: "Investigation",
      previousValue: { status: existing.status },
      newValue: { status: parsed.data },
    },
  );

  if (!updated) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function createObservation(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = observationInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const observation = await store.createObservation(
    {
      investigationId,
      title: parsed.data.title,
      description: parsed.data.description,
      observationType: parsed.data.observationType,
      source: parsed.data.source,
      confidenceLabel: parsed.data.confidenceLabel,
      createdBy: actor.userId,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "OBSERVATION_CREATED",
      entityType: "Observation",
      newValue: {
        investigationId,
        title: parsed.data.title,
        observationType: parsed.data.observationType,
        confidenceLabel: parsed.data.confidenceLabel,
      },
    },
  );

  return { ok: true, value: { id: observation.id } };
}

export async function updateObservation(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  observationId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = observationInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const existing = loaded.value.observations.find(
    (observation) => observation.id === observationId,
  );

  if (!existing) {
    return failure(
      "OBSERVATION_NOT_FOUND",
      "That observation does not exist in this investigation.",
    );
  }

  const updated = await store.updateObservation(
    actor.workspaceId,
    investigationId,
    observationId,
    {
      title: parsed.data.title,
      description: parsed.data.description,
      observationType: parsed.data.observationType,
      source: parsed.data.source,
      confidenceLabel: parsed.data.confidenceLabel,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "OBSERVATION_UPDATED",
      entityType: "Observation",
      previousValue: {
        title: existing.title,
        observationType: existing.observationType,
        confidenceLabel: existing.confidenceLabel,
      },
      newValue: {
        title: parsed.data.title,
        observationType: parsed.data.observationType,
        confidenceLabel: parsed.data.confidenceLabel,
      },
    },
  );

  if (!updated) {
    return failure(
      "OBSERVATION_NOT_FOUND",
      "That observation does not exist in this investigation.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function createHypothesis(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = hypothesisInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const observationIds = new Set(loaded.value.observations.map((observation) => observation.id));

  if (
    parsed.data.observationLinks?.some((link) => !observationIds.has(link.observationId)) ??
    false
  ) {
    return failure(
      "OBSERVATION_NOT_FOUND",
      "One of the selected observations does not belong to this investigation.",
    );
  }

  const hypothesis = await store.createHypothesis(
    {
      investigationId,
      title: parsed.data.title,
      description: parsed.data.description,
      vulnerabilityCategory: parsed.data.vulnerabilityCategory,
      missingInformation: parsed.data.missingInformation,
      createdBy: actor.userId,
      observationLinks: parsed.data.observationLinks ?? [],
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "HYPOTHESIS_CREATED",
      entityType: "Hypothesis",
      newValue: {
        investigationId,
        title: parsed.data.title,
        status: "IDEA",
        observationLinkCount: parsed.data.observationLinks?.length ?? 0,
      },
    },
  );

  return { ok: true, value: { id: hypothesis.id } };
}

export async function updateHypothesis(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  hypothesisId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = hypothesisUpdateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const existing = loaded.value.hypotheses.find((hypothesis) => hypothesis.id === hypothesisId);

  if (!existing) {
    return failure("HYPOTHESIS_NOT_FOUND", "That hypothesis does not exist in this investigation.");
  }

  const updated = await store.updateHypothesis(
    actor.workspaceId,
    investigationId,
    hypothesisId,
    {
      title: parsed.data.title,
      description: parsed.data.description,
      vulnerabilityCategory: parsed.data.vulnerabilityCategory,
      missingInformation: parsed.data.missingInformation,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "HYPOTHESIS_UPDATED",
      entityType: "Hypothesis",
      previousValue: {
        title: existing.title,
        vulnerabilityCategory: existing.vulnerabilityCategory,
        missingInformation: existing.missingInformation,
      },
      newValue: {
        title: parsed.data.title,
        vulnerabilityCategory: parsed.data.vulnerabilityCategory ?? null,
        missingInformation: parsed.data.missingInformation ?? null,
      },
    },
  );

  if (!updated) {
    return failure("HYPOTHESIS_NOT_FOUND", "That hypothesis does not exist in this investigation.");
  }

  return { ok: true, value: { id: updated.id } };
}

export async function changeHypothesisStatus(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  hypothesisId: string,
  rawStatus: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = hypothesisStatusSchema.safeParse(rawStatus);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", "Choose a valid hypothesis status.");
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const existing = loaded.value.hypotheses.find((hypothesis) => hypothesis.id === hypothesisId);

  if (!existing) {
    return failure("HYPOTHESIS_NOT_FOUND", "That hypothesis does not exist in this investigation.");
  }

  const transition = transitionHypothesis(existing.status, parsed.data, "RESEARCHER");

  if (!transition.ok) {
    return failure(transition.code, transition.message);
  }

  const updated = await store.changeHypothesisStatus(
    actor.workspaceId,
    investigationId,
    hypothesisId,
    parsed.data,
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "HYPOTHESIS_STATUS_CHANGED",
      entityType: "Hypothesis",
      previousValue: { status: existing.status },
      newValue: { status: parsed.data },
    },
  );

  if (!updated) {
    return failure("HYPOTHESIS_NOT_FOUND", "That hypothesis does not exist in this investigation.");
  }

  return { ok: true, value: { id: updated.id } };
}

export async function createSessionSummary(
  store: InvestigationStore,
  projectStore: ProjectStore,
  actor: Actor,
  investigationId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = sessionSummaryInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const loaded = await loadEditableInvestigation(
    store,
    projectStore,
    actor.workspaceId,
    investigationId,
  );

  if (!loaded.ok) {
    return loaded;
  }

  const summary: SessionSummaryRow = await store.createSessionSummary(
    {
      investigationId,
      summary: parsed.data.summary,
      completedWork: parsed.data.completedWork ?? [],
      rejectedHypotheses: parsed.data.rejectedHypotheses ?? [],
      unresolvedQuestions: parsed.data.unresolvedQuestions ?? [],
      nextActions: parsed.data.nextActions ?? [],
      createdBy: actor.userId,
    },
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      action: "SESSION_SUMMARY_CREATED",
      entityType: "SessionSummary",
      newValue: {
        investigationId,
        generatedByType: "HUMAN",
        nextActionCount: parsed.data.nextActions?.length ?? 0,
      },
    },
  );

  return { ok: true, value: { id: summary.id } };
}

export function findObservation(
  investigation: InvestigationDetail,
  observationId: string,
): ObservationRow | undefined {
  return investigation.observations.find((observation) => observation.id === observationId);
}

export function findHypothesis(
  investigation: InvestigationDetail,
  hypothesisId: string,
): HypothesisRow | undefined {
  return investigation.hypotheses.find((hypothesis) => hypothesis.id === hypothesisId);
}
