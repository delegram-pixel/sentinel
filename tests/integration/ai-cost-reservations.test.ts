import { afterAll, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { AI_TASK_PROFILES } from "@/modules/ai/domain/ai-config";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { reconcileAiUsage } from "@/modules/ai/infrastructure/ai-usage-reconciliation";
import * as environment from "@/config/env.server";
import type { Prisma } from "@/generated/prisma/client";
const client = createTestClient();
afterAll(() => client.$disconnect());
afterEach(() => vi.restoreAllMocks());
function policy(taskCap: number, dailyCap: number) {
  vi.spyOn(environment, "getServerEnv").mockReturnValue({
    ...environment.getServerEnv(),
    AI_ALLOW_PAID_MODELS: true,
    AI_MAX_TASK_COST_USD: taskCap,
    AI_MAX_DAILY_COST_USD: dailyCap,
  });
}
const request = {
  provider: "GEMINI" as const,
  model: "gemini-3.8-flash",
  taskType: "PATTERN_ANALYSIS" as const,
  system: "Synthetic fixture",
  messages: [{ role: "user" as const, content: "Use supplied data" }],
  timeoutMs: 1000,
  maxTokens: 1000,
  inputTokenEstimate: 1000,
  costEstimateUsd: 0.06,
  pricing: { input: 0.75, output: 3.75 },
};
async function taskFor(
  tx: Prisma.TransactionClient,
  t: Awaited<ReturnType<typeof createTenancy>>,
  jobId?: string,
  token?: string,
) {
  const store = new PrismaAIStore(tx);
  const profile = AI_TASK_PROFILES.PATTERN_ANALYSIS;
  const task = await store.createTask({
    workspaceId: t.workspace.id,
    investigationId: t.investigation.id,
    taskType: "PATTERN_ANALYSIS",
    provider: "GEMINI",
    model: request.model,
    requestedBy: t.user.id,
    promptTemplateId: profile.promptId!,
    promptVersion: "fixture",
    contextVersion: "fixture",
    idempotencyKey: randomUUID(),
    requiredCapabilities: [],
    inputTokenBudget: profile.inputTokenBudget,
    outputTokenBudget: profile.outputTokenBudget,
    executionJobId: jobId,
    executorToken: token,
  });
  await store.updateTask(t.workspace.id, task.id, {
    status: "RUNNING",
    executionJobId: jobId,
    executorToken: token,
  });
  return task;
}
it("caps the combined spending reservation of all stages in one workflow", () =>
  withRollback(client, async (tx) => {
    policy(0.1, 100);
    const t = await createTenancy(tx);
    const jobs = new PrismaJobStore(tx);
    await jobs.enqueue(
      { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" },
      "AI_TASK",
      randomUUID(),
      {},
    );
    const job = (await jobs.claim())!;
    const a = await taskFor(tx, t, job.id, job.leaseToken!);
    const b = await taskFor(tx, t, job.id, job.leaseToken!);
    const store = new PrismaAIStore(tx);
    const lease = { jobId: job.id, token: job.leaseToken! };
    await store.startAttempt(t.workspace.id, a.id, 1, request, lease);
    await expect(store.startAttempt(t.workspace.id, b.id, 1, request, lease)).rejects.toMatchObject(
      { code: "AI_COST_LIMIT" },
    );
    expect(await tx.aIExecutionAttempt.count({ where: { task: { executionJobId: job.id } } })).toBe(
      1,
    );
  }));
it("releases an uncertain paid reservation only after reviewed, model-priced reconciliation", () =>
  withRollback(client, async (tx) => {
    policy(1, 100);
    const t = await createTenancy(tx);
    const task = await taskFor(tx, t);
    const store = new PrismaAIStore(tx);
    const attempt = await store.startAttempt(t.workspace.id, task.id, 1, request);
    await store.finishAttempt(t.workspace.id, attempt.id, null, "AI_TIMEOUT", "UNCERTAIN");
    await store.updateTask(t.workspace.id, task.id, {
      status: "TIMED_OUT",
      failureCode: "AI_TIMEOUT",
      completedAt: new Date(),
    });
    expect(
      Number(
        (await tx.aIExecutionAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
          .reservedCostUsd,
      ),
    ).toBe(0.06);
    const result = await reconcileAiUsage(
      tx,
      { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" },
      {
        taskId: task.id,
        inputTokens: 1000,
        outputTokens: 200,
        providerReference: "Synthetic ledger",
        rationale: "Verified synthetic input and output totals",
      },
    );
    expect(result.ok).toBe(true);
    expect(await store.findTask(t.workspace.id, task.id)).toMatchObject({
      usageUncertain: false,
      reservedTokens: 0,
      estimatedCostUsd: 0.0015,
    });
    expect(
      await tx.aIExecutionAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
    ).toMatchObject({ delivery: "RECONCILED" });
    expect(
      Number(
        (await tx.aIExecutionAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
          .reservedCostUsd,
      ),
    ).toBe(0);
  }));
it("serializes concurrent reservations across database connections", async () => {
  policy(1, 0.1);
  // Committed synthetic rows are necessary to exercise cross-connection locks.
  const t = await client.$transaction((tx) => createTenancy(tx));
  try {
    const a = await taskFor(client, t);
    const b = await taskFor(client, t);
    const store = new PrismaAIStore(client);
    const results = await Promise.allSettled([
      store.startAttempt(t.workspace.id, a.id, 1, request),
      store.startAttempt(t.workspace.id, b.id, 1, request),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "AI_COST_LIMIT" },
    });
  } finally {
    await client.$transaction(async (tx) => {
      await tx.aIExecutionAttempt.deleteMany({ where: { workspaceId: t.workspace.id } });
      await tx.aITask.deleteMany({ where: { workspaceId: t.workspace.id } });
      await tx.finding.deleteMany({ where: { workspaceId: t.workspace.id } });
      await tx.investigation.delete({ where: { id: t.investigation.id } });
      await tx.scopeAsset.deleteMany({ where: { scopeVersionId: t.scope.id } });
      await tx.scopeActivityRule.deleteMany({ where: { scopeVersionId: t.scope.id } });
      await tx.scopeVersion.delete({ where: { id: t.scope.id } });
      await tx.target.delete({ where: { id: t.target.id } });
      await tx.project.delete({ where: { id: t.project.id } });
      await tx.workspaceMember.deleteMany({ where: { workspaceId: t.workspace.id } });
      await tx.workspace.delete({ where: { id: t.workspace.id } });
      await tx.user.delete({ where: { id: t.user.id } });
    });
  }
});
