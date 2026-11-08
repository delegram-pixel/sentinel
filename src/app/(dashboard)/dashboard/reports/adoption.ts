"use server";
import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/session";
import { getDb } from "@/lib/db";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { adoptAiReportDraft } from "@/modules/reports/application/ai-report-service";
import { PrismaAiReportStore } from "@/modules/reports/infrastructure/prisma-ai-report-store";
export async function adoptAiReportAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const s = await getSessionContext();
  const result = await adoptAiReportDraft(
    new PrismaAiReportStore(getDb()),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    Object.fromEntries(data.entries()),
  );
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/reports", "layout");
  return {
    status: "success",
    message:
      "The AI draft is saved as a new revision. Review it and get human approval before exporting.",
  };
}
