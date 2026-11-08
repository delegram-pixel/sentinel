import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ResearchOperationError, type ResearchActor } from "../application/actor";

export async function requireResearchMember(tx: Prisma.TransactionClient, actor: ResearchActor) {
  const member = await tx.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: actor.userId } },
    select: { role: true },
  });
  if (!member)
    throw new ResearchOperationError("FORBIDDEN", "You no longer have access to this workspace.");
  return member.role;
}

export async function lockResearchInvestigation(
  tx: Prisma.TransactionClient,
  actor: ResearchActor,
  id: string,
) {
  await requireResearchMember(tx, actor);
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Investigation" WHERE id = ${id}::uuid AND "workspaceId" = ${actor.workspaceId}::uuid FOR UPDATE`,
  );
  const investigation = await tx.investigation.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    select: {
      id: true,
      projectId: true,
      targetId: true,
      engagementId: true,
      phase: true,
      status: true,
      project: { select: { status: true } },
    },
  });
  if (!investigation)
    throw new ResearchOperationError(
      "NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  if (investigation.status === "ARCHIVED" || investigation.project.status === "ARCHIVED")
    throw new ResearchOperationError("ARCHIVED", "Archived research cannot be changed.");
  return investigation;
}

export async function researchAudit(
  tx: Prisma.TransactionClient,
  actor: ResearchActor,
  entityType: string,
  entityId: string,
  action: string,
  metadata: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      entityType,
      entityId,
      action,
      metadata,
    },
  });
}
