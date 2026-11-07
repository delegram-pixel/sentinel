"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import type { DismissWorkspaceTourResult } from "@/modules/auth/domain/workspace-tour";
import { PrismaWorkspaceTourStore } from "@/modules/auth/infrastructure/prisma-workspace-tour-store";

export async function dismissWorkspaceTourAction(): Promise<DismissWorkspaceTourResult> {
  // Identity comes only from the authenticated session, never the client.
  const session = await getSessionContext();

  try {
    await new PrismaWorkspaceTourStore(getDb()).dismiss(session.user.id);
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "We couldn’t save your tour preference. Try again, or close for now. You may see the tour on your next visit.",
    };
  }
}
