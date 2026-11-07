"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { cancelResearchJob, enqueueResearchJob } from "@/modules/tasks";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { aiJobInputSchema } from "@/modules/ai/infrastructure/ai-job-executor";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import {
  aiUsageReconciliationSchema,
  reconcileAiUsage,
} from "@/modules/ai/infrastructure/ai-usage-reconciliation";
export async function reconcileUsageAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const s = await getSessionContext();
  const p = aiUsageReconciliationSchema.safeParse(Object.fromEntries(form.entries()));
  if (!p.success)
    return {
      status: "error",
      message: "Enter the total provider usage and its reconciliation reference.",
    };
  const result = await reconcileAiUsage(
    getDb(),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    p.data,
  );
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/tasks");
  return { status: "success", message: "Usage reconciled and the reservation released." };
}
export async function cancelJobAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const session = await getSessionContext();
  const id = z.uuid().safeParse(form.get("jobId"));
  if (!id.success) return { status: "error", message: "Invalid work identifier." };
  const result = await cancelResearchJob(
    new PrismaJobStore(getDb()),
    { workspaceId: session.workspace.id, userId: session.user.id, role: session.role },
    id.data,
  );
  revalidatePath("/dashboard/tasks");
  return result.ok && result.value
    ? { status: "success", message: "Cancellation recorded." }
    : { status: "error", message: result.ok ? "This work already finished." : result.message };
}
export async function queueAnalysisAction(
  _state: ResearchFormState,
  form: FormData,
): Promise<ResearchFormState> {
  const session = await getSessionContext();
  const input = aiJobInputSchema.safeParse(Object.fromEntries(form.entries()));
  if (!input.success)
    return { status: "error", message: "Choose an investigation and analytical task." };
  const context = await new PrismaAIStore(getDb()).loadContext(
    session.workspace.id,
    input.data.investigationId,
  );
  if (
    !context ||
    context.project.status === "ARCHIVED" ||
    context.investigation.status === "ARCHIVED"
  )
    return { status: "error", message: "Choose active research in this workspace." };
  const result = await enqueueResearchJob(
    new PrismaJobStore(getDb()),
    { workspaceId: session.workspace.id, userId: session.user.id, role: session.role },
    "AI_TASK",
    String(form.get("operationKey") ?? ""),
    input.data,
  );
  revalidatePath("/dashboard/tasks");
  return result.ok
    ? {
        status: "success",
        message: "Analysis queued. Results appear in the investigation's task history.",
      }
    : { status: "error", message: result.message };
}
