import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AiWorkspace, AiWorkspaceSkeleton } from "@/components/ai/ai-workspace";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";

export const metadata: Metadata = {
  title: "AI workspace",
};

export const instant = false;

type AiPageProps = {
  params: Promise<{ investigationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvestigationAiPage({ params, searchParams }: AiPageProps) {
  const { investigationId } = await params;
  const query = await searchParams;

  return (
    <Suspense fallback={<AiWorkspaceSkeleton />}>
      <AiContent
        investigationId={investigationId}
        requestedConversationId={
          typeof query.conversation === "string" ? query.conversation : undefined
        }
        error={typeof query.error === "string" ? query.error : undefined}
      />
    </Suspense>
  );
}

async function AiContent({
  investigationId,
  requestedConversationId,
  error,
}: {
  investigationId: string;
  requestedConversationId?: string;
  error?: string;
}) {
  const session = await getSessionContext();
  const store = new PrismaAIStore(getDb());
  const context = await store.loadContext(session.workspace.id, investigationId);

  if (!context) {
    notFound();
  }

  const [conversations, selectedConversation, tasks] = await Promise.all([
    store.listConversations(session.workspace.id, investigationId),
    requestedConversationId
      ? store.findConversation(session.workspace.id, requestedConversationId)
      : Promise.resolve(null),
    store.listTasks(session.workspace.id, investigationId, 12),
  ]);

  if (
    requestedConversationId &&
    (!selectedConversation || selectedConversation.investigationId !== investigationId)
  ) {
    notFound();
  }

  const archived =
    context.project.status === "ARCHIVED" || context.investigation.status === "ARCHIVED";

  return (
    <AiWorkspace
      investigationId={investigationId}
      investigationTitle={context.investigation.title}
      conversations={conversations}
      selectedConversation={selectedConversation}
      tasks={tasks}
      archived={archived}
      error={error}
      context={context}
    />
  );
}
