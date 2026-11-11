import { randomUUID } from "node:crypto";
import { failure, type DomainResult } from "@/modules/shared/domain/result";
import { aiErrorFromUnknown } from "../domain/ai-errors";
import { runAiTask, type AiServiceDependencies, type AiTaskInput } from "./task-service";
type Actor = { workspaceId: string; userId: string };
export function requiresAiQueue(deps: AiServiceDependencies): boolean {
  return Boolean(deps.runtime || deps.provider.executionPolicy);
}
export async function requestAiAnalysis(
  deps: AiServiceDependencies,
  actor: Actor,
  input: AiTaskInput,
): Promise<DomainResult<{ taskId?: string; jobId?: string }>> {
  if (requiresAiQueue(deps) && deps.enqueue) {
    try {
      return {
        ok: true,
        value: { jobId: (await deps.enqueue(actor, input, input.operationKey ?? randomUUID())).id },
      };
    } catch (error) {
      const e = aiErrorFromUnknown(error);
      return failure(e.code, e.message);
    }
  }
  const result = await runAiTask(deps, actor, input);
  return result.ok ? { ok: true, value: { taskId: result.value.task.id } } : result;
}
export async function queueChatMessage(
  deps: AiServiceDependencies,
  actor: Actor,
  investigationId: string,
  conversationId: string,
  message: string,
  key: string,
) {
  const conversation = await deps.store.findConversation(actor.workspaceId, conversationId);
  if (!conversation || conversation.investigationId !== investigationId)
    return failure("AI_CONVERSATION_NOT_FOUND", "That conversation is unavailable.");
  if (!message.trim() || message.length > 8000 || key.length < 8 || key.length > 160)
    return failure("VALIDATION_FAILED", "The chat request is invalid.");
  try {
    await deps.store.appendMessage({
      conversationId,
      actor,
      operationKey: `chat:${actor.userId}:${key}`,
      role: "USER",
      content: message.trim(),
    });
    return requestAiAnalysis(deps, actor, {
      investigationId,
      conversationId,
      taskType: "ATTACK_SURFACE_ANALYSIS",
      instruction: message.trim(),
      operationKey: `chat:${actor.userId}:${key}`,
    });
  } catch (error) {
    const e = aiErrorFromUnknown(error);
    return failure(e.code, e.message);
  }
}
