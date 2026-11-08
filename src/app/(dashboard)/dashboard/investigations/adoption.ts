"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { adoptAiSuggestion } from "@/modules/research/application/ai-adoption-service";
import { PrismaAiAdoptionStore } from "@/modules/research/infrastructure/prisma-ai-adoption-store";
export async function adoptSuggestionAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const s = await getSessionContext();
  const result = await adoptAiSuggestion(
    new PrismaAiAdoptionStore(getDb()),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    Object.fromEntries(form.entries()),
  );
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/investigations", "layout");
  return {
    status: "success",
    message:
      "The suggestion is added to your research, with its source and your adoption decision saved.",
  };
}
