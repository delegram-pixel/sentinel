"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { changeAiSessionMode } from "@/modules/ai/application/session-service";
import { PrismaAiSessionStore } from "@/modules/ai/infrastructure/prisma-ai-session-store";
export async function changeSessionModeAction(input: unknown) {
  const s = await getSessionContext();
  const result = await changeAiSessionMode(
    new PrismaAiSessionStore(getDb()),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    input,
  );
  revalidatePath("/dashboard/investigations", "layout");
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}
