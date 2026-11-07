import { afterAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { AI_TASK_PROFILES } from "@/modules/ai/domain/ai-config";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { executeAiJob } from "@/modules/ai/infrastructure/ai-job-executor";
import { reconcileAiUsage } from "@/modules/ai/infrastructure/ai-usage-reconciliation";
import { runAiTask, sendChatMessage } from "@/modules/ai/application/task-service";
import { MockAIProvider } from "@/modules/ai/application/mock-provider";
import { AiError } from "@/modules/ai/domain/ai-errors";
import { processNextResearchJob } from "@/modules/tasks/infrastructure/worker";
const client = createTestClient();
afterAll(() => client.$disconnect());
it("retries explicit provider rate limits with bounded backoff and separately recorded runs", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const jobs = new PrismaJobStore(tx);
    const store = new PrismaAIStore(tx);
    const queued = await jobs.enqueue(actor, "AI_TASK", randomUUID(), {
      investigationId: t.investigation.id,
      taskType: "RECON_ANALYSIS",
    });
    const mock = new MockAIProvider();
    const generate = vi
      .fn(mock.generate.bind(mock))
      .mockRejectedValueOnce(new AiError("AI_RATE_LIMITED", undefined, true));
    const deps = { store, provider: { name: "synthetic", generate } };
    expect(await processNextResearchJob(tx, deps)).toBe(true);
    const waiting = await jobs.find(t.workspace.id, queued.id);
    expect(waiting).toMatchObject({
      status: "QUEUED",
      attempts: 1,
      failureCode: "AI_RATE_LIMITED",
    });
    expect(waiting!.availableAt.getTime()).toBeGreaterThan(Date.now());
    await tx.backgroundJob.update({
      where: { id: queued.id },
      data: { availableAt: new Date(Date.now() - 1000) },
    });
    expect(await processNextResearchJob(tx, deps)).toBe(true);
    expect(await jobs.find(t.workspace.id, queued.id)).toMatchObject({
      status: "SUCCEEDED",
      attempts: 2,
      failureCode: null,
    });
    const tasks = await store.listTasks(t.workspace.id, t.investigation.id);
    expect(tasks).toHaveLength(2);
    const first = tasks.find((task) => task.status === "FAILED")!;
    const completed = tasks.find((task) => task.status === "COMPLETED")!;
    expect(completed.parentTaskId).toBe(first.id);
    expect(first).toMatchObject({
      failureCode: "AI_RATE_LIMITED",
      usageUncertain: false,
      reservedTokens: 0,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await processNextResearchJob(tx, deps)).toBe(false);
  }));
it("recovers a captured result with expanded source sets without another provider request", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const jobs = new PrismaJobStore(tx);
    const store = new PrismaAIStore(tx);
    await jobs.enqueue(actor, "AI_TASK", randomUUID(), {
      investigationId: t.investigation.id,
      taskType: "PATTERN_ANALYSIS",
    });
    const job = await jobs.claim();
    if (!job) throw new Error("Missing job");
    const profile = AI_TASK_PROFILES.PATTERN_ANALYSIS;
    const task = await store.createTask({
      workspaceId: t.workspace.id,
      investigationId: t.investigation.id,
      taskType: "PATTERN_ANALYSIS",
      provider: "ANTHROPIC",
      model: "synthetic-test",
      promptTemplateId: profile.promptId!,
      promptVersion: "2",
      contextVersion: "test",
      idempotencyKey: `job:${job.id}`,
      requiredCapabilities: [...profile.requiredCapabilities],
      inputTokenBudget: profile.inputTokenBudget,
      outputTokenBudget: profile.outputTokenBudget,
      requestedBy: t.user.id,
      executionJobId: job.id,
      executorToken: job.leaseToken!,
    });
    const request = {
      taskType: "PATTERN_ANALYSIS" as const,
      model: "synthetic-test",
      system: "Synthetic controlled source",
      messages: [{ role: "user" as const, content: "Review supplied records." }],
      maxTokens: 1000,
      timeoutMs: 1000,
    };
    await store.updateTask(t.workspace.id, task.id, {
      status: "RUNNING",
      inputContext: {
        snapshotVersion: 1,
        request,
        sourceManifest: {
          observationIds: [],
          hypothesisIds: [],
          evidenceIds: [],
          summaryIds: [],
          messageIds: [],
          findingIds: [t.finding.id],
          decisionIds: [],
          knowledgeIds: [],
          historyIds: [],
        },
      },
    });
    const attempt = await store.startAttempt(t.workspace.id, task.id, 1, request, {
      jobId: job.id,
      token: job.leaseToken!,
    });
    const output = {
      patterns: [],
      claims: [
        {
          id: "claim-status",
          statement: "The supplied finding remains a draft.",
          basis: "OBSERVED",
          sources: [{ kind: "FINDING", id: t.finding.id, relationship: "SUPPORTS" }],
          confidence: "high",
          limitations: ["This is record metadata, not vulnerability confirmation."],
        },
      ],
      uncertaintyNotes: [],
    };
    await store.finishAttempt(t.workspace.id, attempt.id, {
      structured: output,
      text: "Synthetic response",
      usage: { inputTokens: 200, outputTokens: 100 },
      stopReason: "tool_use",
    });
    const generate = vi.fn().mockRejectedValue(new Error("Unexpected paid request"));
    const result = await executeAiJob(tx, { store, provider: { name: "test", generate } }, job);
    expect(result).toMatchObject({ recovered: true, taskId: task.id });
    expect(generate).not.toHaveBeenCalled();
    expect(await store.findTask(t.workspace.id, task.id)).toMatchObject({
      status: "COMPLETED",
      inputTokens: 200,
      outputTokens: 100,
      reservedTokens: 0,
    });
  }));
