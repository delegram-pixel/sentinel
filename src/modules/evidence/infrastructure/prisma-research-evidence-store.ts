import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { assertEvidenceNotReferenced } from "./evidence-retention";
import {
  canReviewResearch,
  ResearchOperationError,
  type ResearchActor,
} from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import {
  evidenceReplacementSchema,
  evidenceResearchRelationSchema,
  evidenceProvenanceSchema,
  assessmentReviewSchema,
  type ResearchEvidenceStore,
} from "../application/research-evidence-service";
async function evidenceContext(tx: Prisma.TransactionClient, actor: ResearchActor, id: string) {
  const evidence = await tx.evidence.findFirst({
    where: { id, workspaceId: actor.workspaceId, deletedAt: null },
    select: { investigationId: true, uploadedBy: true, collectedAt: true, collector: true },
  });
  if (!evidence)
    throw new ResearchOperationError("NOT_FOUND", "The evidence is unavailable in this workspace.");
  await lockResearchInvestigation(tx, actor, evidence.investigationId);
  return evidence;
}
export class PrismaResearchEvidenceStore implements ResearchEvidenceStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  replace(actor: ResearchActor, input: z.infer<typeof evidenceReplacementSchema>) {
    return this.db.$transaction(async (tx) => {
      const context = await evidenceContext(tx, actor, input.evidenceId);
      if (!canReviewResearch(await requireResearchMember(tx, actor)))
        throw new ResearchOperationError(
          "FORBIDDEN",
          "A human reviewer must approve a replacement relationship.",
        );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Evidence" WHERE id IN (${input.evidenceId}::uuid, ${input.supersedesId}::uuid) ORDER BY id FOR UPDATE`,
      );
      const rows = await tx.evidence.findMany({
        where: {
          id: { in: [input.evidenceId, input.supersedesId] },
          workspaceId: actor.workspaceId,
          investigationId: context.investigationId,
          deletedAt: null,
          storageKey: { not: null },
          redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
        },
      });
      const replacement = rows.find((r) => r.id === input.evidenceId);
      const previous = rows.find((r) => r.id === input.supersedesId);
      if (!replacement || !previous || !replacement.uploadValidatedAt)
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Choose two approved evidence items from the same investigation.",
        );
      if (replacement.supersedesId === previous.id) return { id: replacement.id };
      if (
        await tx.backgroundJob.count({
          where: {
            workspaceId: actor.workspaceId,
            kind: "EVIDENCE_PROMOTION",
            status: { in: ["QUEUED", "RUNNING"] },
            payload: { path: ["evidenceId"], equals: replacement.id },
          },
        })
      )
        throw new ResearchOperationError(
          "PROMOTION_PENDING",
          "Finish the upload's background promotion before recording a replacement version.",
        );
      if (
        replacement.supersedesId ||
        replacement.version !== 1 ||
        (await tx.evidence.count({ where: { supersedesId: previous.id } }))
      )
        throw new ResearchOperationError(
          "CONFLICT",
          "The replacement version chain is already recorded.",
        );
      await assertEvidenceNotReferenced(tx, actor.workspaceId, replacement.id);
      const row = await tx.evidence.update({
        where: { id: replacement.id },
        data: { supersedesId: previous.id, version: previous.version + 1 },
        select: { id: true },
      });
      await researchAudit(tx, actor, "Evidence", row.id, "EVIDENCE_REPLACEMENT_REVIEWED", {
        supersedesId: previous.id,
        version: previous.version + 1,
        rationale: input.rationale,
      });
      return row;
    });
  }
  relate(actor: ResearchActor, input: z.infer<typeof evidenceResearchRelationSchema>) {
    return this.db.$transaction(async (tx) => {
      const evidence = await evidenceContext(tx, actor, input.evidenceId);
      const found =
        input.subjectKind === "OBSERVATION"
          ? await tx.investigationObservation.findFirst({
              where: { id: input.subjectId, investigationId: evidence.investigationId },
              select: { id: true },
            })
          : await tx.hypothesis.findFirst({
              where: { id: input.subjectId, investigationId: evidence.investigationId },
              select: { id: true },
            });
      if (!found)
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Choose a research record from the same investigation.",
        );
      const row = await tx.evidenceResearchLink.upsert({
        where: {
          evidenceId_subjectKey_relationship: {
            evidenceId: input.evidenceId,
            subjectKey: `${input.subjectKind}:${input.subjectId}`,
            relationship: input.relationship,
          },
        },
        create: {
          workspaceId: actor.workspaceId,
          evidenceId: input.evidenceId,
          subjectKey: `${input.subjectKind}:${input.subjectId}`,
          observationId: input.subjectKind === "OBSERVATION" ? input.subjectId : null,
          hypothesisId: input.subjectKind === "HYPOTHESIS" ? input.subjectId : null,
          relationship: input.relationship,
          rationale: input.rationale,
          createdBy: actor.userId,
        },
        update: {},
        select: { id: true },
      });
      await researchAudit(
        tx,
        actor,
        "EvidenceResearchLink",
        row.id,
        "EVIDENCE_RESEARCH_LINKED",
        input,
      );
      return row;
    });
  }
  recordProvenance(actor: ResearchActor, input: z.infer<typeof evidenceProvenanceSchema>) {
    return this.db.$transaction(async (tx) => {
      const evidence = await evidenceContext(tx, actor, input.evidenceId);
      const role = await requireResearchMember(tx, actor);
      if (evidence.uploadedBy !== actor.userId && !canReviewResearch(role))
        throw new ResearchOperationError(
          "FORBIDDEN",
          "The uploader or a reviewer must document collection provenance.",
        );
      if (evidence.collector || evidence.collectedAt)
        throw new ResearchOperationError(
          "IMMUTABLE_PROVENANCE",
          "Collection provenance is already recorded. Create a reviewed replacement for corrections.",
        );
      const row = await tx.evidence.update({
        where: { id: input.evidenceId },
        data: { collector: input.collector, collectedAt: input.collectedAt, source: input.source },
        select: { id: true },
      });
      await researchAudit(tx, actor, "Evidence", row.id, "EVIDENCE_PROVENANCE_RECORDED", {
        collector: input.collector,
        collectedAt: input.collectedAt?.toISOString() ?? null,
      });
      return row;
    });
  }
  reviewAssessment(actor: ResearchActor, input: z.infer<typeof assessmentReviewSchema>) {
    return this.db.$transaction(async (tx) => {
      const role = await requireResearchMember(tx, actor);
      if (!canReviewResearch(role))
        throw new ResearchOperationError(
          "FORBIDDEN",
          "A human reviewer must review evidence assessments.",
        );
      const row = await tx.evidenceAssessment.findFirst({
        where: { id: input.assessmentId, workspaceId: actor.workspaceId },
        select: { evidenceId: true },
      });
      if (!row) throw new ResearchOperationError("NOT_FOUND", "The assessment is unavailable.");
      await evidenceContext(tx, actor, row.evidenceId);
      await tx.evidenceAssessment.update({
        where: { id: input.assessmentId },
        data: { reviewStatus: input.status, reviewedBy: actor.userId, reviewedAt: new Date() },
      });
      await researchAudit(
        tx,
        actor,
        "EvidenceAssessment",
        input.assessmentId,
        "EVIDENCE_ASSESSMENT_REVIEWED",
        input,
      );
      return { id: input.assessmentId };
    });
  }
  listAssessments(workspaceId: string, evidenceId: string) {
    return this.db.evidenceAssessment.findMany({
      where: { workspaceId, evidenceId },
      select: {
        id: true,
        sourceTaskId: true,
        assessorType: true,
        reviewStatus: true,
        assessment: true,
        basis: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
