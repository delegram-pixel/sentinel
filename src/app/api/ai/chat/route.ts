import { z } from "zod";

import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { sendChatMessage, type AiServiceDependencies } from "@/modules/ai/application/task-service";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { aiModelOverrides, createAIProvider } from "@/modules/ai/infrastructure/provider-factory";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";

const chatRequestSchema = z.object({
  investigationId: z.string().uuid(),
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(8_000),
});

function dependencies(): AiServiceDependencies {
  return {
    store: new PrismaAIStore(getDb()),
    provider: createAIProvider(),
    evidenceStorage: createEvidenceStorage(),
    modelOverrides: aiModelOverrides(),
  };
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSessionContext();
  const payload = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "The chat request is invalid." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", conversationId: parsed.data.conversationId });

      try {
        const result = await sendChatMessage(
          dependencies(),
          { userId: session.user.id, workspaceId: session.workspace.id },
          parsed.data.investigationId,
          parsed.data.conversationId,
          parsed.data.message,
        );

        if (!result.ok) {
          send({ type: "error", code: result.code, message: result.message });
        } else {
          send({
            type: "complete",
            conversationId: result.value.conversation.id,
            taskId: result.value.task.id,
            messageId: result.value.message.id,
          });
        }
      } catch {
        send({
          type: "error",
          code: "AI_PROVIDER_ERROR",
          message: "The AI request could not be completed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