it("holds uncertain timeout usage and records reviewed reconciliation", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const store = new PrismaAIStore(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const result = await runAiTask(
      { store, provider: new MockAIProvider({ scenario: "timeout" }) },
      actor,
      {
        investigationId: t.investigation.id,
        taskType: "RECON_ANALYSIS",
        operationKey: randomUUID(),
      },
    );
    expect(result.ok).toBe(false);
    const task = (await store.listTasks(t.workspace.id, t.investigation.id))[0]!;
    expect(task).toMatchObject({ status: "TIMED_OUT", usageUncertain: true });
    expect(task.reservedTokens).toBeGreaterThan(0);
    const reconciled = await reconcileAiUsage(tx, actor, {
      taskId: task.id,
      inputTokens: 20,
      outputTokens: 0,
      providerReference: "Synthetic provider ledger fixture",
      rationale: "Verified this fixture's captured billed usage",
    });
    expect(reconciled.ok).toBe(true);
    expect(await store.findTask(t.workspace.id, task.id)).toMatchObject({
      usageUncertain: false,
      reservedTokens: 0,
      inputTokens: 20,
    });
    expect(
      await tx.auditLog.count({ where: { entityId: task.id, action: "AI_USAGE_RECONCILED" } }),
    ).toBe(1);
  }));
it("cancels an in-flight task and rejects its stale completion", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const jobs = new PrismaJobStore(tx);
    const store = new PrismaAIStore(tx);
    await jobs.enqueue(actor, "AI_TASK", randomUUID(), {
      investigationId: t.investigation.id,
      taskType: "RECON_ANALYSIS",
    });
    const job = await jobs.claim();
    if (!job) throw new Error("Missing job");
    let taskId: string | undefined;
    const provider = {
      name: "synthetic",
      async generate() {
        taskId = (await store.listTasks(t.workspace.id, t.investigation.id))[0]!.id;
        await jobs.cancel(actor, job.id);
        return {
          structured: {
            summary: "Test",
            knownInformation: [],
            unknownInformation: [],
            observations: [],
            recommendedActions: [],
            referencedObservationIds: [],
            referencedHypothesisIds: [],
            uncertaintyNotes: [],
          },
          text: "",
          usage: { inputTokens: 1, outputTokens: 1 },
          stopReason: "tool_use",
        };
      },
    };
    await runAiTask({ store, provider }, actor, {
      investigationId: t.investigation.id,
      taskType: "RECON_ANALYSIS",
      operationKey: `job:${job.id}`,
      executionLease: { jobId: job.id, token: job.leaseToken! },
    });
    expect(await store.findTask(t.workspace.id, taskId!)).toMatchObject({
      status: "CANCELLED",
      usageUncertain: true,
    });
    expect(
      await store.completeTask(
        t.workspace.id,
        taskId!,
        { executionJobId: job.id, executorToken: job.leaseToken! },
        {},
      ),
    ).toBeNull();
  }));
