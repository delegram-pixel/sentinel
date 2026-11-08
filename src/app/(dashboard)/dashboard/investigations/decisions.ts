"use server";
import { revalidatePath } from "next/cache";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  recordResearchDecision,
  changeResearchPhase,
  relateInvestigations,
} from "@/modules/research/application/decision-service";
import { PrismaDecisionStore } from "@/modules/research/infrastructure/prisma-decision-store";
async function context() {
  const s = await getSessionContext();
  return {
    store: new PrismaDecisionStore(getDb()),
    actor: { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
  };
}
export async function recordDecisionAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const refs = [];
  for (const relationship of ["SUPPORTS", "CONTRADICTS"] as const) {
    const value = String(data.get(relationship.toLowerCase()) ?? "");
    if (value) {
      const [kind, id] = value.split(":");
      refs.push({ kind, id, relationship });
    }
  }
  const result = await recordResearchDecision(store, actor, {
    ...Object.fromEntries(data.entries()),
    sourceRefs: refs,
  });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/investigations", "layout");
  return { status: "success", message: "Your research decision is saved." };
}
export async function changePhaseAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await changeResearchPhase(store, actor, Object.fromEntries(data.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/investigations", "layout");
  return { status: "success", message: "The research phase is updated." };
}
export async function relateInvestigationsAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await relateInvestigations(store, actor, Object.fromEntries(data.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/investigations", "layout");
  return { status: "success", message: "The connection is saved." };
}
