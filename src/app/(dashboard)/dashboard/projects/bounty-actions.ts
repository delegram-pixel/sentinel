"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { bountySourceInputSchema, type BountyReview } from "@/modules/bounty/domain/bounty-import";
import { enqueueResearchJob, cancelResearchJob } from "@/modules/tasks/application/job-service";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { saveBountyProject } from "@/modules/bounty/infrastructure/save-bounty-project";
import { ResearchOperationError } from "@/modules/shared/domain/result";

export async function importBountyAction(raw: unknown, operationKey: string) {
  const session = await getSessionContext();
  const parsed = bountySourceInputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Add the program details.",
    };
  const actor = { workspaceId: session.workspace.id, userId: session.user.id, role: session.role };
  try {
    return await enqueueResearchJob(
      new PrismaJobStore(getDb()),
      actor,
      "BOUNTY_IMPORT",
      operationKey,
      parsed.data,
    );
  } catch {
    return {
      ok: false as const,
      message: "The import could not be queued. Your details are still here; try again.",
    };
  }
}

export async function saveBountyProjectAction(input: BountyReview) {
  const session = await getSessionContext();
  let project;
  try {
    project = await saveBountyProject(
      getDb(),
      { workspaceId: session.workspace.id, userId: session.user.id, role: session.role },
      input,
    );
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof ResearchOperationError
          ? error.message
          : "The project could not be saved. Your reviewed details are still here; try again.",
    };
  }
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/targets");
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function cancelBountyImportAction(jobId: string) {
  const session = await getSessionContext();
  return cancelResearchJob(
    new PrismaJobStore(getDb()),
    { workspaceId: session.workspace.id, userId: session.user.id, role: session.role },
    jobId,
  );
}
