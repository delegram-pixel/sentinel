import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import { aiSessionModeSchema, type AiSessionStore } from "../application/session-service";
export class PrismaAiSessionStore implements AiSessionStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  changeMode(actor: ResearchActor, input: z.infer<typeof aiSessionModeSchema>) {
    return this.db.$transaction(async (tx) => {
      const conversation = await tx.aIConversation.findFirst({
        where: { id: input.conversationId, workspaceId: actor.workspaceId },
        select: { investigationId: true },
      });
      if (!conversation)
        throw new ResearchOperationError("NOT_FOUND", "The research session is unavailable.");
      await lockResearchInvestigation(tx, actor, conversation.investigationId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "AIConversation" WHERE id = ${input.conversationId}::uuid FOR UPDATE`,
      );
      const row = await tx.aIConversation.findUniqueOrThrow({
        where: { id: input.conversationId },
      });
      if (row.status !== "ACTIVE" || (row.mode !== input.expectedMode && row.mode !== input.mode))
        throw new ResearchOperationError(
          "CONFLICT",
          "The session changed. Refresh to see its current mode.",
        );
      if (row.mode !== input.mode) {
        await tx.aIConversation.update({ where: { id: row.id }, data: { mode: input.mode } });
        await researchAudit(tx, actor, "AIConversation", row.id, "RESEARCH_SESSION_MODE_CHANGED", {
          previousMode: row.mode,
          mode: input.mode,
        });
      }
      return { id: row.id };
    });
  }
}
