import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { createAIProvider, aiModelOverrides, createAiRuntime } from "./provider-factory";
import { PrismaAIStore } from "./prisma-ai-store";
import type { AiServiceDependencies } from "../application/task-service";
export function createAiDependencies(db: Prisma.TransactionClient): AiServiceDependencies {
  return {
    store: new PrismaAIStore(db),
    provider: createAIProvider(),
    runtime: createAiRuntime(db),
    modelOverrides: aiModelOverrides(),
    evidenceStorage: createEvidenceStorage(),
    enqueue: (actor, input, key) =>
      new PrismaJobStore(db).enqueue({ ...actor, role: "RESEARCHER" }, "AI_TASK", key, {
        investigationId: input.investigationId,
        conversationId: input.conversationId,
        taskType: input.taskType,
        instruction: input.instruction,
      }),
  };
}
