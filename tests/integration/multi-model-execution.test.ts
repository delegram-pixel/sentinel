import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { executeAiJob } from "@/modules/ai/infrastructure/ai-job-executor";
import { ProviderQuotaStore } from "@/modules/ai/infrastructure/groq-quota-store";
import { JobContinuation } from "@/modules/tasks/domain/job";
import type { JobRow } from "@/modules/tasks";
import { MockAIProvider } from "@/modules/ai/application/mock-provider";
import type {
  AIProvider,
  AiProviderRequest,
  AiProviderResponse,
} from "@/modules/ai/application/provider";
import type { AiServiceDependencies } from "@/modules/ai/application/task-service";
import type { AiRuntime } from "@/modules/ai/application/model-router";
import { DEFAULT_MODEL_REGISTRY, routingConfigSchema } from "@/modules/ai/domain/model-registry";
import { AiError } from "@/modules/ai/domain/ai-errors";
import { estimateTokens } from "@/modules/ai/domain/ai-budgets";
import { queueChatMessage } from "@/modules/ai/application/request-service";
const client = createTestClient();
afterAll(() => client.$disconnect());

async function drain(tx: Prisma.TransactionClient, deps: AiServiceDependencies, job: JobRow) {
  for (let step = 0; step < 40; step++) {
    try {
      return await executeAiJob(tx, deps, job);
    } catch (error) {
      if (!(error instanceof JobContinuation)) throw error;
      // Advance only local test scheduling, never sleep or send a real request.
      await tx.aIProviderQuota.updateMany({
        data: { nextRequestAt: new Date(0), cooldownUntil: null },
      });
    }
  }
  throw new Error("The workflow did not converge.");
}
async function jobFor(
  tx: Prisma.TransactionClient,
  t: Awaited<ReturnType<typeof createTenancy>>,
  workflow?: string,
  taskType = "PATTERN_ANALYSIS",
) {
  const jobs = new PrismaJobStore(tx);
  await jobs.enqueue(
    { workspaceId: t.workspace.id, userId: t.user.id, role: "OWNER" },
    "AI_TASK",
    randomUUID(),
    { investigationId: t.investigation.id, taskType, workflow },
  );
  const job = await jobs.claim();
  if (!job) throw new Error("Missing job");
  return job;
}
function syntheticProvider(
  findingId: string,
  key: string,
  calls: AiProviderRequest[],
  failure?: () => AiError | undefined,
): AIProvider {
  return {
    name: key,
    async generate(request) {
      calls.push(request);
      const error = failure?.();
      if (error) throw error;
      let structured: unknown;
      if (request.purpose === "BATCH_REVIEW" || request.purpose === "BATCH_MERGE") {
        const data = JSON.parse(request.messages.at(-1)!.content).untrustedBatch;
        const sourceIds = Array.isArray(data)
          ? [...new Set(data.flatMap((note) => note.sourceIds))]
          : data.sourceIds;
        structured = {
          summary: "The source records supplied research only.",
          sourceIds,
          contradictions: [],
          missingInformation: [],
        };
      } else if (request.purpose === "SOURCE_CHECK") structured = { problems: [] };
      else if (request.taskType === "RESEARCH_CONCLUSION_REVIEW") {
        const sources = [
          ...request.system.matchAll(/<untrusted_data[^>]*>([\s\S]*?)<\/untrusted_data>/g),
        ]
          .flatMap((match) => {
            try {
              return [JSON.parse(match[1]!)];
            } catch {
              return [];
            }
          })
          .filter((value) => value.sourceType === "AI_TASK" && value.output?.claims);
        structured = {
          reviews: sources.flatMap((source) =>
            source.output.claims.map((claim: { id: string }) => ({
              taskId: source.id,
              claimId: claim.id,
              verdict: "INSUFFICIENT",
              reasoning: "The claim needs human interpretation of its evidence.",
              sources: [],
            })),
          ),
          conclusions: [],
          missingInformation: ["Human evidence assessment is required."],
        };
      } else {
        structured = (await new MockAIProvider().generate(request)).structured;
        const schema = request.structuredOutput?.schema as { properties?: { analysis?: unknown } };
        if (schema?.properties?.analysis)
          structured = {
            version: 1,
            analysis: (structured as { analysis?: unknown })?.analysis ?? structured,
            claims: [
              {
                id: "claim-status",
                statement:
                  key === "research"
                    ? "PRIMARY_UNIQUE: the finding is a draft."
                    : "SECONDARY_UNIQUE: the finding is a draft.",
                basis: "OBSERVED",
                confidence: "low",
                limitations: ["Not vulnerability confirmation."],
                sources: [{ kind: "FINDING", id: findingId, relationship: "SUPPORTS" }],
              },
            ],
            conclusions: [
              {
                subject: { kind: "FINDING", id: findingId },
                conclusion: key === "research" ? "SUPPORTED" : "UNSUPPORTED",
                reasoning: "Synthetic opposing interpretation.",
                sources: [{ kind: "FINDING", id: findingId, relationship: "SUPPORTS" }],
              },
            ],
          };
      }
      return {
        text: JSON.stringify(structured),
        structured,
        model: request.model,
        host: "synthetic-only",
        usage: { inputTokens: 100, outputTokens: 50 },
        stopReason: "stop",
      } satisfies AiProviderResponse;
    },
  };
}
function syntheticRuntime(
  findingId: string,
  calls: AiProviderRequest[],
  failure?: (key: string) => AiError | undefined,
): AiRuntime {
  return {
    models: DEFAULT_MODEL_REGISTRY.map((m) => ({
      ...m,
      free: true,
      pricing: { input: 0, output: 0 },
    })),
    config: routingConfigSchema.parse({}),
    providerFor: (model) =>
      syntheticProvider(findingId, model.key, calls, () => failure?.(model.key)),
    privacyApproved: () => true,
    allowPaid: false,
    maxTaskCostUsd: 0,
    maxDailyCostUsd: 0,
  };
}
describe("durable multi-model execution", () => {
  it("collaborates blindly, preserves conflicts, records identities and leaves finding status authoritative", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const store = new PrismaAIStore(tx);
      const result = await drain(
        tx,
        { store, provider: new MockAIProvider(), runtime: syntheticRuntime(t.finding.id, calls) },
        await jobFor(tx, t, "COLLABORATIVE_RESEARCH"),
      );
      expect(result.status).toBe("COMPLETE");
      expect(calls).toHaveLength(3);
      expect(calls[1]!.system).not.toContain("PRIMARY_UNIQUE");
      expect(calls[2]!.system).toContain("PRIMARY_UNIQUE");
      const run = await tx.aICollaboration.findUniqueOrThrow({
        where: { id: result.collaborationId },
      });
      expect(run.result).toMatchObject({
        requiresHumanReview: true,
        conflicts: [{ subject: `FINDING:${t.finding.id}` }],
      });
      const tasks = await store.listTasks(t.workspace.id, t.investigation.id);
      expect(
        tasks
          .filter((task) => task.taskType === "PATTERN_ANALYSIS")
          .map((task) => task.contextVersion)[0],
      ).toBe(
        tasks
          .filter((task) => task.taskType === "PATTERN_ANALYSIS")
          .map((task) => task.contextVersion)[1],
      );
      expect((await tx.finding.findUniqueOrThrow({ where: { id: t.finding.id } })).status).toBe(
        "DRAFT",
      );
      expect(
        await tx.aIExecutionAttempt.count({
          where: { task: { collaborationId: run.id }, returnedModel: { not: null } },
        }),
      ).toBe(3);
      expect(tasks.every((task) => task.inputTokens === 100 && task.outputTokens === 50)).toBe(
        true,
      );
    }));
  it("retains incomplete review when an independent reviewer has no eligible model", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const runtime = syntheticRuntime(t.finding.id, calls);
      runtime.config.roles.REVIEW = ["missing-reviewer"];
      const result = await drain(
        tx,
        { store: new PrismaAIStore(tx), provider: new MockAIProvider(), runtime },
        await jobFor(tx, t, "COLLABORATIVE_RESEARCH"),
      );
      expect(result.status).toBe("INCOMPLETE");
      expect(calls).toHaveLength(2);
      const run = await tx.aICollaboration.findUniqueOrThrow({
        where: { id: result.collaborationId },
      });
      expect(run.result).toMatchObject({
        failures: [{ stage: "REVIEW", code: "AI_NO_COMPATIBLE_MODEL" }],
      });
    }));
  it("runs only one model for ordinary tasks and never repeats a completed operation", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const deps = {
        store: new PrismaAIStore(tx),
        provider: new MockAIProvider(),
        runtime: syntheticRuntime(t.finding.id, calls),
      };
      const job = await jobFor(tx, t);
      await drain(tx, deps, job);
      await executeAiJob(tx, deps, job);
      expect(calls).toHaveLength(1);
      expect(await tx.aICollaboration.count({ where: { jobId: job.id } })).toBe(0);
    }));
  it("retries explicit rejections, then records compatible fallback with the original context", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const runtime = syntheticRuntime(t.finding.id, calls, (key) =>
        key === "research" ? new AiError("AI_RATE_LIMITED", undefined, true, 1) : undefined,
      );
      const store = new PrismaAIStore(tx);
      const result = await drain(
        tx,
        { store, provider: new MockAIProvider(), runtime },
        await jobFor(tx, t),
      );
      const attempts = await tx.aIExecutionAttempt.findMany({
        where: { taskId: result.taskId },
        orderBy: { sequence: "asc" },
      });
      expect(attempts).toHaveLength(4);
      expect(attempts[3]!.fallbackFrom).toBe("gemini-3.8-flash");
      expect(attempts.slice(0, 3).map((a) => a.retryCount)).toEqual([0, 1, 2]);
      expect(calls[3]!.system).toBe(calls[0]!.system);
      expect(await store.findTask(t.workspace.id, result.taskId!)).toMatchObject({
        provider: "OPENROUTER",
        model: "qwen/qwen3.8-27b",
        usageUncertain: false,
      });
    }));
  it("does not repeat or fall back after uncertain delivery", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const deps = {
        store: new PrismaAIStore(tx),
        provider: new MockAIProvider(),
        runtime: syntheticRuntime(
          t.finding.id,
          calls,
          () => new AiError("AI_TIMEOUT", undefined, true),
        ),
      };
      const job = await jobFor(tx, t);
      await expect(drain(tx, deps, job)).rejects.toMatchObject({ code: "AI_TIMEOUT" });
      expect(calls).toHaveLength(1);
      const tasks = await deps.store.listTasks(t.workspace.id, t.investigation.id);
      expect(tasks[0]).toMatchObject({ usageUncertain: true, status: "TIMED_OUT" });
      expect(tasks[0]!.reservedTokens).toBeGreaterThan(0);
    }));
  it("wires Groq batching, verifies sources, accounts every call and recovers without reissuing calls", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const provider: AIProvider = {
        ...syntheticProvider(t.finding.id, "GROQ", calls),
        executionPolicy: {
          maxRequestTokens: 7000,
          intermediateMaxTokens: 1500,
          countInputTokens: (request) =>
            estimateTokens(
              request.system +
                JSON.stringify(request.messages) +
                JSON.stringify(request.structuredOutput),
            ) + 128,
        },
      };
      const deps = {
        store: new PrismaAIStore(tx),
        provider,
        modelOverrides: { provider: "GROQ" as const },
      };
      const job = await jobFor(tx, t);
      const result = await drain(tx, deps, job);
      expect(calls.some((call) => call.purpose === "BATCH_REVIEW")).toBe(true);
      expect(calls.some((call) => call.purpose === "SOURCE_CHECK")).toBe(true);
      const before = calls.length;
      await executeAiJob(tx, deps, job);
      expect(calls).toHaveLength(before);
      expect(await deps.store.findTask(t.workspace.id, result.taskId!)).toMatchObject({
        inputTokens: before * 100,
        outputTokens: before * 50,
        estimatedCostUsd: 0,
      });
    }));
  it("serializes account-wide quota buckets across OpenRouter models", () =>
    withRollback(client, async (tx) => {
      const quota = new ProviderQuotaStore(
        tx,
        { tokensPerMinute: 1000, tokensPerDay: 1500, requestsPerDay: 2 },
        () => new Date("2026-11-11"),
        "OPENROUTER",
      );
      expect((await quota.reserve("", 900)).ready).toBe(true);
      expect((await quota.reserve("", 900)).ready).toBe(false);
      await expect(quota.reserve("", 1001)).rejects.toMatchObject({ code: "AI_CONTEXT_TOO_LARGE" });
    }));
  it("queues chat idempotently and rejects a conversation from another workspace", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const foreign = await createTenancy(tx);
      const store = new PrismaAIStore(tx);
      const jobs = new PrismaJobStore(tx);
      const conversation = await store.createConversation({
        workspaceId: t.workspace.id,
        investigationId: t.investigation.id,
        title: "Queued research",
        provider: "GROQ",
        model: "openai/gpt-oss-120b",
      });
      const actor = { workspaceId: t.workspace.id, userId: t.user.id };
      const deps: AiServiceDependencies = {
        store,
        provider: new MockAIProvider(),
        runtime: syntheticRuntime(t.finding.id, []),
        enqueue: (a, input, key) =>
          jobs.enqueue({ ...a, role: "OWNER" }, "AI_TASK", key, {
            investigationId: input.investigationId,
            conversationId: input.conversationId,
            taskType: input.taskType,
            instruction: input.instruction,
          }),
      };
      const key = randomUUID();
      const first = await queueChatMessage(
        deps,
        actor,
        t.investigation.id,
        conversation.id,
        "What is missing?",
        key,
      );
      const second = await queueChatMessage(
        deps,
        actor,
        t.investigation.id,
        conversation.id,
        "What is missing?",
        key,
      );
      expect(first).toEqual(second);
      expect(first.ok).toBe(true);
      expect(
        (await store.findConversation(t.workspace.id, conversation.id))!.messages,
      ).toHaveLength(1);
      const denied = await queueChatMessage(
        deps,
        { workspaceId: foreign.workspace.id, userId: foreign.user.id },
        foreign.investigation.id,
        conversation.id,
        "Question",
        randomUUID(),
      );
      expect(denied.ok).toBe(false);
    }));
  it("runs the configured development mock through every collaboration stage", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const runtime = syntheticRuntime(t.finding.id, []);
      runtime.providerFor = () => new MockAIProvider();
      const result = await drain(
        tx,
        { store: new PrismaAIStore(tx), provider: new MockAIProvider(), runtime },
        await jobFor(tx, t, "COLLABORATIVE_RESEARCH"),
      );
      expect(result.status).toBe("COMPLETE");
    }));
  it("resumes interrupted batch progress from captured responses without sending the batch twice", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const calls: AiProviderRequest[] = [];
      const provider: AIProvider = {
        ...syntheticProvider(t.finding.id, "GROQ", calls),
        executionPolicy: {
          maxRequestTokens: 7000,
          intermediateMaxTokens: 1500,
          countInputTokens: (r) =>
            estimateTokens(
              r.system + JSON.stringify(r.messages) + JSON.stringify(r.structuredOutput),
            ) + 128,
        },
      };
      const store = new PrismaAIStore(tx);
      const job = await jobFor(tx, t);
      const deps = { store, provider, modelOverrides: { provider: "GROQ" as const } };
      const original = store.finishAttempt.bind(store);
      const interrupted = vi
        .spyOn(store, "finishAttempt")
        .mockImplementationOnce(async (...args) => {
          await original(...args);
          throw new Error("Synthetic crash after durable response capture");
        });
      await expect(executeAiJob(tx, deps, job)).rejects.toThrow("Synthetic crash");
      expect(calls).toHaveLength(1);
      interrupted.mockRestore();
      const result = await drain(tx, deps, job);
      expect(calls.filter((call) => call.purpose === "BATCH_REVIEW")).toHaveLength(1);
      expect(await store.findTask(t.workspace.id, result.taskId!)).toMatchObject({
        status: "COMPLETED",
        usageUncertain: false,
      });
    }));
  it("limits schema correction to one attempt and retains the original request snapshot", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      let calls = 0;
      const runtime = syntheticRuntime(t.finding.id, []);
      runtime.providerFor = () => ({
        name: "invalid",
        async generate(request) {
          calls++;
          return {
            model: request.model,
            structured: { patterns: "invalid" },
            text: "{}",
            usage: { inputTokens: 100, outputTokens: 10 },
            stopReason: "stop",
          };
        },
      });
      const store = new PrismaAIStore(tx);
      await expect(
        drain(tx, { store, provider: new MockAIProvider(), runtime }, await jobFor(tx, t)),
      ).rejects.toMatchObject({ code: "AI_OUTPUT_VALIDATION_FAILED" });
      expect(calls).toBe(2);
      const task = (await store.listTasks(t.workspace.id, t.investigation.id))[0]!;
      expect(task).toMatchObject({
        inputTokens: 200,
        outputTokens: 20,
        reservedTokens: 0,
        usageUncertain: false,
        output: null,
      });
      expect(JSON.stringify(task.inputContext)).not.toContain("Correct these validation errors");
      expect(JSON.stringify(task.executionState)).toContain("Correct these validation errors");
    }));
  it("rejects results when an evidence version changes during generation", () =>
    withRollback(client, async (tx) => {
      const t = await createTenancy(tx);
      const evidence = await tx.evidence.create({
        data: {
          workspaceId: t.workspace.id,
          investigationId: t.investigation.id,
          title: "Synthetic evidence",
          fileName: "fixture.log",
          evidenceType: "LOG",
          uploadedBy: t.user.id,
          storageKey: "synthetic/only",
          checksum: "a".repeat(64),
          mimeType: "text/plain",
          fileSize: 12,
          redactionStatus: "VERIFIED_SAFE",
          redactionMethod: "HUMAN_REVIEW",
          uploadValidatedAt: t.now,
          activatedAt: t.now,
        },
      });
      const runtime = syntheticRuntime(t.finding.id, []);
      runtime.providerFor = () => ({
        name: "synthetic",
        async generate(request) {
          await tx.evidence.update({
            where: { id: evidence.id },
            data: { version: { increment: 1 } },
          });
          return new MockAIProvider().generate(request);
        },
      });
      const store = new PrismaAIStore(tx);
      await expect(
        drain(tx, { store, provider: new MockAIProvider(), runtime }, await jobFor(tx, t)),
      ).rejects.toMatchObject({ code: "AI_PERMISSION_DENIED" });
      expect((await store.listTasks(t.workspace.id, t.investigation.id))[0]).toMatchObject({
        status: "FAILED",
        output: null,
        reservedTokens: 0,
      });
    }));
});
