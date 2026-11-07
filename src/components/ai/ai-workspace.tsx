import Link from "next/link";

import { AiTaskStatusBadge } from "@/components/ai/ai-badges";
import { ChatForm } from "@/components/ai/chat-form";
import { NewConversationForm } from "@/components/ai/new-conversation-form";
import {
  AiSessionSummaryForm,
  HypothesisGenerationForm,
  ReconAnalysisForm,
} from "@/components/ai/ai-task-actions";
import { ResearchOutput } from "@/components/ai/research-output";
import { Disclosure } from "@/components/shared/disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { SourceLabel } from "@/components/shared/status-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersistentAiTabs } from "./persistent-ai-tabs";
import type {
  AiContextRecord,
  AiConversationDetail,
  AiConversationRow,
  AiMessageRow,
  AiTaskRow,
} from "@/modules/ai/application/ports";
import { AI_TASK_TYPE_LABELS } from "@/modules/ai/domain/ai-config";

function MessageBody({
  message,
  investigationId,
}: {
  message: AiMessageRow;
  investigationId: string;
}) {
  return (
    <article className="research-record">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {message.role === "USER" ? (
          <SourceLabel source="researcher" />
        ) : message.role === "ASSISTANT" ? (
          <SourceLabel source="ai" />
        ) : (
          <span className="text-xs text-text-secondary">
            {message.role === "SYSTEM" ? "System context" : "Tool output"}
          </span>
        )}
        <ResearchTime date={message.createdAt} precision="time" />
      </div>
      <h3 className="mb-3 text-sm font-medium">
        {message.role === "USER"
          ? "Research question"
          : message.role === "ASSISTANT"
            ? "Assistant research note"
            : "Context record"}
      </h3>
      {message.role === "ASSISTANT" ? (
        <ResearchOutput
          output={message.structuredContent}
          investigationId={investigationId}
          fallback={message.content}
        />
      ) : (
        <p className="research-copy text-sm">{message.content}</p>
      )}
      {message.role === "ASSISTANT" ? (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
          <EvidenceReference id={message.id} label="Message" />
          {message.inputTokens !== null ? (
            <span className="font-mono">
              {message.inputTokens.toLocaleString("en-US")} input tokens
            </span>
          ) : null}
          {message.outputTokens !== null ? (
            <span className="font-mono">
              {message.outputTokens.toLocaleString("en-US")} output tokens
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TaskHistory({ tasks }: { tasks: AiTaskRow[] }) {
  return (
    <ResearchSection
      id="ai-task-history"
      title="Task history"
      description="Recorded execution status, model and prompt provenance, and token usage."
    >
      {tasks.length === 0 ? (
        <EmptyState
          title="No AI tasks recorded"
          description="Ask a question in Guided mode or run a bounded analysis in Delegated mode. Completed and failed tasks appear here."
        />
      ) : (
        <RecordTable caption="AI task history" minWidth="48rem">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Execution</th>
              <th scope="col">Provenance</th>
              <th scope="col">Usage</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <p className="font-medium">{AI_TASK_TYPE_LABELS[task.taskType]}</p>
                  <div className="mt-2">
                    <EvidenceReference id={task.id} label="Task" />
                  </div>
                  {task.failureCode ? (
                    <p className="record-metadata mt-2 text-danger">{task.failureCode}</p>
                  ) : null}
                  <Disclosure title="Execution details" className="mt-3">
                    <MetadataList
                      items={[
                        {
                          label: "Started",
                          value: (
                            <ResearchTime
                              date={task.startedAt}
                              precision="time"
                              empty="Not started"
                            />
                          ),
                        },
                        {
                          label: "Completed",
                          value: (
                            <ResearchTime
                              date={task.completedAt}
                              precision="time"
                              empty="Not completed"
                            />
                          ),
                        },
                        { label: "Context version", value: task.contextVersion, technical: true },
                        {
                          label: "Input budget",
                          value: task.inputTokenBudget.toLocaleString("en-US"),
                          technical: true,
                        },
                        {
                          label: "Output budget",
                          value: task.outputTokenBudget.toLocaleString("en-US"),
                          technical: true,
                        },
                      ]}
                    />
                    {task.errorMessage ? (
                      <p className="mt-4 text-sm text-danger">{task.errorMessage}</p>
                    ) : null}
                  </Disclosure>
                </td>
                <td>
                  <AiTaskStatusBadge status={task.status} />
                </td>
                <td>
                  <p className="record-metadata">{task.model}</p>
                  <p className="record-metadata mt-2">{task.promptTemplateId}</p>
                  <p className="record-metadata">Version {task.promptVersion}</p>
                </td>
                <td className="record-metadata">
                  <p>{task.inputTokens.toLocaleString("en-US")} in</p>
                  <p>{task.outputTokens.toLocaleString("en-US")} out</p>
                </td>
                <td>
                  <ResearchTime date={task.createdAt} precision="time" />
                </td>
              </tr>
            ))}
          </tbody>
        </RecordTable>
      )}
    </ResearchSection>
  );
}

export function AiWorkspace({
  investigationId,
  investigationTitle,
  conversations,
  selectedConversation,
  tasks,
  archived,
  error,
  context,
}: {
  investigationId: string;
  investigationTitle: string;
  conversations: AiConversationRow[];
  selectedConversation: AiConversationDetail | null;
  tasks: AiTaskRow[];
  archived: boolean;
  error?: string;
  context?: AiContextRecord;
}) {
  const basePath = `/dashboard/investigations/${investigationId}/ai`;
  const results = tasks.filter(
    (task) =>
      task.taskType !== "ATTACK_SURFACE_ANALYSIS" &&
      task.status === "COMPLETED" &&
      task.output !== null,
  );
  return (
    <div className="page-stack">
      <Link
        href={`/dashboard/investigations/${investigationId}`}
        className="record-link w-fit text-sm text-text-secondary"
      >
        Back to investigation
      </Link>
      <PageHeader
        title="Research assistance"
        description={investigationTitle}
        metadata={
          <div className="flex flex-wrap items-center gap-4">
            <SourceLabel source="ai" />
            <span className="text-xs text-text-secondary">
              Advisory output; human verification required
            </span>
          </div>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>AI task could not be completed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {archived ? (
        <Alert>
          <AlertTitle>Research record archived</AlertTitle>
          <AlertDescription>
            You can read the existing history. New conversations and tasks are unavailable.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid min-w-0 gap-8 xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-10">
        <aside className="flex min-w-0 flex-col gap-7" aria-label="Assistant context and history">
          <ResearchSection id="ai-context" title="Research context">
            <MetadataList
              items={[
                {
                  label: "Investigation",
                  value: (
                    <Link
                      href={`/dashboard/investigations/${investigationId}`}
                      className="record-link"
                    >
                      {investigationTitle}
                    </Link>
                  ),
                },
                ...(context
                  ? [
                      { label: "Target", value: context.target.assetIdentifier, technical: true },
                      {
                        label: "Objective",
                        value: context.investigation.objective ?? "No objective recorded",
                      },
                      {
                        label: "Records available",
                        value: `${context.observations.length} observations, ${context.hypotheses.length} hypotheses, ${context.summaries.length} summaries`,
                      },
                    ]
                  : []),
              ]}
            />
            <p className="mt-4 text-xs leading-relaxed text-text-secondary">
              The assistant analyses supplied records. It cannot authorize targets or confirm
              findings.
            </p>
          </ResearchSection>
          <ResearchSection id="ai-conversations" title="Conversation history">
            {!archived ? (
              <Disclosure title="Start conversation">
                <NewConversationForm investigationId={investigationId} disabled={archived} />
              </Disclosure>
            ) : null}
            {conversations.length ? (
              <ul className="mt-3 flex flex-col">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`${basePath}?conversation=${conversation.id}`}
                      aria-current={
                        conversation.id === selectedConversation?.id ? "page" : undefined
                      }
                      className="block border-l-2 border-transparent py-3 pl-3 text-sm text-text-secondary hover:bg-secondary hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-primary"
                    >
                      <span className="line-clamp-2 break-words">{conversation.title}</span>
                      <span className="mt-1 block">
                        <ResearchTime date={conversation.updatedAt} precision="time" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">No conversations saved.</p>
            )}
          </ResearchSection>
        </aside>
        <div className="min-w-0">
          <PersistentAiTabs
            key={selectedConversation?.id ?? "new-session"}
            conversationId={selectedConversation?.id}
            mode={selectedConversation?.mode ?? "GUIDED"}
          >
            <TabsList aria-label="Research assistance mode">
              <TabsTrigger value="guided">Guided mode</TabsTrigger>
              <TabsTrigger value="delegated">Delegated mode</TabsTrigger>
            </TabsList>
            <TabsContent value="guided">
              <p className="mb-6 max-w-2xl text-sm leading-relaxed text-text-secondary">
                Ask a focused question, examine the reasoning, and decide what to verify next.
              </p>
              {selectedConversation ? (
                <ResearchSection
                  id="guided-conversation"
                  title={selectedConversation.title}
                  action={<span className="record-metadata">{selectedConversation.model}</span>}
                >
                  {selectedConversation.messages.length ? (
                    selectedConversation.messages.map((message) => (
                      <MessageBody
                        key={message.id}
                        message={message}
                        investigationId={investigationId}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="Ready for your first question"
                      description="The assistant will use this investigation’s saved context. Ask what the observations support or what information is still missing."
                    />
                  )}
                  {!archived ? (
                    <div className="mt-6 border-t border-border pt-6">
                      <ChatForm
                        investigationId={investigationId}
                        conversationId={selectedConversation.id}
                        disabled={archived}
                      />
                    </div>
                  ) : null}
                </ResearchSection>
              ) : (
                <EmptyState
                  title="Start with a research question"
                  description="Create a conversation from the history panel, then ask about this investigation’s observations, hypotheses, or next steps."
                />
              )}
            </TabsContent>
            <TabsContent value="delegated">
              <div className="flex flex-col gap-8">
                <ResearchSection
                  id="bounded-analysis"
                  title="Bounded research tasks"
                  description="Run one analysis against saved investigation context. Review the result before incorporating it into your research."
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-text-secondary">
                        Separate supplied information from unknowns and identify observations for
                        review.
                      </p>
                      <ReconAnalysisForm
                        key={
                          tasks.find(
                            (t) => t.taskType === "RECON_ANALYSIS" && t.status === "COMPLETED",
                          )?.id ?? "initial-recon"
                        }
                        investigationId={investigationId}
                        conversationId={selectedConversation?.id ?? ""}
                        disabled={archived}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-text-secondary">
                        Propose hypotheses with reasoning, supporting references, and missing
                        information.
                      </p>
                      <HypothesisGenerationForm
                        key={
                          tasks.find(
                            (t) =>
                              t.taskType === "HYPOTHESIS_GENERATION" && t.status === "COMPLETED",
                          )?.id ?? "initial-hypothesis"
                        }
                        investigationId={investigationId}
                        conversationId={selectedConversation?.id ?? ""}
                        disabled={archived}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-text-secondary">
                        Save an AI-generated summary of completed work and suggested next actions.
                      </p>
                      <AiSessionSummaryForm
                        key={
                          tasks.find(
                            (t) => t.taskType === "SESSION_SUMMARY" && t.status === "COMPLETED",
                          )?.id ?? "initial-summary"
                        }
                        investigationId={investigationId}
                        disabled={archived}
                      />
                    </div>
                  </div>
                </ResearchSection>
                <ResearchSection id="structured-results" title="Structured research output">
                  {results.length ? (
                    results.map((task) => (
                      <article key={task.id} className="research-record">
                        <div className="mb-3 flex flex-wrap items-center gap-4">
                          <SourceLabel source="ai" />
                          <AiTaskStatusBadge status={task.status} />
                          <ResearchTime date={task.completedAt} precision="time" />
                        </div>
                        <h3 className="mb-4 text-base font-medium">
                          {AI_TASK_TYPE_LABELS[task.taskType]}
                        </h3>
                        <ResearchOutput
                          output={task.output}
                          investigationId={investigationId}
                          sourceTaskId={task.id}
                        />
                        <div className="mt-5 flex flex-wrap items-center gap-4">
                          <EvidenceReference id={task.id} label="Task" />
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/investigations/${investigationId}`}>
                              Review in investigation
                            </Link>
                          </Button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      title="No structured results recorded"
                      description="Run a bounded task to receive a research note with references, uncertainty, and proposed next actions."
                    />
                  )}
                </ResearchSection>
              </div>
            </TabsContent>
          </PersistentAiTabs>
        </div>
      </div>
      <TaskHistory tasks={tasks} />
    </div>
  );
}

export function AiWorkspaceSkeleton() {
  return (
    <div role="status" aria-label="Loading research assistance">
      <span className="sr-only">Loading research assistance…</span>
      <div className="page-stack" aria-hidden>
        <Skeleton className="h-12 w-3/4" />
        <div className="grid gap-8 xl:grid-cols-[14rem_minmax(0,1fr)]">
          <Skeleton className="h-80 w-full" />
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
