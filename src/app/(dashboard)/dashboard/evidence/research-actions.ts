"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import type { ResearchFormState } from "@/components/research/research-action-form";
import {
  recordEvidenceProvenance,
  relateResearchEvidence,
  reviewEvidenceAssessment,
  reviewEvidenceReplacement,
} from "@/modules/evidence/application/research-evidence-service";
import { PrismaResearchEvidenceStore } from "@/modules/evidence/infrastructure/prisma-research-evidence-store";
async function context() {
  const s = await getSessionContext();
  return {
    store: new PrismaResearchEvidenceStore(getDb()),
    actor: { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
  };
}
export async function reviewReplacementAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await reviewEvidenceReplacement(store, actor, Object.fromEntries(form.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/evidence", "layout");
  return {
    status: "success",
    message: "Reviewed replacement recorded. The original evidence remains retained.",
  };
}
export async function recordProvenanceAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await recordEvidenceProvenance(store, actor, Object.fromEntries(form.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/evidence", "layout");
  return { status: "success", message: "Collection provenance recorded." };
}
export async function relateEvidenceResearchAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const [subjectKind, subjectId] = String(form.get("subject") ?? "").split(":");
  const result = await relateResearchEvidence(store, actor, {
    ...Object.fromEntries(form.entries()),
    subjectKind,
    subjectId,
  });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/evidence", "layout");
  return { status: "success", message: "Evidence relationship recorded." };
}
export async function reviewAssessmentAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await reviewEvidenceAssessment(store, actor, Object.fromEntries(form.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/evidence", "layout");
  return { status: "success", message: "Assessment review recorded." };
}
