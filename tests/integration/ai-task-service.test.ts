import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { MockAIProvider } from "@/modules/ai/application/mock-provider";
import type { AiServiceDependencies } from "@/modules/ai/application/task-service";
import {
  createConversation,
  runAiTask,
  sendChatMessage,
} from "@/modules/ai/application/task-service";
import type { AIProvider } from "@/modules/ai/application/provider";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

function dependencies(
  store: PrismaAIStore,
  provider: AIProvider = new MockAIProvider(),
): AiServiceDependencies {
  return {
    store,
    provider,
    modelOverrides: {},
    idempotencyKey: () => randomUUID(),
  };
}

async function createAiConversation(
  store: PrismaAIStore,
  workspaceId: string,
  investigationId: string,
) {
  return store.createConversation({
    workspaceId,
    investigationId,
    title: "AI investigation",
    provider: "ANTHROPIC",
    model: "claude-sonnet-4-5",
  });
}

describe("AI task service", () => {
  it("persists a guided chat turn and the validated assistant response", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };
      const conversation = await createAiConversation(
        store,
        tenancy.workspace.id,
        tenancy.investigation.id,
      );

      const result = await sendChatMessage(
        dependencies(store),
        actor,
        tenancy.investigation.id,
        conversation.id,
        "What should we validate next?",
      );

      expect(result.ok).toBe(true);

      const detail = await store.findConversation(tenancy.workspace.id, conversation.id);
      expect(detail?.messages.map((message) => message.role)).toEqual(["USER", "ASSISTANT"]);

      const tasks = await store.listTasks(tenancy.workspace.id, tenancy.investigation.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        taskType: "ATTACK_SURFACE_ANALYSIS",
        status: "COMPLETED",
        assignedRole: "RESEARCH_ASSISTANT",
        promptTemplateId: "investigation.chat",
        model: "claude-sonnet-4-5",
      });
      expect(tasks[0]?.contextVersion).toMatch(/^[a-f0-9]{64}$/);
      expect(tasks[0]?.inputTokens).toBeGreaterThan(0);
      expect(tasks[0]?.outputTokens).toBeGreaterThan(0);

      const events = await store.listTaskEvents(tenancy.workspace.id, tasks[0]!.id);
      expect(events.map((event) => event.eventType)).toEqual(
        expect.arrayContaining([
          "TASK_CREATED",
          "PERMISSION_CHECK",
          "CONTEXT_ASSEMBLY",
          "TASK_ASSIGNMENT",
          "AI_PROCESSING",
          "OUTPUT_VALIDATION",
          "RESULT_STORAGE",
          "TASK_COMPLETED",
        ]),
      );
    });
  });

  it("adds approved text evidence to AI context and records its version", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);
      const textEvidence = await tx.evidence.create({
        data: {
          workspaceId: tenancy.workspace.id,
          investigationId: tenancy.investigation.id,
          evidenceType: "LOG",
          title: "Export proxy log",
          fileName: "export.log",
          storageKey: `evidence/${tenancy.workspace.id}/${tenancy.investigation.id}/export-log-v2`,
          mimeType: "text/plain",
          fileSize: 128,
          checksum: "d".repeat(64),
          redactionStatus: "REDACTED",
          uploadValidatedAt: tenancy.now,
          redactionMethod: "HUMAN_REVIEW",
          uploadedBy: tenancy.user.id,
          activatedAt: tenancy.now,
          version: 2,
        },
      });
      const binaryEvidence = await tx.evidence.create({
        data: {
          workspaceId: tenancy.workspace.id,
          investigationId: tenancy.investigation.id,
          evidenceType: "SCREENSHOT",
          title: "Export response screenshot",
          fileName: "export.png",
          storageKey: `evidence/${tenancy.workspace.id}/${tenancy.investigation.id}/export-v1`,
          mimeType: "image/png",
          fileSize: 2048,
          checksum: "e".repeat(64),
          redactionStatus: "VERIFIED_SAFE",
          uploadValidatedAt: tenancy.now,
          redactionMethod: "HUMAN_REVIEW",
          uploadedBy: tenancy.user.id,
          activatedAt: tenancy.now,
        },
      });
      const requestedKeys: string[] = [];
      let capturedSystem = "";
      const provider: AIProvider = {
        name: "MOCK",
        async generate(request) {
          capturedSystem = request.system;
          return new MockAIProvider().generate(request);
        },
      };

      const result = await runAiTask(
        {
          ...dependencies(store, provider),
          evidenceStorage: {
            async getObject(key) {
              requestedKeys.push(key);

              if (key === textEvidence.storageKey) {
                return {
                  body: Buffer.from("GET /account/export HTTP/1.1\nAuthorization: Bearer redacted"),
                  contentType: "text/plain",
                };
              }

              return null;
            },
          },
        },
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        { investigationId: tenancy.investigation.id, taskType: "RECON_ANALYSIS" },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(requestedKeys).toEqual([textEvidence.storageKey]);
      expect(capturedSystem).toContain(textEvidence.id);
      expect(capturedSystem).toContain("GET /account/export");
      expect(capturedSystem).toContain(binaryEvidence.id);
      expect(capturedSystem).toContain("No text content is included");
      expect(result.value.task.inputContext).toMatchObject({
        included: { evidence: 2 },
        evidence: expect.arrayContaining([
          { id: textEvidence.id, version: 2 },
          { id: binaryEvidence.id, version: 1 },
        ]),
      });
    });
  });

  it("keeps conversations, contexts, and tasks inside the workspace", async () => {
    await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);
      const store = new PrismaAIStore(tx);
      const conversation = await createAiConversation(
        store,
        own.workspace.id,
        own.investigation.id,
      );

      expect(await store.findConversation(other.workspace.id, conversation.id)).toBeNull();
      expect(await store.loadContext(other.workspace.id, own.investigation.id)).toBeNull();

      const result = await runAiTask(
        dependencies(store),
        { userId: other.user.id, workspaceId: other.workspace.id },
        { investigationId: own.investigation.id, taskType: "RECON_ANALYSIS" },
      );

      expect(result).toMatchObject({ ok: false, code: "AI_INVESTIGATION_NOT_FOUND" });
    });
  });

  it("fails closed before the provider call when the daily budget is exhausted", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);
      const actor = { userId: tenancy.user.id, workspaceId: tenancy.workspace.id };
      const conversation = await createAiConversation(
        store,
        tenancy.workspace.id,
        tenancy.investigation.id,
      );

      await tx.aITask.create({
        data: {
          workspaceId: tenancy.workspace.id,
          investigationId: tenancy.investigation.id,
          conversationId: conversation.id,
          taskType: "RECON_ANALYSIS",
          status: "COMPLETED",
          provider: "ANTHROPIC",
          model: "claude-sonnet-4-5",
          promptTemplateId: "recon.analysis",
          promptVersion: "1",
          contextVersion: "seed",
          idempotencyKey: randomUUID(),
          inputTokenBudget: 40_000,
          outputTokenBudget: 3_000,
          inputTokens: 250_000,
          outputTokens: 0,
          requestedBy: tenancy.user.id,
        },
      });

      const result = await sendChatMessage(
        dependencies(store),
        actor,
        tenancy.investigation.id,
        conversation.id,
        "Continue the analysis.",
      );

      expect(result).toMatchObject({ ok: false, code: "AI_BUDGET_EXCEEDED" });

      const tasks = await store.listTasks(tenancy.workspace.id, tenancy.investigation.id);
      expect(tasks[0]).toMatchObject({
        status: "FAILED",
        failureCode: "AI_BUDGET_EXCEEDED",
      });
    });
  });

  it("marks a task failed when structured output cannot be validated", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);
      const conversation = await createAiConversation(
        store,
        tenancy.workspace.id,
        tenancy.investigation.id,
      );

      const result = await runAiTask(
        dependencies(store, new MockAIProvider({ scenario: "schema_error" })),
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        {
          investigationId: tenancy.investigation.id,
          conversationId: conversation.id,
          taskType: "HYPOTHESIS_GENERATION",
        },
      );

      expect(result).toMatchObject({ ok: false, code: "AI_OUTPUT_VALIDATION_FAILED" });

      const tasks = await store.listTasks(tenancy.workspace.id, tenancy.investigation.id);
      expect(tasks[0]).toMatchObject({
        status: "FAILED",
        failureCode: "AI_OUTPUT_VALIDATION_FAILED",
      });

      const detail = await store.findConversation(tenancy.workspace.id, conversation.id);
      expect(detail?.messages).toHaveLength(0);
    });
  });

  it("rejects references to records that were not supplied in context", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);

      const result = await runAiTask(
        dependencies(store, new MockAIProvider({ scenario: "unknown_reference" })),
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        {
          investigationId: tenancy.investigation.id,
          taskType: "HYPOTHESIS_GENERATION",
        },
      );

      expect(result).toMatchObject({ ok: false, code: "AI_OUTPUT_VALIDATION_FAILED" });
    });
  });

  it("records a provider timeout as TIMED_OUT", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);

      const result = await runAiTask(
        dependencies(store, new MockAIProvider({ scenario: "timeout" })),
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        {
          investigationId: tenancy.investigation.id,
          taskType: "RECON_ANALYSIS",
        },
      );

      expect(result).toMatchObject({ ok: false, code: "AI_TIMEOUT" });

      const tasks = await store.listTasks(tenancy.workspace.id, tenancy.investigation.id);
      expect(tasks[0]).toMatchObject({
        status: "TIMED_OUT",
        failureCode: "AI_TIMEOUT",
      });
      expect(tasks[0]?.completedAt).not.toBeNull();
    });
  });

  it("persists an AI session summary with task provenance", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);

      const result = await runAiTask(
        dependencies(store),
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        {
          investigationId: tenancy.investigation.id,
          taskType: "SESSION_SUMMARY",
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.task).toMatchObject({
        status: "COMPLETED",
        taskType: "SESSION_SUMMARY",
        model: "claude-haiku-4-5",
      });

      const summary = await tx.sessionSummary.findFirst({
        where: { investigationId: tenancy.investigation.id, generatedByType: "AI" },
      });

      expect(summary).toMatchObject({
        generatedByType: "AI",
        model: "claude-haiku-4-5",
        promptVersion: "1",
        sourceTaskId: result.value.task.id,
      });
      expect(summary?.summary.length).toBeGreaterThan(0);

      const audit = await tx.auditLog.findFirst({
        where: {
          workspaceId: tenancy.workspace.id,
          action: "SESSION_SUMMARY_CREATED",
          entityId: summary?.id,
        },
      });
      expect(audit).not.toBeNull();
    });
  });

  it("refuses to run AI tasks against an archived investigation", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaAIStore(tx);

      await tx.investigation.update({
        where: { id: tenancy.investigation.id },
        data: { status: "ARCHIVED" },
      });

      const result = await runAiTask(
        dependencies(store),
        { userId: tenancy.user.id, workspaceId: tenancy.workspace.id },
        {
          investigationId: tenancy.investigation.id,
          taskType: "RECON_ANALYSIS",
        },
      );

      expect(result).toMatchObject({ ok: false, code: "AI_PERMISSION_DENIED" });
      expect(await store.listTasks(tenancy.workspace.id, tenancy.investigation.id)).toHaveLength(0);
    });
  });

  it("refuses to create a conversation in another workspace or an archived investigation", async () => {
    await withRollback(client, async (tx) => {
      const own = await createTenancy(tx);
      const other = await createTenancy(tx);
      const store = new PrismaAIStore(tx);

      const foreign = await createConversation(
        dependencies(store),
        { userId: other.user.id, workspaceId: other.workspace.id },
        { investigationId: own.investigation.id, title: "Foreign" },
      );
      expect(foreign).toMatchObject({ ok: false, code: "AI_INVESTIGATION_NOT_FOUND" });

      await tx.investigation.update({
        where: { id: own.investigation.id },
        data: { status: "ARCHIVED" },
      });

      const archived = await createConversation(
        dependencies(store),
        { userId: own.user.id, workspaceId: own.workspace.id },
        { investigationId: own.investigation.id, title: "Archived" },
      );
      expect(archived).toMatchObject({ ok: false, code: "AI_PERMISSION_DENIED" });
    });
  });
});
