import { removeResearchEvidenceLink } from "@/modules/evidence/application/relationship-service";
import { failure, type DomainResult } from "@/modules/shared/domain/result";
import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";
import {
  findingStatusForHumanConclusion,
  humanVerificationConclusionSchema,
} from "@/modules/verification/domain/verification-conclusion";

import {
  confirmationReadiness,
  duplicateConfirmationSchema,
  findingInputSchema,
  findingStatusChangeSchema,
  findingUpdateSchema,
  findingVerificationReviewSchema,
  normalizeFindingTitle,
  reportabilityReadiness,
  severityAssessmentSchema,
  type FindingReadiness,
} from "../domain/finding";
import { transitionFinding, type FindingActor } from "../domain/finding-status";
import type {
  DuplicateCandidate,
  FindingDetail,
  FindingEvidenceLinkRow,
  FindingRow,
  FindingStore,
  Phase6Actor,
  Phase6AuditDraft,
} from "./ports";

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the finding details and try again.";
}

function isReviewer(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "REVIEWER";
}

function readinessOf(finding: {
  severity: FindingRow["severity"];
  severityRationale: string | null;
  affectedAsset: string | null;
  affectedAssetType: FindingRow["affectedAssetType"];
  impact: string | null;
  remediation: string | null;
  supportingEvidenceCount: number;
}): FindingReadiness {
  return {
    severity: finding.severity,
    severityRationale: finding.severityRationale,
    affectedAsset: finding.affectedAsset,
    affectedAssetType: finding.affectedAssetType,
    impact: finding.impact,
    remediation: finding.remediation,
    supportsEvidenceCount: finding.supportingEvidenceCount,
  };
}

function auditDraft(
  actor: Phase6Actor,
  action: Phase6AuditDraft["action"],
  entityType: string,
  values: Omit<Phase6AuditDraft, "workspaceId" | "userId" | "action" | "entityType">,
): Phase6AuditDraft {
  return {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    action,
    entityType,
    ...values,
  };
}

function assertEditable(context: {
  projectStatus: string;
  investigationStatus: string;
}): DomainResult<true> {
  if (context.projectStatus === "ARCHIVED") {
    return failure("PROJECT_ARCHIVED", "This project is archived, so its findings are read-only.");
  }

  if (context.investigationStatus === "ARCHIVED") {
    return failure(
      "INVESTIGATION_ARCHIVED",
      "This investigation is archived. You can revisit its history, but editing is closed.",
    );
  }

  return { ok: true, value: true };
}

export function listFindings(
  store: FindingStore,
  workspaceId: string,
  investigationId?: string,
): Promise<FindingRow[]> {
  return store.listFindings(workspaceId, investigationId);
}

export function getFinding(
  store: FindingStore,
  workspaceId: string,
  findingId: string,
): Promise<FindingDetail | null> {
  return store.findFinding(workspaceId, findingId);
}

