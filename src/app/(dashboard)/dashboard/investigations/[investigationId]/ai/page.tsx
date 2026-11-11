import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AiWorkspace, AiWorkspaceSkeleton } from "@/components/ai/ai-workspace";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { ModelHistory } from "@/components/ai/model-history";
import { JobRefresh } from "@/components/research/job-refresh";

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

  const [conversations, selectedConversation, tasks, attempts, collaborations, activeJobs] =
    await Promise.all([
      store.listConversations(session.workspace.id, investigationId),
      requestedConversationId
        ? store.findConversation(session.workspace.id, requestedConversationId)
        : Promise.resolve(null),
      store.listTasks(session.workspace.id, investigationId, 12),
      getDb().aIExecutionAttempt.findMany({
        where: { workspaceId: session.workspace.id, task: { investigationId } },
        select: {
          id: true,
          provider: true,
          model: true,
          returnedModel: true,
          host: true,
          status: true,
          inputTokens: true,
          outputTokens: true,
          latencyMs: true,
          retryCount: true,
          fallbackFrom: true,
          estimatedCostUsd: true,
          task: { select: { taskType: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      }),
      getDb().aICollaboration.findMany({
        where: { workspaceId: session.workspace.id, investigationId },
        select: {
          id: true,
          status: true,
          result: true,
          tasks: {
            select: {
              id: true,
              provider: true,
              model: true,
              collaborationStage: true,
              evaluation: true,
              output: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getDb().backgroundJob.count({
        where: {
          workspaceId: session.workspace.id,
          kind: "AI_TASK",
          status: { in: ["QUEUED", "RUNNING"] },
          payload: { path: ["investigationId"], equals: investigationId },
        },
      }),
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
    <>
      <JobRefresh active={activeJobs > 0} />
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
      <ModelHistory
        attempts={attempts.map((a) => ({
          ...a,
          estimatedCostUsd: a.estimatedCostUsd === null ? null : Number(a.estimatedCostUsd),
        }))}
        collaborations={collaborations}
      />
    </>
  );
}
