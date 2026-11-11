import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { JobRow } from "@/modules/tasks";
import { JobContinuation } from "@/modules/tasks/domain/job";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import type { AiContextRecord } from "../application/ports";
import {
  hydrateEvidenceContent,
  type AiServiceDependencies,
  type AiTaskInput,
} from "../application/task-service";
import { assembleContext } from "../application/context-manager";
import { AI_TASK_PROFILES } from "../domain/ai-config";
import {
  analysisEvaluationSchema,
  conclusionReviewSchema,
  consolidateCollaboration,
  type AnalysisEvaluation,
  type ConclusionReview,
} from "../domain/collaboration-output";
import type { AiJobResult } from "./ai-job-executor";
import { AiError } from "../domain/ai-errors";

function reviveContext(value: unknown): AiContextRecord {
  const dates = new Set([
    "createdAt",
    "updatedAt",
    "startedAt",
    "authorizationExpiresAt",
    "effectiveFrom",
    "effectiveUntil",
  ]);
  return JSON.parse(JSON.stringify(value), (key, v) =>
    dates.has(key) && typeof v === "string" ? new Date(v) : v,
  );
}
export async function executeCollaboration(
  db: Prisma.TransactionClient,
  deps: AiServiceDependencies,
  job: JobRow,
  input: AiTaskInput,
  run: (stage: string, input: AiTaskInput) => Promise<AiJobResult>,
): Promise<AiJobResult> {
  if (!deps.runtime)
    throw new ResearchOperationError(
      "AI_NOT_CONFIGURED",
      "Enable multi-model routing before requesting collaboration.",
    );
  async function owned<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${job.id}::uuid FOR UPDATE`,
      );
      if (
        !(await tx.backgroundJob.findFirst({
          where: {
            id: job.id,
            workspaceId: job.workspaceId,
            status: "RUNNING",
            leaseToken: job.leaseToken,
            cancelRequestedAt: null,
            leaseUntil: { gt: new Date() },
          },
        }))
      )
        throw new ResearchOperationError(
          "JOB_CANCELLED",
          "The workflow is no longer owned by this worker.",
        );
      return work(tx);
    });
  }
  let collaboration = await db.aICollaboration.findUnique({ where: { jobId: job.id } });
  if (!collaboration) {
    const loaded = await deps.store.loadContext(
      job.workspaceId,
      input.investigationId,
      input.conversationId,
      job.requestedBy,
      true,
    );
    if (!loaded)
      throw new ResearchOperationError(
        "AI_CONTEXT_UNAVAILABLE",
        "This investigation is unavailable.",
      );
    const context = await hydrateEvidenceContent(loaded, deps.evidenceStorage, true);
    const assembled = assembleContext(
      context,
      AI_TASK_PROFILES[input.taskType].inputTokenBudget - 5000,
      true,
    );
    collaboration = await owned((tx) =>
      tx.aICollaboration.upsert({
        where: { jobId: job.id },
        update: {},
        create: {
          jobId: job.id,
          workspaceId: job.workspaceId,
          investigationId: input.investigationId,
          taskType: input.taskType,
          contextVersion: assembled.contextVersion,
          context: JSON.parse(JSON.stringify(context)) as Prisma.InputJsonValue,
        },
      }),
    );
  }
  if (collaboration.status !== "RUNNING")
    return { collaborationId: collaboration.id, status: collaboration.status };
  const context = reviveContext(collaboration.context);
  const analyses: Array<{
    taskId: string;
    provider: string;
    model: string;
    evaluation: AnalysisEvaluation;
  }> = [];
  let review: { taskId: string; output: ConclusionReview } | null = null;
  const failures: Array<{ stage: string; code: string }> = [];
  for (const stage of ["PRIMARY", "SECONDARY", "REVIEW"] as const) {
    const reviewClaims = Object.fromEntries(
      analyses.map((a) => [a.taskId, a.evaluation.claims.map((c) => c.id)]),
    );
    const stageContext =
      stage === "REVIEW"
        ? {
            ...context,
            history: [
              ...(context.history ?? []),
              ...analyses.map((a) => ({
                id: a.taskId,
                title: "Untrusted independent analysis",
                status: "COMPLETED",
                objective: null,
                sourceType: "AI_TASK",
                output: a.evaluation,
                model: a.model,
              })),
            ],
          }
        : context;
    try {
      const result = await run(`collaboration:${stage}`, {
        investigationId: input.investigationId,
        conversationId: stage === "PRIMARY" ? input.conversationId : undefined,
        taskType: stage === "REVIEW" ? "RESEARCH_CONCLUSION_REVIEW" : input.taskType,
        instruction: input.instruction,
        collaborationId: collaboration.id,
        collaborationStage: stage,
        contextOverride: stageContext,
        reviewClaims: stage === "REVIEW" ? reviewClaims : undefined,
        excludedModels: analyses.map((a) => a.model),
      });
      const task = result.taskId && (await deps.store.findTask(job.workspaceId, result.taskId));
      if (!task || task.status !== "COMPLETED")
        throw new ResearchOperationError("AI_INVALID_OUTPUT", "The stage has no validated result.");
      const last = await db.aIExecutionAttempt.findFirst({
        where: { taskId: task.id, response: { not: Prisma.DbNull } },
        orderBy: { sequence: "desc" },
      });
      if (stage === "REVIEW")
        review = { taskId: task.id, output: conclusionReviewSchema.parse(task.output) };
      else
        analyses.push({
          taskId: task.id,
          provider: last?.provider ?? task.provider,
          model: last?.returnedModel ?? last?.model ?? task.model,
          evaluation: analysisEvaluationSchema.parse(task.evaluation),
        });
    } catch (error) {
      if (error instanceof JobContinuation) throw error;
      const code =
        error instanceof ResearchOperationError || error instanceof AiError
          ? error.code
          : "AI_OUTPUT_VALIDATION_FAILED";
      if (["JOB_CANCELLED", "AI_PERMISSION_DENIED"].includes(code)) throw error;
      failures.push({ stage, code });
      if (stage === "PRIMARY") {
        await owned((tx) =>
          tx.aICollaboration.update({
            where: { id: collaboration.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              result: { failures, requiresHumanReview: true },
            },
          }),
        );
        throw new ResearchOperationError(
          code,
          "Primary analysis failed; preserved stage history is available.",
        );
      }
    }
  }
  const result = consolidateCollaboration(analyses, review, failures);
  await owned(async (tx) => {
    await tx.aICollaboration.update({
      where: { id: collaboration.id },
      data: {
        status: result.status,
        result: result as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  });
  return {
    collaborationId: collaboration.id,
    status: result.status,
    stages: analyses.map((a) => ({ taskId: a.taskId })),
  };
}
