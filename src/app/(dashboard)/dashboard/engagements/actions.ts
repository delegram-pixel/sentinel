"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  addEngagementAsset,
  associateInvestigation,
  changeEngagementStatus,
  createEngagement,
  recordEngagementAuthorization,
} from "@/modules/engagements";
import { PrismaEngagementStore } from "@/modules/engagements/infrastructure/prisma-engagement-store";
import type { DomainResult } from "@/modules/shared/domain/result";

async function context() {
  const session = await getSessionContext();
  return {
    store: new PrismaEngagementStore(getDb()),
    actor: { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
  };
}
function values(data: FormData) {
  return Object.fromEntries(data.entries());
}
function finish(result: DomainResult<{ id: string }>, engagementId: string): ResearchFormState {
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/engagements");
  revalidatePath(`/dashboard/engagements/${engagementId}`);
  revalidatePath("/dashboard/investigations", "layout");
  return { status: "success", message: "Saved." };
}
export async function createEngagementAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await createEngagement(store, actor, values(data));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/engagements");
  redirect(`/dashboard/engagements/${result.value.id}`);
}
export async function addAssetAction(_state: ResearchFormState, data: FormData) {
  const { store, actor } = await context();
  return finish(
    await addEngagementAsset(store, actor, values(data)),
    String(data.get("engagementId")),
  );
}
export async function recordAuthorizationAction(_state: ResearchFormState, data: FormData) {
  const { store, actor } = await context();
  return finish(
    await recordEngagementAuthorization(store, actor, values(data)),
    String(data.get("engagementId")),
  );
}
export async function associateInvestigationAction(_state: ResearchFormState, data: FormData) {
  const { store, actor } = await context();
  return finish(
    await associateInvestigation(store, actor, values(data)),
    String(data.get("engagementId")),
  );
}
export async function changeEngagementStatusAction(_state: ResearchFormState, data: FormData) {
  const { store, actor } = await context();
  return finish(
    await changeEngagementStatus(store, actor, values(data)),
    String(data.get("engagementId")),
  );
}
