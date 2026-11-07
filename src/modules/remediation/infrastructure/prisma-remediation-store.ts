import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  ResearchOperationError,
  canReviewResearch,
  type ResearchActor,
} from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import { validateManualRetestScope } from "../domain/remediation";
import type { RemediationStore } from "../application/remediation-service";
type Input<K extends keyof RemediationStore> = Parameters<RemediationStore[K]>[1];
async function reviewer(tx: Prisma.TransactionClient, actor: ResearchActor) {
  if (!canReviewResearch(await requireResearchMember(tx, actor)))
    throw new ResearchOperationError("FORBIDDEN", "A human reviewer must approve this operation.");
}
async function finding(tx: Prisma.TransactionClient, actor: ResearchActor, id: string) {
  const row = await tx.finding.findFirst({ where: { id, workspaceId: actor.workspaceId } });
  if (!row) throw new ResearchOperationError("NOT_FOUND", "The finding is unavailable.");
  await lockResearchInvestigation(tx, actor, row.investigationId);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Finding" WHERE id = ${id}::uuid FOR UPDATE`);
  return await tx.finding.findUniqueOrThrow({ where: { id } });
}
async function plan(tx: Prisma.TransactionClient, actor: ResearchActor, id: string) {
  const row = await tx.remediationPlan.findFirst({ where: { id, workspaceId: actor.workspaceId } });
  if (!row) throw new ResearchOperationError("NOT_FOUND", "The remediation plan is unavailable.");
  const f = await finding(tx, actor, row.findingId);
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "RemediationPlan" WHERE id = ${id}::uuid FOR UPDATE`,
  );
  return { plan: await tx.remediationPlan.findUniqueOrThrow({ where: { id } }), finding: f };
}
export class PrismaRemediationStore implements RemediationStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  async list(workspaceId: string) {
    const [plans, findings, engagements, submissions, reports] = await Promise.all([
      this.db.remediationPlan.findMany({
        where: { workspaceId },
        include: { retests: { orderBy: { requestedAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.db.finding.findMany({
        where: { workspaceId },
        select: { id: true, title: true, status: true, updatedAt: true },
        take: 300,
      }),
      this.db.engagement.findMany({
        where: { workspaceId, status: { not: "ARCHIVED" } },
        select: {
          name: true,
          assets: {
            select: {
              id: true,
              target: { select: { name: true } },
              authorizations: {
                select: {
                  scopeVersionId: true,
                  scope: { select: { version: true, status: true } },
                },
              },
            },
          },
        },
        take: 100,
      }),
      this.db.submissionEvent.findMany({
        where: { workspaceId },
        orderBy: { occurredAt: "desc" },
        take: 100,
      }),
      this.db.report.findMany({
        where: { workspaceId },
        select: { id: true, title: true, status: true },
        take: 300,
      }),
    ]);
    return { plans, findings, engagements, submissions, reports };
  }
  create(actor: ResearchActor, input: Input<"create">) {
    return this.db.$transaction(async (tx) => {
      const f = await finding(tx, actor, input.findingId);
      if (!["CONFIRMED", "REPORTABLE"].includes(f.status))
        throw new ResearchOperationError(
          "REVIEW_REQUIRED",
          "Create a remediation plan for a confirmed or reportable finding.",
        );
      const row = await tx.remediationPlan.create({
        data: { ...input, workspaceId: actor.workspaceId, createdBy: actor.userId },
        select: { id: true },
      });
      await researchAudit(tx, actor, "RemediationPlan", row.id, "REMEDIATION_PLANNED", {
        findingId: f.id,
      });
      return row;
    });
  }
  changeStatus(actor: ResearchActor, input: Input<"changeStatus">) {
    return this.db.$transaction(async (tx) => {
      const p = await plan(tx, actor, input.planId);
      if (p.plan.status !== input.expectedStatus)
        throw new ResearchOperationError(
          "CONFLICT",
          "The remediation status changed. Refresh before saving.",
        );
      const row = await tx.remediationPlan.update({
        where: { id: input.planId },
        data: { status: input.status },
        select: { id: true },
      });
      await researchAudit(tx, actor, "RemediationPlan", row.id, "REMEDIATION_STATUS_CHANGED", {
        previousStatus: p.plan.status,
        status: input.status,
        rationale: input.rationale,
      });
      return row;
    });
  }
  requestRetest(actor: ResearchActor, input: Input<"requestRetest">) {
    return this.db.$transaction(async (tx) => {
      await reviewer(tx, actor);
      const p = await plan(tx, actor, input.planId);
      if (p.plan.status !== "READY_FOR_RETEST")
        throw new ResearchOperationError(
          "CONFLICT",
          "Mark the remediation ready for retest first.",
        );
      const inv = await tx.investigation.findUniqueOrThrow({
        where: { id: p.finding.investigationId },
      });
      const asset = await tx.engagementAsset.findFirst({
        where: {
          id: input.assetId,
          workspaceId: actor.workspaceId,
          engagementId: inv.engagementId ?? "00000000-0000-0000-0000-000000000000",
          targetId: inv.targetId,
        },
        include: { target: true, engagement: true },
      });
      if (
        !asset ||
        asset.engagement.status === "ARCHIVED" ||
        (asset.engagement.startsAt && asset.engagement.startsAt > new Date()) ||
        (asset.engagement.endsAt && asset.engagement.endsAt < new Date())
      )
        throw new ResearchOperationError(
          "INVALID_ASSOCIATION",
          "Choose the finding's current engagement asset.",
        );
      if (
        !(await tx.engagementAuthorization.findUnique({
          where: {
            assetId_scopeVersionId: { assetId: asset.id, scopeVersionId: input.scopeVersionId },
          },
        }))
      )
        throw new ResearchOperationError(
          "SCOPE_NOT_CONFIGURED",
          "Associate this scope version with the engagement asset first.",
        );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "ScopeVersion" WHERE id = ${input.scopeVersionId}::uuid FOR SHARE`,
      );
      const scope = await tx.scopeVersion.findFirst({
        where: { id: input.scopeVersionId, targetId: asset.targetId },
        include: { assets: true, activities: true },
      });
      if (!scope)
        throw new ResearchOperationError(
          "SCOPE_NOT_CONFIGURED",
          "The selected scope is unavailable.",
        );
      validateManualRetestScope(scope, asset.target.assetIdentifier, input.activity, new Date());
      const row = await tx.retestRecord.create({
        data: {
          planId: p.plan.id,
          workspaceId: actor.workspaceId,
          assetId: asset.id,
          scopeVersionId: scope.id,
          activity: input.activity,
          requestedBy: actor.userId,
          requestRationale: input.rationale,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "RetestRecord", row.id, "MANUAL_RETEST_DOCUMENTED", {
        planId: p.plan.id,
        scopeVersionId: scope.id,
        activity: input.activity,
      });
      return row;
    });
  }
  reviewRetest(actor: ResearchActor, input: Input<"reviewRetest">) {
    return this.db.$transaction(async (tx) => {
      await reviewer(tx, actor);
      const retest = await tx.retestRecord.findFirst({
        where: { id: input.retestId, workspaceId: actor.workspaceId },
      });
      if (!retest) throw new ResearchOperationError("NOT_FOUND", "The retest is unavailable.");
      const p = await plan(tx, actor, retest.planId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "RetestRecord" WHERE id = ${retest.id}::uuid FOR UPDATE`,
      );
      if (
        (await tx.retestRecord.findUniqueOrThrow({ where: { id: retest.id } })).reviewedAt ||
        p.plan.status === "CLOSED"
      )
        throw new ResearchOperationError(
          "CONFLICT",
          "This retest has already been reviewed or closed.",
        );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Evidence" WHERE id IN (${Prisma.join(input.evidenceIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`,
      );
      const evidence = await tx.evidence.findMany({
        where: {
          id: { in: input.evidenceIds },
          workspaceId: actor.workspaceId,
          investigationId: p.finding.investigationId,
          deletedAt: null,
          storageKey: { not: null },
          redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
        },
        select: { id: true, version: true, checksum: true },
      });
      if (evidence.length !== new Set(input.evidenceIds).size)
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Use approved evidence from this investigation to support the supplied retest results.",
        );
      await tx.retestRecord.update({
        where: { id: retest.id },
        data: {
          suppliedResults: input.suppliedResults,
          evidenceIds: evidence,
          conclusion: input.conclusion,
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          reviewRationale: input.rationale,
        },
      });
      await tx.remediationPlan.update({
        where: { id: p.plan.id },
        data: {
          status:
            input.conclusion === "RESOLVED"
              ? "VERIFIED"
              : input.conclusion === "PERSISTS"
                ? "IN_PROGRESS"
                : "READY_FOR_RETEST",
        },
      });
      await tx.researchDecision.create({
        data: {
          workspaceId: actor.workspaceId,
          investigationId: p.finding.investigationId,
          findingId: p.finding.id,
          kind: "RESEARCH_NOTE",
          rationale: input.rationale,
          sourceRefs: evidence.map((e) => ({ kind: "EVIDENCE", ...e, relationship: "CONTEXT" })),
          legacySourceId: `retest-review:${retest.id}`,
          createdBy: actor.userId,
        },
      });
      await researchAudit(tx, actor, "RetestRecord", retest.id, "MANUAL_RETEST_REVIEWED", {
        conclusion: input.conclusion,
        evidenceIds: input.evidenceIds,
      });
      return { id: retest.id };
    });
  }
  close(actor: ResearchActor, input: Input<"close">) {
    return this.db.$transaction(async (tx) => {
      await reviewer(tx, actor);
      const p = await plan(tx, actor, input.planId);
      if (
        p.plan.status !== "VERIFIED" ||
        !["CONFIRMED", "REPORTABLE"].includes(p.finding.status) ||
        p.finding.updatedAt.toISOString() !== input.expectedUpdatedAt
      )
        throw new ResearchOperationError(
          "CONFLICT",
          "Closure requires verified remediation and the current finding revision.",
        );
      const last = await tx.retestRecord.findFirst({
        where: { planId: p.plan.id, conclusion: "RESOLVED", reviewedAt: { not: null } },
        orderBy: { reviewedAt: "desc" },
      });
      if (!last)
        throw new ResearchOperationError(
          "REVIEW_REQUIRED",
          "Review supplied retest results before closing this finding.",
        );
      await tx.finding.update({
        where: { id: p.finding.id },
        data: { status: "CLOSED", resolutionReason: "OTHER" },
      });
      await tx.remediationPlan.update({ where: { id: p.plan.id }, data: { status: "CLOSED" } });
      const row = await tx.researchDecision.create({
        data: {
          workspaceId: actor.workspaceId,
          investigationId: p.finding.investigationId,
          findingId: p.finding.id,
          kind: "CLOSE_FINDING",
          rationale: input.rationale,
          sourceRefs: [{ kind: "RETEST", id: last.id, relationship: "SUPPORTS" }],
          createdBy: actor.userId,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "Finding", p.finding.id, "FINDING_CLOSED_AFTER_RETEST", {
        decisionId: row.id,
        planId: p.plan.id,
        retestId: last.id,
      });
      return row;
    });
  }
  recordSubmission(actor: ResearchActor, input: Input<"recordSubmission">) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      const f = input.findingId ? await finding(tx, actor, input.findingId) : null;
      const report = input.reportId
        ? await tx.report.findFirst({
            where: {
              id: input.reportId,
              workspaceId: actor.workspaceId,
              status: { in: ["APPROVED", "EXPORTED"] },
            },
          })
        : null;
      if (input.reportId && !report)
        throw new ResearchOperationError(
          "REVIEW_REQUIRED",
          "Use an approved report for manual submission tracking.",
        );
      if (f && !["CONFIRMED", "REPORTABLE", "CLOSED"].includes(f.status))
        throw new ResearchOperationError(
          "REVIEW_REQUIRED",
          "Use a human-confirmed finding for submission tracking.",
        );
      if (report) {
        await lockResearchInvestigation(tx, actor, report.investigationId);
        if (
          f &&
          !(await tx.reportFinding.findUnique({
            where: { reportId_findingId: { reportId: report.id, findingId: f.id } },
          }))
        )
          throw new ResearchOperationError(
            "INVALID_ASSOCIATION",
            "The finding must be included in this report.",
          );
      }
      if (new Date(input.occurredAt).getTime() > Date.now() + 60000)
        throw new ResearchOperationError(
          "INVALID_DATE",
          "Record the actual date of a completed external event.",
        );
      const row = await tx.submissionEvent.create({
        data: {
          ...input,
          occurredAt: new Date(input.occurredAt),
          workspaceId: actor.workspaceId,
          recordedBy: actor.userId,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, "SubmissionEvent", row.id, "MANUAL_OUTCOME_RECORDED", {
        findingId: input.findingId ?? null,
        reportId: input.reportId ?? null,
        outcome: input.outcome,
      });
      return row;
    });
  }
}
