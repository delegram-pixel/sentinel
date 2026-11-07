"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  FindingFormField,
  FindingFormState,
  FindingFormValues,
  Phase6StatusFormState,
  ReviewFormField,
  ReviewFormState,
  ReviewFormValues,
  SeverityFormField,
  SeverityFormState,
} from "@/components/research/phase6-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  assessFindingSeverity,
  changeFindingStatus,
  confirmDuplicateFinding,
  createFinding,
  linkEvidenceToFinding,
  removeEvidenceLink,
  reviewFinding,
  updateFinding,
} from "@/modules/findings/application/finding-service";
import {
  findingInputSchema,
  findingUpdateSchema,
  findingVerificationReviewSchema,
  severityAssessmentSchema,
} from "@/modules/findings/domain/finding";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";

const FINDING_FIELDS: readonly FindingFormField[] = [
  "title",
  "description",
  "vulnerabilityCategory",
  "hypothesisId",
  "affectedAsset",
  "affectedAssetType",
  "impact",
  "remediation",
];

const SEVERITY_FIELDS: readonly SeverityFormField[] = [
  "severity",
  "severityRationale",
  "affectedAsset",
  "affectedAssetType",
];

const REVIEW_FIELDS: readonly ReviewFormField[] = [
  "conclusion",
  "supportingEvidence",
  "contradictingEvidence",
  "missingEvidence",
  "impactAssessment",
  "reasoningSummary",
  "resolutionReason",
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

function readFindingValues(formData: FormData): FindingFormValues {
  return {
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    vulnerabilityCategory: stringValue(formData, "vulnerabilityCategory"),
    hypothesisId: stringValue(formData, "hypothesisId"),
    affectedAsset: stringValue(formData, "affectedAsset"),
    affectedAssetType: stringValue(formData, "affectedAssetType"),
    impact: stringValue(formData, "impact"),
    remediation: stringValue(formData, "remediation"),
  };
}

function readReviewValues(formData: FormData): ReviewFormValues {
  return {
    conclusion: stringValue(formData, "conclusion"),
    supportingEvidence: stringValue(formData, "supportingEvidence"),
    contradictingEvidence: stringValue(formData, "contradictingEvidence"),
    missingEvidence: stringValue(formData, "missingEvidence"),
    impactAssessment: stringValue(formData, "impactAssessment"),
    reasoningSummary: stringValue(formData, "reasoningSummary"),
    resolutionReason: stringValue(formData, "resolutionReason"),
  };
}

function findingInvalid(
  values: FindingFormValues,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): FindingFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(issues, FINDING_FIELDS),
    values,
  };
}

function findingPayload(values: FindingFormValues) {
  return {
    title: values.title,
    description: values.description,
    vulnerabilityCategory: values.vulnerabilityCategory,
    hypothesisId: values.hypothesisId,
    affectedAsset: values.affectedAsset,
    affectedAssetType: values.affectedAssetType || undefined,
    impact: values.impact,
    remediation: values.remediation,
  };
}

function revalidateFinding(findingId: string, investigationId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/findings");
  revalidatePath(`/dashboard/findings/${findingId}`);
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  revalidatePath("/dashboard/evidence");
}

export async function createFindingAction(
  _previousState: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const values = readFindingValues(formData);

  if (!investigationId) {
    return { status: "error", message: "The investigation identifier is missing.", values };
  }

  const parsed = findingInputSchema.safeParse(findingPayload(values));

  if (!parsed.success) {
    return findingInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const result = await createFinding(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    investigationId,
    findingPayload(values),
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateFinding(result.value.id, investigationId);

  redirect(`/dashboard/findings/${result.value.id}`);
}

export async function updateFindingAction(
  _previousState: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const values = readFindingValues(formData);

  if (!findingId) {
    return { status: "error", message: "The finding identifier is missing.", values };
  }

  const parsed = findingUpdateSchema.safeParse(findingPayload(values));

  if (!parsed.success) {
    return findingInvalid(values, parsed.error.issues);
  }

  const session = await getSessionContext();
  const result = await updateFinding(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    findingId,
    findingPayload(values),
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}

export async function assessSeverityAction(
  _previousState: SeverityFormState,
  formData: FormData,
): Promise<SeverityFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const values = {
    severity: stringValue(formData, "severity"),
    severityRationale: stringValue(formData, "severityRationale"),
    affectedAsset: stringValue(formData, "affectedAsset"),
    affectedAssetType: stringValue(formData, "affectedAssetType"),
  };

  if (!findingId) {
    return { status: "error", message: "The finding identifier is missing.", values };
  }

  const parsed = severityAssessmentSchema.safeParse({
    ...values,
    affectedAssetType: values.affectedAssetType || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error.issues, SEVERITY_FIELDS),
      values,
    };
  }

  const session = await getSessionContext();
  const result = await assessFindingSeverity(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    findingId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}

export async function changeFindingStatusAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const status = stringValue(formData, "status");
  const resolutionReason = stringValue(formData, "resolutionReason");

  if (!findingId) {
    return { status: "error", message: "The finding identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await changeFindingStatus(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    findingId,
    {
      status,
      resolutionReason: resolutionReason || undefined,
      rationale: stringValue(formData, "rationale") || undefined,
    },
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}

export async function reviewFindingAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const values = readReviewValues(formData);

  if (!findingId) {
    return { status: "error", message: "The finding identifier is missing.", values };
  }

  const payload = {
    conclusion: values.conclusion,
    supportingEvidence: splitLines(values.supportingEvidence),
    contradictingEvidence: splitLines(values.contradictingEvidence),
    missingEvidence: splitLines(values.missingEvidence),
    impactAssessment: values.impactAssessment,
    reasoningSummary: values.reasoningSummary,
    resolutionReason: values.resolutionReason || undefined,
  };
  const parsed = findingVerificationReviewSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error.issues, REVIEW_FIELDS),
      values,
    };
  }

  const session = await getSessionContext();
  const result = await reviewFinding(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    findingId,
    payload,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}

export async function confirmDuplicateAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const canonicalFindingId = stringValue(formData, "canonicalFindingId");

  if (!findingId || !canonicalFindingId) {
    return { status: "error", message: "Choose the canonical finding." };
  }

  const session = await getSessionContext();
  const result = await confirmDuplicateFinding(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    findingId,
    { canonicalFindingId },
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}

export async function linkEvidenceAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const evidenceId = stringValue(formData, "evidenceId");
  const relationshipType = stringValue(formData, "relationshipType");

  if (!findingId || !evidenceId) {
    return { status: "error", message: "Choose approved evidence." };
  }

  const session = await getSessionContext();
  const result = await linkEvidenceToFinding(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    { findingId, evidenceId, relationshipType },
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}

export async function removeFindingEvidenceLinkAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const findingId = stringValue(formData, "findingId");
  const investigationId = stringValue(formData, "investigationId");
  const linkId = stringValue(formData, "linkId");

  if (!linkId) {
    return { status: "error", message: "The evidence link is missing." };
  }

  const session = await getSessionContext();
  const result = await removeEvidenceLink(
    new PrismaFindingStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    linkId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateFinding(findingId, investigationId);

  redirect(`/dashboard/findings/${findingId}`);
}
