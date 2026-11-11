import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AI_TASK_TYPES } from "../domain/ai-config";
import {
  runAiTask,
  type AiServiceDependencies,
  type AiTaskInput,
} from "../application/task-service";
import { routeModel } from "../application/model-router";
import { executePreparedTask } from "./durable-ai-executor";
import { executeCollaboration } from "./collaboration-executor";
import { ResearchOperationError } from "@/modules/shared/domain/result";
import type { JobRow } from "@/modules/tasks";
import type { AiProviderRequest } from "../application/provider";

export const aiJobInputSchema = z
  .object({
    investigationId: z.uuid(),
    conversationId: z.uuid().optional(),
    taskType: z.enum(AI_TASK_TYPES),
    instruction: z.string().trim().max(8000).optional(),
    workflow: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(["CONTEXT_HYPOTHESES", "EVIDENCE_VERIFICATION", "COLLABORATIVE_RESEARCH"]).optional(),
    ),
    mode: z.enum(["GUIDED", "DELEGATED"]).default("GUIDED"),
  })
  .refine(
    (input) => input.taskType !== "RESEARCH_CONCLUSION_REVIEW",
    "Conclusion reviews are internal workflow stages.",
  )
  .refine(
    (input) =>
      input.workflow !== "COLLABORATIVE_RESEARCH" ||
      !["SESSION_SUMMARY", "FINDING_SUMMARY", "ATTACK_SURFACE_ANALYSIS"].includes(input.taskType),
    "Collaboration requires a complex research analysis.",
  );

export type AiJobResult = {
  taskId?: string;
  recovered?: boolean;
  collaborationId?: string;
  status?: string;
  stages?: Array<{ taskId?: string }>;
};
export async function executeAiJob(
  db: Prisma.TransactionClient,
  initialDeps: AiServiceDependencies,
  job: JobRow,
  stage?: string,
  internal?: AiTaskInput,
): Promise<AiJobResult> {
  const input = internal ?? aiJobInputSchema.parse(job.payload);
  const workflow = "workflow" in input ? input.workflow : undefined;
  if (workflow === "COLLABORATIVE_RESEARCH")
    return executeCollaboration(db, initialDeps, job, input, (stageName, stageInput) =>
      executeAiJob(db, initialDeps, job, stageName, stageInput),
    );
  if (workflow) {
    const stages =
      workflow === "CONTEXT_HYPOTHESES"
        ? ["RECON_ANALYSIS", "PATTERN_ANALYSIS", "HYPOTHESIS_GENERATION"]
        : ["EVIDENCE_REVIEW", "FALSE_POSITIVE_REVIEW"];
    const results = [];
    for (const taskType of stages)
      results.push(
        await executeAiJob(
          db,
          initialDeps,
          { ...job, payload: { ...input, workflow: undefined, taskType } },
          taskType,
        ),
      );
    return { stages: results };
  }
  const baseKey = `job:${job.id}${stage ? `:${stage}` : ""}`;
  let key = baseKey;
  let task = await initialDeps.store.findTaskByIdempotency(job.workspaceId, key);
  let parentTaskId: string | undefined;
  for (
    let retry = 2;
    retry <= job.attempts && !initialDeps.runtime && !initialDeps.provider.executionPolicy;
    retry++
  ) {
    if (task?.status !== "FAILED" || task.failureCode !== "AI_RATE_LIMITED" || task.usageUncertain)
      break;
    parentTaskId = task.id;
    key = `${baseKey}:retry:${retry}`;
    task = await initialDeps.store.findTaskByIdempotency(job.workspaceId, key);
  }
  if (task?.status === "COMPLETED") return { taskId: task.id };
  if (task && !["PENDING", "RUNNING"].includes(task.status))
    throw new ResearchOperationError(
      task.failureCode ?? "AI_TASK_FAILED",
      "This task is terminal. Request a new analysis to retry.",
    );
  let deps = initialDeps;
  if (deps.runtime) {
    const saved = task?.inputContext as {
      request?: AiProviderRequest;
      fallbackFrom?: string;
    } | null;
    const execution = task?.executionState as {
      base?: AiProviderRequest;
      fallbackFrom?: string;
    } | null;
    const pinned = execution?.base ?? saved?.request;
    const role = internal?.collaborationStage ?? "PRIMARY";
    if (pinned) {
      const model = deps.runtime.models.find(
        (m) => m.provider === (pinned.provider ?? task!.provider) && m.modelId === pinned.model,
      );
      const provider =
        model && deps.runtime.privacyApproved(model) ? deps.runtime.providerFor(model) : null;
      if (!model || !provider)
        throw new ResearchOperationError(
          "AI_NO_COMPATIBLE_MODEL",
          "The pinned model is unavailable. The saved request remains unchanged.",
        );
      deps = {
        ...deps,
        route: { model, provider, fallbackFrom: execution?.fallbackFrom ?? saved?.fallbackFrom },
        provider,
        modelOverrides: {
          provider: model.provider,
          researchModel: model.modelId,
          summaryModel: model.modelId,
        },
      };
    } else {
      const excluded = (internal as (AiTaskInput & { excludedModels?: string[] }) | undefined)
        ?.excludedModels;
      const route = await routeModel(deps.runtime, input.taskType, role, {
        excludedModels: excluded,
      });
      deps = {
        ...deps,
        route,
        provider: route.provider,
        modelOverrides: {
          provider: route.model.provider,
          researchModel: route.model.modelId,
          summaryModel: route.model.modelId,
        },
      };
    }
  }
  if (!task || task.status === "PENDING") {
    const result = await runAiTask(
      deps,
      { workspaceId: job.workspaceId, userId: job.requestedBy },
      {
        ...input,
        parentTaskId,
        operationKey: key,
        executionLease: { jobId: job.id, token: job.leaseToken! },
      },
    );
    if (!result.ok) throw new ResearchOperationError(result.code, result.message);
    task = result.value.task;
    if (task.status === "COMPLETED") return { taskId: task.id };
  }
  const taskId = task.id;
  const fenced = await db.$transaction(async (tx) => {
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
          leaseUntil: { gt: new Date() },
          cancelRequestedAt: null,
        },
      }))
    )
      return false;
    return (
      (
        await tx.aITask.updateMany({
          where: {
            id: taskId,
            workspaceId: job.workspaceId,
            status: "RUNNING",
            executionJobId: job.id,
          },
          data: { executorToken: job.leaseToken },
        })
      ).count === 1
    );
  });
  if (!fenced)
    throw new ResearchOperationError(
      "JOB_CANCELLED",
      "The work was cancelled or its lease expired.",
    );
  return executePreparedTask(db, deps, job, { ...task, executorToken: job.leaseToken });
}
