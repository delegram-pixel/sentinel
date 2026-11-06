"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  EvidenceMetadataFormField,
  EvidenceMetadataFormState,
  Phase6StatusFormState,
  RedactionReviewFormState,
} from "@/components/research/phase6-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  deleteEvidence,
  linkEvidence,
  removeEvidenceLink,
  reviewEvidenceRedaction,
  updateEvidenceMetadata,
} from "@/modules/evidence/application/evidence-service";
import {
  evidenceLinkSchema,
  evidenceMetadataUpdateSchema,
  redactionReviewSchema,
} from "@/modules/evidence/domain/evidence";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";

const METADATA_FIELDS: readonly EvidenceMetadataFormField[] = [
  "title",
  "description",
  "evidenceType",
  "source",
];

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
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

function revalidateEvidence(evidenceId: string, investigationId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/evidence");
  revalidatePath(`/dashboard/evidence/${evidenceId}`);
  revalidatePath(`/dashboard/investigations/${investigationId}`);
}

export async function updateEvidenceMetadataAction(
  _previousState: EvidenceMetadataFormState,
  formData: FormData,
): Promise<EvidenceMetadataFormState> {
  const evidenceId = stringValue(formData, "evidenceId");
  const investigationId = stringValue(formData, "investigationId");
  const values = {
    title: stringValue(formData, "title"),
    description: stringValue(formData, "description"),
    evidenceType: stringValue(formData, "evidenceType"),
    source: stringValue(formData, "source"),
  };

  if (!evidenceId) {
    return { status: "error", message: "The evidence identifier is missing.", values };
  }

  const parsed = evidenceMetadataUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error.issues, METADATA_FIELDS),
      values,
    };
  }

  const session = await getSessionContext();
  const result = await updateEvidenceMetadata(
    new PrismaEvidenceStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    evidenceId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateEvidence(evidenceId, investigationId);

  redirect(`/dashboard/evidence/${evidenceId}`);
}

export async function reviewEvidenceAction(
  _previousState: RedactionReviewFormState,
  formData: FormData,
): Promise<RedactionReviewFormState> {
  const evidenceId = stringValue(formData, "evidenceId");
  const investigationId = stringValue(formData, "investigationId");
  const decision = stringValue(formData, "decision");
  const note = stringValue(formData, "note");

  if (!evidenceId) {
    return { status: "error", message: "The evidence identifier is missing." };
  }

  const parsed = redactionReviewSchema.safeParse({ decision, note });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Choose a redaction decision.",
    };
  }

  const session = await getSessionContext();
  const result = await reviewEvidenceRedaction(
    new PrismaEvidenceStore(getDb()),
    createEvidenceStorage(),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    evidenceId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateEvidence(evidenceId, investigationId);

  redirect(`/dashboard/evidence/${evidenceId}`);
}

export async function deleteEvidenceAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const evidenceId = stringValue(formData, "evidenceId");
  const investigationId = stringValue(formData, "investigationId");

  if (!evidenceId) {
    return { status: "error", message: "The evidence identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await deleteEvidence(
    new PrismaEvidenceStore(getDb()),
    createEvidenceStorage(),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    evidenceId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateEvidence(evidenceId, investigationId);

  redirect("/dashboard/evidence");
}

export async function linkEvidenceAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const evidenceId = stringValue(formData, "evidenceId");
  const investigationId = stringValue(formData, "investigationId");
  const findingId = stringValue(formData, "findingId");
  const relationshipType = stringValue(formData, "relationshipType");

  if (!evidenceId || !findingId) {
    return { status: "error", message: "Choose a finding and relationship." };
  }

  const parsed = evidenceLinkSchema.safeParse({
    evidenceId,
    findingId,
    relationshipType,
  });

  if (!parsed.success) {
    return { status: "error", message: "Choose a finding and relationship." };
  }

  const session = await getSessionContext();
  const result = await linkEvidence(
    new PrismaEvidenceStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateEvidence(evidenceId, investigationId);
  revalidatePath(`/dashboard/findings/${findingId}`);

  redirect(`/dashboard/evidence/${evidenceId}`);
}

export async function removeEvidenceLinkAction(
  _previousState: Phase6StatusFormState,
  formData: FormData,
): Promise<Phase6StatusFormState> {
  const evidenceId = stringValue(formData, "evidenceId");
  const investigationId = stringValue(formData, "investigationId");
  const linkId = stringValue(formData, "linkId");

  if (!linkId) {
    return { status: "error", message: "The evidence link is missing." };
  }

  const session = await getSessionContext();
  const result = await removeEvidenceLink(
    new PrismaEvidenceStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    linkId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateEvidence(evidenceId, investigationId);

  redirect(`/dashboard/evidence/${evidenceId}`);
}