export async function createFinding(
  store: FindingStore,
  actor: Phase6Actor,
  investigationId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = findingInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const investigation = await store.findInvestigation(actor.workspaceId, investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  if (parsed.data.hypothesisId) {
    const hypothesis = await store.findHypothesis(
      actor.workspaceId,
      investigationId,
      parsed.data.hypothesisId,
    );

    if (!hypothesis) {
      return failure(
        "HYPOTHESIS_NOT_FOUND",
        "Choose a hypothesis from this investigation so the finding stays connected to its research.",
      );
    }
  }

  const finding = await store.createFinding(
    {
      workspaceId: actor.workspaceId,
      investigationId,
      hypothesisId: parsed.data.hypothesisId,
      title: parsed.data.title,
      titleNormalized: normalizeFindingTitle(parsed.data.title),
      description: parsed.data.description,
      vulnerabilityCategory: parsed.data.vulnerabilityCategory,
      affectedAsset: parsed.data.affectedAsset,
      affectedAssetType: parsed.data.affectedAssetType,
      impact: parsed.data.impact,
      remediation: parsed.data.remediation,
      createdBy: actor.userId,
    },
    auditDraft(actor, "FINDING_CREATED", "Finding", {
      newValue: {
        investigationId,
        title: parsed.data.title,
        status: "DRAFT",
        severity: "UNASSESSED",
        hypothesisId: parsed.data.hypothesisId ?? null,
      },
    }),
  );

  return { ok: true, value: { id: finding.id } };
}

export async function updateFinding(
  store: FindingStore,
  actor: Phase6Actor,
  findingId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = findingUpdateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const existing = await store.findFinding(actor.workspaceId, findingId);

  if (!existing) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  const investigation = await store.findInvestigation(actor.workspaceId, existing.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  if (existing.status !== "DRAFT" && existing.status !== "NEEDS_VALIDATION") {
    return failure(
      "FINDING_LOCKED",
      "You can edit findings in Draft or Needs validation. At later stages, use a verification review to record changes.",
    );
  }

  if (parsed.data.hypothesisId) {
    const hypothesis = await store.findHypothesis(
      actor.workspaceId,
      existing.investigationId,
      parsed.data.hypothesisId,
    );

    if (!hypothesis) {
      return failure(
        "HYPOTHESIS_NOT_FOUND",
        "Choose a hypothesis from this investigation so the finding stays connected to its research.",
      );
    }
  }

  const updated = await store.updateFinding(
    actor.workspaceId,
    findingId,
    {
      expectedUpdatedAt: existing.updatedAt,
      hypothesisId: parsed.data.hypothesisId ?? null,
      title: parsed.data.title,
      titleNormalized: normalizeFindingTitle(parsed.data.title),
      description: parsed.data.description,
      vulnerabilityCategory: parsed.data.vulnerabilityCategory ?? null,
      affectedAsset: parsed.data.affectedAsset ?? null,
      affectedAssetType: parsed.data.affectedAssetType ?? null,
      impact: parsed.data.impact ?? null,
      remediation: parsed.data.remediation ?? null,
    },
    auditDraft(actor, "FINDING_UPDATED", "Finding", {
      previousValue: {
        title: existing.title,
        vulnerabilityCategory: existing.vulnerabilityCategory,
        hypothesisId: existing.hypothesisId,
      },
      newValue: {
        title: parsed.data.title,
        vulnerabilityCategory: parsed.data.vulnerabilityCategory ?? null,
        hypothesisId: parsed.data.hypothesisId ?? null,
      },
    }),
  );

  if (!updated) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function assessFindingSeverity(
  store: FindingStore,
  actor: Phase6Actor,
  findingId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = severityAssessmentSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const existing = await store.findFinding(actor.workspaceId, findingId);

  if (!existing) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  const investigation = await store.findInvestigation(actor.workspaceId, existing.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  if (existing.status === "CLOSED") {
    return failure(
      "FINDING_CLOSED",
      "This finding is closed, so severity reassessment is no longer available.",
    );
  }

  const updated = await store.assessSeverity(
    actor.workspaceId,
    findingId,
    {
      expectedUpdatedAt: existing.updatedAt,
      severity: parsed.data.severity,
      severityRationale: parsed.data.severityRationale ?? null,
      affectedAsset: parsed.data.affectedAsset ?? existing.affectedAsset,
      affectedAssetType: parsed.data.affectedAssetType ?? existing.affectedAssetType,
      assessedBy: actor.userId,
      assessedAt: now,
    },
    auditDraft(actor, "FINDING_SEVERITY_ASSESSED", "Finding", {
      previousValue: {
        severity: existing.severity,
        affectedAsset: existing.affectedAsset,
        affectedAssetType: existing.affectedAssetType,
      },
      newValue: {
        severity: parsed.data.severity,
        severityRationale: parsed.data.severityRationale ?? null,
        affectedAsset: parsed.data.affectedAsset ?? existing.affectedAsset,
        affectedAssetType: parsed.data.affectedAssetType ?? existing.affectedAssetType,
      },
    }),
  );

  if (!updated) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function changeFindingStatus(
  store: FindingStore,
  actor: Phase6Actor,
  findingId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = findingStatusChangeSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", "Choose a valid finding status.");
  }

  const existing = await store.findFinding(actor.workspaceId, findingId);

  if (!existing) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  const investigation = await store.findInvestigation(actor.workspaceId, existing.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  const next = parsed.data.status;

  if (next === "CONFIRMED" || next === "FALSE_POSITIVE" || next === "REJECTED") {
    return failure(
      "HUMAN_REVIEW_REQUIRED",
      "Use a human verification review to record the decision to confirm, reject, or mark this finding as a false positive.",
    );
  }

  const findingActor: FindingActor =
    next === "REPORTABLE" || next === "CLOSED"
      ? isReviewer(actor.role)
        ? "REVIEWER"
        : "RESEARCHER"
      : "RESEARCHER";
  const transition = transitionFinding(existing.status, next, findingActor);

  if (!transition.ok) {
    return transition;
  }

  if (next === "REPORTABLE") {
    if (!isReviewer(actor.role)) {
      return failure(
        "FORBIDDEN_FINDING_ACTOR",
        "Ask a human reviewer to check the finding and mark it reportable.",
      );
    }

    const problems = reportabilityReadiness(readinessOf(existing));

    if (problems.length > 0) {
      return failure("FINDING_NOT_READY", problems.join(" "));
    }

    const confirmedReview = existing.verificationReviews.some(
      (review) => review.reviewerType === "HUMAN" && review.conclusion === "CONFIRMED",
    );

    if (!confirmedReview) {
      return failure(
        "HUMAN_REVIEW_REQUIRED",
        "Have a human reviewer record a confirmation review before marking this finding reportable.",
      );
    }
  }

  const updated = await store.transitionFinding(
    actor.workspaceId,
    findingId,
    {
      expectedUpdatedAt: existing.updatedAt,
      status: next,
      rationale: parsed.data.rationale,
      resolutionReason: null,
      ...(next === "REPORTABLE" ? { approvedBy: actor.userId, approvedAt: now } : {}),
    },
    auditDraft(actor, "FINDING_STATUS_CHANGED", "Finding", {
      previousValue: { status: existing.status },
      newValue: { status: next },
    }),
  );

  if (!updated) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  return { ok: true, value: { id: updated.id } };
}

export async function reviewFinding(
  store: FindingStore,
  actor: Phase6Actor,
  findingId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = findingVerificationReviewSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  if (!isReviewer(actor.role)) {
    return failure(
      "FORBIDDEN_FINDING_ACTOR",
      "Ask a human reviewer to record the verification decision.",
    );
  }

  const existing = await store.findFinding(actor.workspaceId, findingId);

  if (!existing) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  const investigation = await store.findInvestigation(actor.workspaceId, existing.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  const conclusion = humanVerificationConclusionSchema.parse(parsed.data.conclusion);
  const next = findingStatusForHumanConclusion(conclusion);
  const transition = transitionFinding(existing.status, next, "REVIEWER");

  if (!transition.ok) {
    return transition;
  }

  if (next === "CONFIRMED") {
    const problems = confirmationReadiness(readinessOf(existing));

    if (problems.length > 0) {
      return failure("FINDING_NOT_READY", problems.join(" "));
    }
  }

  let resolutionReason = parsed.data.resolutionReason ?? null;

  if (next === "REJECTED" && !resolutionReason) {
    resolutionReason = conclusion === "NOT_REPRODUCIBLE" ? "INSUFFICIENT_EVIDENCE" : "OTHER";
  }

  const review = await store.createVerificationReview(
    {
      expectedUpdatedAt: existing.updatedAt,
      findingId,
      reviewerType: "HUMAN",
      reviewerUserId: actor.userId,
      conclusion,
      supportingEvidence: parsed.data.supportingEvidence,
      contradictingEvidence: parsed.data.contradictingEvidence,
      missingEvidence: parsed.data.missingEvidence,
      impactAssessment: parsed.data.impactAssessment,
      reasoningSummary: parsed.data.reasoningSummary,
    },
    {
      status: next,
      resolutionReason,
      ...(next === "CONFIRMED"
        ? { approvedBy: actor.userId, approvedAt: now, verifiedAt: now }
        : {}),
    },
    auditDraft(actor, "FINDING_VERIFICATION_REVIEWED", "Finding", {
      previousValue: { status: existing.status },
      newValue: {
        status: next,
        conclusion,
        resolutionReason,
        reviewerType: "HUMAN",
        supportingEvidenceCount: parsed.data.supportingEvidence?.length ?? 0,
        contradictingEvidenceCount: parsed.data.contradictingEvidence?.length ?? 0,
      },
    }),
  );

  if (!review) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  return { ok: true, value: { id: review.finding.id } };
}

export async function listDuplicateCandidates(
  store: FindingStore,
  workspaceId: string,
  findingId: string,
): Promise<DuplicateCandidate[]> {
  const finding = await store.findFinding(workspaceId, findingId);

  if (!finding) {
    return [];
  }

  return store.findSimilarFindings({
    workspaceId,
    investigationId: finding.investigationId,
    titleNormalized: finding.titleNormalized,
    vulnerabilityCategory: finding.vulnerabilityCategory,
    excludeFindingId: finding.id,
  });
}

export async function confirmDuplicateFinding(
  store: FindingStore,
  actor: Phase6Actor,
  findingId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const parsed = duplicateConfirmationSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", "Choose the original finding that this one duplicates.");
  }

  if (!isReviewer(actor.role)) {
    return failure(
      "FORBIDDEN_FINDING_ACTOR",
      "Ask a human reviewer to check the match and confirm whether it's a duplicate.",
    );
  }

  if (parsed.data.canonicalFindingId === findingId) {
    return failure(
      "DUPLICATE_SELF_REFERENCE",
      "Choose a different finding as the original. A finding can't duplicate itself.",
    );
  }

  const existing = await store.findFinding(actor.workspaceId, findingId);

  if (!existing) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  if (existing.status !== "UNDER_REVIEW") {
    return failure(
      "INVALID_FINDING_TRANSITION",
      "Move the finding to Under review before confirming it as a duplicate.",
    );
  }

  const canonical = await store.findDuplicateTarget(
    actor.workspaceId,
    parsed.data.canonicalFindingId,
  );

  if (!canonical || canonical.investigationId !== existing.investigationId) {
    return failure("FINDING_NOT_FOUND", "Choose the original finding from this investigation.");
  }

  try {
    const updated = await store.confirmDuplicate(
      actor.workspaceId,
      findingId,
      parsed.data.canonicalFindingId,
      actor.userId,
      now,
      auditDraft(actor, "FINDING_DUPLICATE_CONFIRMED", "Finding", {
        newValue: {
          duplicateOfId: parsed.data.canonicalFindingId,
          resolutionReason: "DUPLICATE",
          status: "REJECTED",
        },
      }),
    );

    if (!updated) {
      return failure(
        "FINDING_NOT_FOUND",
        "We can't find that finding in this workspace. Open Findings to choose an available one.",
      );
    }

    return { ok: true, value: { id: updated.id } };
  } catch (error) {
    return failure(
      "DUPLICATE_CONFIRMATION_FAILED",
      error instanceof Error ? error.message : "The duplicate could not be confirmed.",
    );
  }
}

export async function listApprovedEvidenceForFinding(
  store: FindingStore,
  workspaceId: string,
  findingId: string,
) {
  const finding = await store.findFinding(workspaceId, findingId);

  if (!finding) {
    return [];
  }

  return store.listApprovedEvidence(workspaceId, finding.investigationId);
}

export async function linkEvidenceToFinding(
  store: FindingStore,
  actor: Phase6Actor,
  rawInput: unknown,
): Promise<DomainResult<FindingEvidenceLinkRow>> {
  const { evidenceLinkSchema } = await import("@/modules/evidence/domain/evidence");
  const parsed = evidenceLinkSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure(
      "VALIDATION_FAILED",
      "Choose approved evidence and say how it relates to the finding.",
    );
  }

  const finding = await store.findFinding(actor.workspaceId, parsed.data.findingId);

  if (!finding) {
    return failure(
      "FINDING_NOT_FOUND",
      "We can't find that finding in this workspace. Open Findings to choose an available one.",
    );
  }

  const investigation = await store.findInvestigation(actor.workspaceId, finding.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  try {
    const link = await store.createEvidenceLink(
      {
        workspaceId: actor.workspaceId,
        findingId: parsed.data.findingId,
        evidenceId: parsed.data.evidenceId,
        relationshipType: parsed.data.relationshipType,
      },
      auditDraft(actor, "EVIDENCE_LINKED", "EvidenceLink", {
        newValue: {
          evidenceId: parsed.data.evidenceId,
          findingId: parsed.data.findingId,
          relationshipType: parsed.data.relationshipType,
        },
      }),
    );

    return { ok: true, value: link };
  } catch (error) {
    return failure(
      "EVIDENCE_LINK_FAILED",
      error instanceof Error ? error.message : "The evidence could not be linked.",
    );
  }
}

export async function removeEvidenceLink(
  store: FindingStore,
  actor: Phase6Actor,
  linkId: string,
): Promise<DomainResult<true>> {
  return removeResearchEvidenceLink(() =>
    store.removeEvidenceLink(
      actor.workspaceId,
      linkId,
      auditDraft(actor, "EVIDENCE_LINK_REMOVED", "EvidenceLink", { previousValue: { linkId } }),
    ),
  );
}
