"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AiFormState } from "@/components/ai/ai-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  createConversation,
  runAiTask,
  type AiServiceDependencies,
} from "@/modules/ai/application/task-service";
import type { AiConversationRow } from "@/modules/ai/application/ports";
import type { AiTaskType } from "@/modules/ai/domain/ai-config";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { aiModelOverrides, createAIProvider } from "@/modules/ai/infrastructure/provider-factory";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";

function aiPath(investigationId: string): string {
  return `/dashboard/investigations/${investigationId}/ai`;
}

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function dependencies(): AiServiceDependencies {
  return {
    store: new PrismaAIStore(getDb()),
    provider: createAIProvider(),
    evidenceStorage: createEvidenceStorage(),
    modelOverrides: aiModelOverrides(),
  };
}

async function resolveConversation(
  deps: AiServiceDependencies,
  workspaceId: string,
  investigationId: string,
  requestedConversationId: string,
  fallbackTitle: string,
  userId: string,
): Promise<AiConversationRow> {
  if (requestedConversationId) {
    const existing = await deps.store.findConversation(workspaceId, requestedConversationId);

    if (existing && existing.investigationId === investigationId) {
      return existing;
    }
  }

  const created = await createConversation(
    deps,
    { userId, workspaceId },
    { investigationId, title: fallbackTitle },
  );

  if (!created.ok) {
    throw new Error(created.message);
  }

  return created.value;
}

function errorState(message: string): AiFormState {
  return { status: "error", message };
}

async function executeTask(
  investigationId: string,
  taskType: AiTaskType,
  conversationId: string,
  fallbackTitle: string,
  operationKey: string,
): Promise<{ conversationId: string }> {
  if (operationKey.length < 8 || operationKey.length > 160)
    throw new Error(
      "This analysis form needs a refresh. Reload it, then submit the request again.",
    );
  const session = await getSessionContext();
  const deps = dependencies();
  const conversation = await resolveConversation(
    deps,
    session.workspace.id,
    investigationId,
    conversationId,
    fallbackTitle,
    session.user.id,
  );

  const result = await runAiTask(
    deps,
    { userId: session.user.id, workspaceId: session.workspace.id },
    {
      investigationId,
      conversationId: conversation.id,
      taskType,
      operationKey,
    },
  );

  if (!result.ok) {
    throw new Error(result.message);
  }

  return { conversationId: conversation.id };
}

export async function createConversationAction(
  _previousState: AiFormState,
  formData: FormData,
): Promise<AiFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const title = stringValue(formData, "title");

  if (!investigationId) {
    return errorState(
      "We couldn't identify the investigation. Reopen it from Investigations, then try again.",
    );
  }

  const session = await getSessionContext();
  const deps = dependencies();
  const result = await createConversation(
    deps,
    { userId: session.user.id, workspaceId: session.workspace.id },
    { investigationId, title },
  );

  if (!result.ok) {
    return errorState(result.message);
  }

  revalidatePath(aiPath(investigationId));
  redirect(`${aiPath(investigationId)}?conversation=${result.value.id}`);
}

export async function runReconAnalysisAction(
  _previousState: AiFormState,
  formData: FormData,
): Promise<AiFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const conversationId = stringValue(formData, "conversationId");

  if (!investigationId) {
    return errorState(
      "We couldn't identify the investigation. Reopen it from Investigations, then try again.",
    );
  }

  let conversation: { conversationId: string };

  try {
    conversation = await executeTask(
      investigationId,
      "RECON_ANALYSIS",
      conversationId,
      "Reconnaissance analysis",
      stringValue(formData, "operationKey"),
    );
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "The AI task could not be completed.",
    );
  }

  revalidatePath(aiPath(investigationId));
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  redirect(`${aiPath(investigationId)}?conversation=${conversation.conversationId}`);
}

export async function runHypothesisGenerationAction(
  _previousState: AiFormState,
  formData: FormData,
): Promise<AiFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const conversationId = stringValue(formData, "conversationId");

  if (!investigationId) {
    return errorState(
      "We couldn't identify the investigation. Reopen it from Investigations, then try again.",
    );
  }

  let conversation: { conversationId: string };

  try {
    conversation = await executeTask(
      investigationId,
      "HYPOTHESIS_GENERATION",
      conversationId,
      "Hypothesis generation",
      stringValue(formData, "operationKey"),
    );
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "The AI task could not be completed.",
    );
  }

  revalidatePath(aiPath(investigationId));
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  redirect(`${aiPath(investigationId)}?conversation=${conversation.conversationId}`);
}

export async function generateSessionSummaryAction(
  _previousState: AiFormState,
  formData: FormData,
): Promise<AiFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const operationKey = stringValue(formData, "operationKey");
  if (operationKey.length < 8 || operationKey.length > 160)
    return errorState("This form needs a refresh. Reload it, then try again.");

  if (!investigationId) {
    return errorState(
      "We couldn't identify the investigation. Reopen it from Investigations, then try again.",
    );
  }

  const session = await getSessionContext();
  const deps = dependencies();
  const result = await runAiTask(
    deps,
    { userId: session.user.id, workspaceId: session.workspace.id },
    {
      investigationId,
      taskType: "SESSION_SUMMARY",
      operationKey: stringValue(formData, "operationKey"),
    },
  );

  if (!result.ok) {
    return errorState(result.message);
  }

  revalidatePath(aiPath(investigationId));
  revalidatePath(`/dashboard/investigations/${investigationId}`);
  redirect(`/dashboard/investigations/${investigationId}#session-summaries`);
}
