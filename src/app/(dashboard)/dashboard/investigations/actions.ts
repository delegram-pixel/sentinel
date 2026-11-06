"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  HypothesisFormField,
  HypothesisFormState,
  HypothesisFormValues,
  InvestigationFormField,
  InvestigationFormState,
  InvestigationFormValues,
  ObservationFormField,
  ObservationFormState,
  ObservationFormValues,
  SessionSummaryFormField,
  SessionSummaryFormState,
  SessionSummaryFormValues,
  StatusFormState,
} from "@/components/research/investigation-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  changeHypothesisStatus,
  changeInvestigationStatus,
  createHypothesis,
  createInvestigation,
  createObservation,
  createSessionSummary,
  updateHypothesis,
  updateInvestigation,
  updateObservation,
} from "@/modules/research/application/investigation-service";
import {
  hypothesisInputSchema,
  hypothesisUpdateSchema,
  investigationInputSchema,
  investigationUpdateSchema,
  observationInputSchema,
  sessionSummaryInputSchema,
} from "@/modules/research/domain/investigation";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

const INVESTIGATION_FIELDS: readonly InvestigationFormField[] = [
  "projectId",
  "targetId",
  "title",
  "description",
  "objective",
  "category",
];

const OBSERVATION_FIELDS: readonly ObservationFormField[] = [
  "title",
  "description",
  "observationType",
  "source",
  "confidenceLabel",
];

const HYPOTHESIS_FIELDS: readonly HypothesisFormField[] = [
  "title",
  "description",
  "vulnerabilityCategory",
  "missingInformation",
];

const SUMMARY_FIELDS: readonly SessionSummaryFormField[] = [
  "summary",
  "completedWork",
  "rejectedHypotheses",
  "unresolvedQuestions",
  "nextActions",
];

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toFieldErrors<Field extends string>(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  allowed: readonly Field[],
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && allowed.includes(field as Field)) {
      const key = field as Field;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

function readInvestigationValues(formData: FormData): InvestigationFormValues {
  return {
    projectId: stringValue(formData, "projectId"),
    targetId: stringValue(formData, "targetId"),
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    objective: stringValue(formData, "objective"),
    category: stringValue(formData, "category"),
  };
}

function readObservationValues(formData: FormData): ObservationFormValues {
  return {
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    observationType: stringValue(formData, "observationType"),
    source: stringValue(formData, "source"),
    confidenceLabel: stringValue(formData, "confidenceLabel"),
  };
}

function readHypothesisValues(formData: FormData): HypothesisFormValues {
  const observationLinks: Record<string, string> = {};

  formData.forEach((value, key) => {
    if (key.startsWith("link:") && typeof value === "string" && value !== "") {
      observationLinks[key.slice("link:".length)] = value;
    }
  });

  return {
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    vulnerabilityCategory: stringValue(formData, "vulnerabilityCategory"),
    missingInformation: stringValue(formData, "missingInformation"),
    observationLinks,
  };
}

function readSummaryValues(formData: FormData): SessionSummaryFormValues {
  return {
    summary: stringValue(formData, "summary"),
    completedWork: stringValue(formData, "completedWork"),
    rejectedHypotheses: stringValue(formData, "rejectedHypotheses"),
    unresolvedQuestions: stringValue(formData, "unresolvedQuestions"),
    nextActions: stringValue(formData, "nextActions"),
  };
}

function investigationInvalid(
  values: InvestigationFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): InvestigationFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(issues, INVESTIGATION_FIELDS),
    values,
  };
}

function observationInvalid(
  values: ObservationFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): ObservationFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(issues, OBSERVATION_FIELDS),
    values,
  };
}

function hypothesisInvalid(
  values: HypothesisFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): HypothesisFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(issues, HYPOTHESIS_FIELDS),
    values,
  };
}

function summaryInvalid(
  values: SessionSummaryFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): SessionSummaryFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(issues, SUMMARY_FIELDS),
    values,
  };
}

