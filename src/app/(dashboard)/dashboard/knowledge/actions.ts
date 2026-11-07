"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  createKnowledgeDocument,
  reviewKnowledgeDocument,
  relateKnowledgeDocuments,
} from "@/modules/knowledge";
import { PrismaKnowledgeStore } from "@/modules/knowledge/infrastructure/prisma-knowledge-store";
async function context() {
  const s = await getSessionContext();
  return {
    store: new PrismaKnowledgeStore(getDb()),
    actor: { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
  };
}
export async function createKnowledgeAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await createKnowledgeDocument(store, actor, {
    ...Object.fromEntries(data.entries()),
    tags: String(data.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${result.value.id}`);
}
export async function reviewKnowledgeAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await reviewKnowledgeDocument(store, actor, Object.fromEntries(data.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/knowledge", "layout");
  return { status: "success", message: "Review recorded." };
}
export async function relateKnowledgeAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const { store, actor } = await context();
  const result = await relateKnowledgeDocuments(store, actor, Object.fromEntries(data.entries()));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/knowledge", "layout");
  return { status: "success", message: "Relationship recorded." };
}
