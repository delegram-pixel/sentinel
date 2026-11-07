"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import type { ResearchFormState } from "@/components/research/research-action-form";
import {
  createRemediation,
  changeRemediationStatus,
  requestManualRetest,
  reviewManualRetest,
  closeRemediation,
  recordSubmissionOutcome,
} from "@/modules/remediation/application/remediation-service";
import { PrismaRemediationStore } from "@/modules/remediation/infrastructure/prisma-remediation-store";
async function mutate(
  data: FormData,
  operation: typeof createRemediation,
): Promise<ResearchFormState> {
  const s = await getSessionContext();
  const values: Record<string, unknown> = Object.fromEntries(data.entries());
  if (values.evidenceIds !== undefined)
    values.evidenceIds = String(values.evidenceIds)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  if (values.occurredAt) {
    const date = new Date(String(values.occurredAt));
    if (!Number.isFinite(date.getTime()))
      return { status: "error", message: "Enter the event's actual date and time." };
    values.occurredAt = date.toISOString();
  }
  for (const key of ["reportId", "findingId"]) if (values[key] === "") delete values[key];
  const result = await operation(
    new PrismaRemediationStore(getDb()),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    values,
  );
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/remediation");
  revalidatePath("/dashboard/findings", "layout");
  return { status: "success", message: "Human research record saved." };
}
export async function createRemediationAction(_state: ResearchFormState, data: FormData) {
  return mutate(data, createRemediation);
}
export async function changeRemediationAction(_state: ResearchFormState, data: FormData) {
  return mutate(data, changeRemediationStatus);
}
export async function requestRetestAction(_state: ResearchFormState, data: FormData) {
  return mutate(data, requestManualRetest);
}
export async function reviewRetestAction(_state: ResearchFormState, data: FormData) {
  return mutate(data, reviewManualRetest);
}
export async function closeRemediationAction(_state: ResearchFormState, data: FormData) {
  return mutate(data, closeRemediation);
}
export async function recordOutcomeAction(_state: ResearchFormState, data: FormData) {
  return mutate(data, recordSubmissionOutcome);
}