it("replays a chat operation without duplicate user turns or model calls", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const store = new PrismaAIStore(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id };
    const conversation = await store.createConversation({
      workspaceId: t.workspace.id,
      investigationId: t.investigation.id,
      title: "Replay",
      provider: "ANTHROPIC",
      model: "synthetic-test",
    });
    const provider = new MockAIProvider();
    const generate = vi.spyOn(provider, "generate");
    const key = randomUUID();
    const one = await sendChatMessage(
      { store, provider },
      actor,
      t.investigation.id,
      conversation.id,
      "Review the supplied observations",
      key,
    );
    const two = await sendChatMessage(
      { store, provider },
      actor,
      t.investigation.id,
      conversation.id,
      "Review the supplied observations",
      key,
    );
    expect(one.ok).toBe(true);
    expect(two.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await store.findConversation(t.workspace.id, conversation.id))?.messages).toHaveLength(
      2,
    );
  }));
it("fences an expired worker and fails abandoned AI work when lease retries are exhausted", () =>
  withRollback(client, async (tx) => {
    const t = await createTenancy(tx);
    const actor = { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" as const };
    const jobs = new PrismaJobStore(tx);
    const store = new PrismaAIStore(tx);
    const queued = await jobs.enqueue(actor, "AI_TASK", randomUUID(), {
      investigationId: t.investigation.id,
      taskType: "RECON_ANALYSIS",
    });
    const job = await jobs.claim();
    if (!job || job.id !== queued.id) throw new Error("Missing job");
    const profile = AI_TASK_PROFILES.RECON_ANALYSIS;
    const task = await store.createTask({
      workspaceId: t.workspace.id,
      investigationId: t.investigation.id,
      taskType: "RECON_ANALYSIS",
      provider: "ANTHROPIC",
      model: "synthetic-test",
      promptTemplateId: profile.promptId!,
      promptVersion: "2",
      contextVersion: "test",
      idempotencyKey: `job:${job.id}`,
      requiredCapabilities: [...profile.requiredCapabilities],
      inputTokenBudget: profile.inputTokenBudget,
      outputTokenBudget: profile.outputTokenBudget,
      requestedBy: t.user.id,
      executionJobId: job.id,
      executorToken: job.leaseToken!,
    });
    await store.updateTask(t.workspace.id, task.id, { status: "RUNNING" });
    await store.startAttempt(
      t.workspace.id,
      task.id,
      1,
      {
        taskType: "RECON_ANALYSIS",
        model: "synthetic-test",
        system: "Synthetic source",
        messages: [{ role: "user", content: "Review supplied records" }],
        maxTokens: 1000,
        timeoutMs: 1000,
      },
      { jobId: job.id, token: job.leaseToken! },
    );
    await tx.backgroundJob.update({
      where: { id: job.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    expect(await jobs.heartbeat(job)).toBe(false);
    expect(await jobs.finish(job, { result: "stale" })).toBe(false);
    expect(await jobs.fail(job, "STALE_WORKER", false)).toBe(false);
    const replacement = await jobs.claim();
    expect(replacement?.leaseToken).not.toBe(job.leaseToken);
    expect(
      await store.completeTask(
        t.workspace.id,
        task.id,
        { executionJobId: job.id, executorToken: job.leaseToken! },
        {},
      ),
    ).toBeNull();
    await tx.backgroundJob.update({
      where: { id: job.id },
      data: { attempts: 3, leaseUntil: new Date(Date.now() - 1000) },
    });
    expect(await jobs.claim()).toBeNull();
    expect(await jobs.find(t.workspace.id, job.id)).toMatchObject({
      status: "FAILED",
      failureCode: "LEASE_RETRIES_EXHAUSTED",
    });
    const abandoned = await store.findTask(t.workspace.id, task.id);
    expect(abandoned).toMatchObject({ status: "FAILED", usageUncertain: true });
    expect(abandoned?.reservedTokens).toBeGreaterThan(0);
  }));