function revalidateInvestigation(investigationId: string, projectId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/investigations");
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/investigations`);
}

function investigationPath(investigationId: string, anchor?: string): string {
  return `/dashboard/investigations/${investigationId}${anchor ? `#${anchor}` : ""}`;
}

export async function createInvestigationAction(
  _previousState: InvestigationFormState,
  formData: FormData,
): Promise<InvestigationFormState> {
  const values = readInvestigationValues(formData);

  if (!values.projectId) {
    return {
      status: "error",
      message: "Choose a project.",
      fieldErrors: { projectId: "Choose a project." },
      values,
    };
  }

  const parsed = investigationInputSchema.safeParse({
    targetId: values.targetId,
    title: values.title,
    description: values.description,
    objective: values.objective,
    category: values.category,
  });

  if (!parsed.success) {
    return investigationInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await createInvestigation(
    store,
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    values.projectId,
    {
      targetId: values.targetId,
      title: values.title,
      description: values.description,
      objective: values.objective,
      category: values.category,
    },
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(result.value.id, values.projectId);

  redirect(investigationPath(result.value.id));
}

export async function updateInvestigationAction(
  _previousState: InvestigationFormState,
  formData: FormData,
): Promise<InvestigationFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const values = readInvestigationValues(formData);

  if (!investigationId) {
    return {
      status: "error",
      message: "The investigation identifier is missing.",
      values,
    };
  }

  const parsed = investigationUpdateSchema.safeParse({
    title: values.title,
    description: values.description,
    objective: values.objective,
    category: values.category,
  });

  if (!parsed.success) {
    return investigationInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await updateInvestigation(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    {
      title: values.title,
      description: values.description,
      objective: values.objective,
      category: values.category,
    },
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(investigationId, values.projectId);

  redirect(investigationPath(investigationId));
}

export async function changeInvestigationStatusAction(
  _previousState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const status = stringValue(formData, "status");

  if (!investigationId || !projectId) {
    return { status: "error", message: "The investigation identifier is missing." };
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await changeInvestigationStatus(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    status,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId));
}

export async function createObservationAction(
  _previousState: ObservationFormState,
  formData: FormData,
): Promise<ObservationFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const values = readObservationValues(formData);

  if (!investigationId || !projectId) {
    return {
      status: "error",
      message: "The investigation identifier is missing.",
      values,
    };
  }

  const parsed = observationInputSchema.safeParse(values);

  if (!parsed.success) {
    return observationInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await createObservation(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    values,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId, "observations"));
}

export async function updateObservationAction(
  _previousState: ObservationFormState,
  formData: FormData,
): Promise<ObservationFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const observationId = stringValue(formData, "observationId");
  const values = readObservationValues(formData);

  if (!investigationId || !projectId || !observationId) {
    return {
      status: "error",
      message: "The observation identifier is missing.",
      values,
    };
  }

  const parsed = observationInputSchema.safeParse(values);

  if (!parsed.success) {
    return observationInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await updateObservation(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    observationId,
    values,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId, "observations"));
}

export async function createHypothesisAction(
  _previousState: HypothesisFormState,
  formData: FormData,
): Promise<HypothesisFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const values = readHypothesisValues(formData);

  if (!investigationId || !projectId) {
    return {
      status: "error",
      message: "The investigation identifier is missing.",
      values,
    };
  }

  const observationLinks = Object.entries(values.observationLinks).map(
    ([observationId, relationshipType]) => ({ observationId, relationshipType }),
  );

  const parsed = hypothesisInputSchema.safeParse({
    title: values.title,
    description: values.description,
    vulnerabilityCategory: values.vulnerabilityCategory,
    missingInformation: values.missingInformation,
    observationLinks,
  });

  if (!parsed.success) {
    return hypothesisInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await createHypothesis(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    {
      title: values.title,
      description: values.description,
      vulnerabilityCategory: values.vulnerabilityCategory,
      missingInformation: values.missingInformation,
      observationLinks,
    },
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId, "hypotheses"));
}

export async function updateHypothesisAction(
  _previousState: HypothesisFormState,
  formData: FormData,
): Promise<HypothesisFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const hypothesisId = stringValue(formData, "hypothesisId");
  const values = readHypothesisValues(formData);

  if (!investigationId || !projectId || !hypothesisId) {
    return {
      status: "error",
      message: "The hypothesis identifier is missing.",
      values,
    };
  }

  const parsed = hypothesisUpdateSchema.safeParse({
    title: values.title,
    description: values.description,
    vulnerabilityCategory: values.vulnerabilityCategory,
    missingInformation: values.missingInformation,
  });

  if (!parsed.success) {
    return hypothesisInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await updateHypothesis(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    hypothesisId,
    {
      title: values.title,
      description: values.description,
      vulnerabilityCategory: values.vulnerabilityCategory,
      missingInformation: values.missingInformation,
    },
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId, "hypotheses"));
}

export async function changeHypothesisStatusAction(
  _previousState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const hypothesisId = stringValue(formData, "hypothesisId");
  const status = stringValue(formData, "status");

  if (!investigationId || !projectId || !hypothesisId) {
    return { status: "error", message: "The hypothesis identifier is missing." };
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await changeHypothesisStatus(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    hypothesisId,
    status,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId, "hypotheses"));
}

export async function createSessionSummaryAction(
  _previousState: SessionSummaryFormState,
  formData: FormData,
): Promise<SessionSummaryFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const projectId = stringValue(formData, "projectId");
  const values = readSummaryValues(formData);

  if (!investigationId || !projectId) {
    return {
      status: "error",
      message: "The investigation identifier is missing.",
      values,
    };
  }

  const parsed = sessionSummaryInputSchema.safeParse({
    summary: values.summary,
    completedWork: splitLines(values.completedWork),
    rejectedHypotheses: splitLines(values.rejectedHypotheses),
    unresolvedQuestions: splitLines(values.unresolvedQuestions),
    nextActions: splitLines(values.nextActions),
  });

  if (!parsed.success) {
    return summaryInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const result = await createSessionSummary(
    store,
    store,
    { userId: session.user.id, workspaceId: session.workspace.id },
    investigationId,
    parsed.data,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  revalidateInvestigation(investigationId, projectId);

  redirect(investigationPath(investigationId, "session-summaries"));
}
