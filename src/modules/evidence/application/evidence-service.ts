import { createHash, randomUUID } from "node:crypto";

import { failure, type DomainResult } from "@/modules/shared/domain/result";
import type { WorkspaceRole } from "@/modules/workspaces/domain/ownership";

import {
  activeStorageKey,
  detectMimeType,
  evidenceIntentSchema,
  evidenceLinkSchema,
  evidenceMetadataUpdateSchema,
  isApprovedEvidence,
  isEvidenceMimeType,
  MAX_EVIDENCE_BYTES,
  mimeTypesCompatible,
  quarantineStorageKey,
  redactionReviewSchema,
  safeFileName,
  scanTextForSensitiveData,
  storedMimeType,
  totalScanFindings,
} from "../domain/evidence";
import type { EvidenceAuditDraft, EvidenceDetail, EvidenceRow, EvidenceStore } from "./ports";
import type { EvidenceStorage } from "./storage";

export type EvidenceActor = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

const UPLOAD_URL_SECONDS = 5 * 60;

function isReviewer(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "REVIEWER";
}

function firstIssue(result: { error: { issues: ReadonlyArray<{ message: string }> } }): string {
  return result.error.issues[0]?.message ?? "Check the evidence details and try again.";
}

function auditDraft(
  actor: EvidenceActor,
  action: EvidenceAuditDraft["action"],
  entityType: string,
  values: Omit<EvidenceAuditDraft, "workspaceId" | "userId" | "action" | "entityType">,
): EvidenceAuditDraft {
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
    return failure("PROJECT_ARCHIVED", "Evidence in an archived project cannot be changed.");
  }

  if (context.investigationStatus === "ARCHIVED") {
    return failure("INVESTIGATION_ARCHIVED", "An archived investigation cannot be changed.");
  }

  return { ok: true, value: true };
}

/**
 * ADR-013 §7: pending and quarantined evidence is visible only to its
 * uploader, the workspace owner, and reviewers who must resolve it.
 */
function canView(actor: EvidenceActor, evidence: EvidenceRow): boolean {
  return isReviewer(actor.role) || evidence.uploadedBy === actor.userId;
}

export async function listEvidence(
  store: EvidenceStore,
  actor: EvidenceActor,
  investigationId?: string,
): Promise<EvidenceRow[]> {
  const rows = await store.listEvidence(actor.workspaceId, investigationId);

  return rows.filter((row) => canView(actor, row));
}

export async function getEvidence(
  store: EvidenceStore,
  actor: EvidenceActor,
  evidenceId: string,
): Promise<EvidenceDetail | null> {
  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return null;
  }

  return evidence;
}

export async function createEvidenceUploadIntent(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  rawInput: unknown,
): Promise<DomainResult<{ evidenceId: string; uploadUrl: string; expiresAt: Date }>> {
  const parsed = evidenceIntentSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const investigation = await store.findInvestigation(
    actor.workspaceId,
    parsed.data.investigationId,
  );

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  const evidenceId = randomUUID();
  const uploadId = randomUUID();
  const key = quarantineStorageKey(actor.workspaceId, evidenceId, uploadId);

  const upload = await storage.createUploadTarget({
    key,
    mimeType: parsed.data.mimeType,
    expiresInSeconds: UPLOAD_URL_SECONDS,
  });

  await store.createEvidence(
    {
      id: evidenceId,
      workspaceId: actor.workspaceId,
      investigationId: parsed.data.investigationId,
      evidenceType: parsed.data.evidenceType,
      title: parsed.data.title,
      description: parsed.data.description,
      fileName: safeFileName(parsed.data.fileName),
      mimeType: parsed.data.mimeType,
      fileSize: parsed.data.fileSize,
      checksum: parsed.data.checksum.toLowerCase(),
      source: parsed.data.source,
      quarantineKey: key,
      uploadedBy: actor.userId,
    },
    auditDraft(actor, "EVIDENCE_UPLOAD_INTENT_CREATED", "Evidence", {
      newValue: {
        investigationId: parsed.data.investigationId,
        evidenceType: parsed.data.evidenceType,
        title: parsed.data.title,
        mimeType: parsed.data.mimeType,
        fileSize: parsed.data.fileSize,
        redactionStatus: "NOT_REVIEWED",
      },
    }),
  );

  return {
    ok: true,
    value: { evidenceId, uploadUrl: upload.url, expiresAt: upload.expiresAt },
  };
}

export async function finalizeEvidenceUpload(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  evidenceId: string,
): Promise<DomainResult<{ id: string; redactionStatus: string }>> {
  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  if (evidence.storageKey) {
    return failure("EVIDENCE_ALREADY_ACTIVE", "That evidence has already been activated.");
  }

  if (!evidence.quarantineKey) {
    return failure("EVIDENCE_NOT_UPLOADED", "No quarantined upload was found for this evidence.");
  }

  if (!isEvidenceMimeType(evidence.mimeType)) {
    return failure("UNSUPPORTED_MEDIA_TYPE", "That file type is not allowed.");
  }

  const stored = await storage.statObject(evidence.quarantineKey);

  if (!stored) {
    return failure(
      "EVIDENCE_UPLOAD_MISSING",
      "The upload was not found. Upload the file and try again.",
    );
  }

  if (stored.size <= 0) {
    return failure("EVIDENCE_EMPTY", "The uploaded file is empty.");
  }

  if (stored.size > MAX_EVIDENCE_BYTES) {
    return failure("EVIDENCE_TOO_LARGE", "Evidence files must be 25 MB or smaller.");
  }

  if (stored.size !== evidence.fileSize) {
    return failure(
      "EVIDENCE_SIZE_MISMATCH",
      "The uploaded file size does not match the upload intent.",
    );
  }

  const object = await storage.getObject(evidence.quarantineKey);

  if (!object) {
    return failure("EVIDENCE_UPLOAD_MISSING", "The uploaded file could not be read.");
  }

  const checksum = createHash("sha256").update(object.body).digest("hex");

  if (checksum !== evidence.checksum) {
    await storage.deleteObject(evidence.quarantineKey);

    return failure(
      "EVIDENCE_CHECKSUM_MISMATCH",
      "The file changed during upload. Upload it again.",
    );
  }

  const detected = detectMimeType(object.body);

  if (!detected) {
    await storage.deleteObject(evidence.quarantineKey);

    return failure("EVIDENCE_TYPE_UNKNOWN", "The file content could not be verified.");
  }

  if (!mimeTypesCompatible(evidence.mimeType, detected)) {
    await storage.deleteObject(evidence.quarantineKey);

    return failure(
      "EVIDENCE_TYPE_MISMATCH",
      "The file content does not match the declared file type.",
    );
  }

  const scanFindings = scanEvidenceContent(detected, object.body);
  const flagged = totalScanFindings(scanFindings) > 0;
  const nextStatus = flagged ? "QUARANTINED" : "NOT_REVIEWED";

  const updated = await store.finalizeEvidence(
    actor.workspaceId,
    evidenceId,
    {
      mimeType: storedMimeType(evidence.mimeType, detected),
      fileSize: stored.size,
      checksum,
      scanFindings,
      redactionStatus: nextStatus,
    },
    auditDraft(actor, "EVIDENCE_UPLOADED", "Evidence", {
      previousValue: { redactionStatus: evidence.redactionStatus },
      newValue: {
        redactionStatus: nextStatus,
        mimeType: storedMimeType(evidence.mimeType, detected),
        fileSize: stored.size,
        scanTotal: totalScanFindings(scanFindings),
      },
    }),
  );

  if (!updated) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  return { ok: true, value: { id: updated.id, redactionStatus: updated.redactionStatus } };
}

function scanEvidenceContent(detected: string, body: Buffer): Record<string, number> {
  const textLike =
    detected === "text/plain" || detected === "application/json" || detected === "application/xml";

  if (!textLike) {
    return {};
  }

  try {
    return scanTextForSensitiveData(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return {};
  }
}

export async function updateEvidenceMetadata(
  store: EvidenceStore,
  actor: EvidenceActor,
  evidenceId: string,
  rawInput: unknown,
): Promise<DomainResult<{ id: string }>> {
  const parsed = evidenceMetadataUpdateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  const investigation = await store.findInvestigation(actor.workspaceId, evidence.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  const updated = await store.updateEvidenceMetadata(
    actor.workspaceId,
    evidenceId,
    {
      title: parsed.data.title,
      description: parsed.data.description,
      evidenceType: parsed.data.evidenceType,
      source: parsed.data.source,
    },
    auditDraft(actor, "EVIDENCE_UPDATED", "Evidence", {
      previousValue: { title: evidence.title, evidenceType: evidence.evidenceType },
      newValue: { title: parsed.data.title, evidenceType: parsed.data.evidenceType },
    }),
  );

  return updated
    ? { ok: true, value: { id: updated.id } }
    : failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
}

export async function reviewEvidenceRedaction(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  evidenceId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string; redactionStatus: string }>> {
  const parsed = redactionReviewSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", firstIssue(parsed));
  }

  if (!isReviewer(actor.role)) {
    return failure(
      "FORBIDDEN_EVIDENCE_REVIEWER",
      "A workspace owner, admin, or reviewer must resolve redaction.",
    );
  }

  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  const investigation = await store.findInvestigation(actor.workspaceId, evidence.investigationId);

  if (!investigation) {
    return failure(
      "INVESTIGATION_NOT_FOUND",
      "That investigation does not exist in this workspace.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  if (evidence.storageKey) {
    return failure("EVIDENCE_ALREADY_ACTIVE", "Active evidence cannot be reviewed again.");
  }

  if (!evidence.quarantineKey) {
    return failure("EVIDENCE_NOT_UPLOADED", "That evidence has no quarantined upload to review.");
  }

  if (parsed.data.decision === "REJECT") {
    await storage.deleteObject(evidence.quarantineKey);

    const rejected = await store.rejectEvidence(
      actor.workspaceId,
      evidenceId,
      now,
      parsed.data.note ?? "Rejected during redaction review.",
      auditDraft(actor, "EVIDENCE_REDACTION_REJECTED", "Evidence", {
        previousValue: { redactionStatus: evidence.redactionStatus },
        newValue: { redactionStatus: "QUARANTINED", deleted: true },
        metadata: { note: parsed.data.note ?? null },
      }),
    );

    return rejected
      ? { ok: true, value: { id: rejected.id, redactionStatus: rejected.redactionStatus } }
      : failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  const nextStatus = parsed.data.decision === "APPROVE_REDACTED" ? "REDACTED" : "VERIFIED_SAFE";
  const destination = activeStorageKey(
    actor.workspaceId,
    evidence.investigationId,
    evidence.id,
    evidence.version,
  );

  await storage.copyObject(evidence.quarantineKey, destination);

  const copy = await storage.getObject(destination);

  if (!copy || createHash("sha256").update(copy.body).digest("hex") !== evidence.checksum) {
    await storage.deleteObject(destination);

    return failure(
      "EVIDENCE_ACTIVATION_FAILED",
      "The stored object failed verification and was not activated.",
    );
  }

  const activated = await store.activateEvidence(
    actor.workspaceId,
    evidenceId,
    {
      storageKey: destination,
      redactionStatus: nextStatus,
      redactionMethod: "HUMAN_REVIEW",
      redactionReviewedBy: actor.userId,
      redactionReviewedAt: now,
      activatedAt: now,
    },
    auditDraft(actor, "EVIDENCE_REDACTION_REVIEWED", "Evidence", {
      previousValue: { redactionStatus: evidence.redactionStatus },
      newValue: {
        redactionStatus: nextStatus,
        redactionMethod: "HUMAN_REVIEW",
        scanTotal: totalScanFindings(
          (evidence.scanFindings as Record<string, number> | null) ?? {},
        ),
      },
      metadata: { note: parsed.data.note ?? null },
    }),
  );

  if (!activated) {
    await storage.deleteObject(destination);

    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  await storage.deleteObject(evidence.quarantineKey);

  return { ok: true, value: { id: activated.id, redactionStatus: activated.redactionStatus } };
}

export async function deleteEvidence(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  evidenceId: string,
  now: Date = new Date(),
): Promise<DomainResult<{ id: string }>> {
  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has already been deleted.");
  }

  if (!isReviewer(actor.role) && evidence.uploadedBy !== actor.userId) {
    return failure(
      "FORBIDDEN_EVIDENCE_DELETE",
      "Only the uploader or a reviewer can delete evidence.",
    );
  }

  if (evidence.findingLinkCount > 0) {
    return failure("EVIDENCE_IN_USE", "Remove the evidence from its findings before deleting it.");
  }

  if (evidence.storageKey) {
    await storage.deleteObject(evidence.storageKey);
  }

  if (evidence.quarantineKey) {
    await storage.deleteObject(evidence.quarantineKey);
  }

  const deleted = await store.softDeleteEvidence(
    actor.workspaceId,
    evidenceId,
    now,
    auditDraft(actor, "EVIDENCE_DELETED", "Evidence", {
      previousValue: { redactionStatus: evidence.redactionStatus },
      newValue: { deleted: true },
    }),
  );

  return deleted
    ? { ok: true, value: { id: evidenceId } }
    : failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
}

export async function createEvidenceDownload(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  evidenceId: string,
): Promise<DomainResult<{ url: string; expiresAt: Date }>> {
  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  const key = evidence.storageKey ?? evidence.quarantineKey;

  if (!key) {
    return failure("EVIDENCE_NOT_UPLOADED", "That evidence has no stored object.");
  }

  if (!evidence.storageKey && !isReviewer(actor.role)) {
    return failure(
      "EVIDENCE_NOT_APPROVED",
      "Quarantined evidence can only be downloaded by its uploader or a reviewer.",
    );
  }

  const target = await storage.createDownloadTarget({
    key,
    mimeType: evidence.mimeType,
    fileName: evidence.fileName,
    expiresInSeconds: UPLOAD_URL_SECONDS,
  });

  return { ok: true, value: target };
}

export async function linkEvidence(
  store: EvidenceStore,
  actor: EvidenceActor,
  rawInput: unknown,
): Promise<DomainResult<{ id: string; findingId: string }>> {
  const parsed = evidenceLinkSchema.safeParse(rawInput);

  if (!parsed.success) {
    return failure("VALIDATION_FAILED", "Choose approved evidence and a relationship.");
  }

  const evidence = await store.findEvidence(actor.workspaceId, parsed.data.evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure("EVIDENCE_NOT_FOUND", "That evidence does not exist in this workspace.");
  }

  if (!isApprovedEvidence(evidence.redactionStatus) || !evidence.storageKey) {
    return failure("EVIDENCE_NOT_APPROVED", "Only approved evidence can link to a finding.");
  }

  const finding = await store.findFindingForLink(actor.workspaceId, parsed.data.findingId);

  if (!finding || finding.investigationId !== evidence.investigationId) {
    return failure("FINDING_NOT_FOUND", "That finding is not in this investigation.");
  }

  try {
    const link = await store.createLink(
      {
        workspaceId: actor.workspaceId,
        evidenceId: evidence.id,
        findingId: finding.id,
        relationshipType: parsed.data.relationshipType,
      },
      auditDraft(actor, "EVIDENCE_LINKED", "EvidenceLink", {
        newValue: {
          evidenceId: evidence.id,
          findingId: finding.id,
          relationshipType: parsed.data.relationshipType,
        },
      }),
    );

    return { ok: true, value: { id: link.id, findingId: link.findingId } };
  } catch (error) {
    return failure(
      "EVIDENCE_LINK_FAILED",
      error instanceof Error ? error.message : "The evidence could not be linked.",
    );
  }
}

export async function removeEvidenceLink(
  store: EvidenceStore,
  actor: EvidenceActor,
  linkId: string,
): Promise<DomainResult<true>> {
  const removed = await store.removeLink(
    actor.workspaceId,
    linkId,
    auditDraft(actor, "EVIDENCE_LINK_REMOVED", "EvidenceLink", {
      previousValue: { linkId },
    }),
  );

  return removed
    ? { ok: true, value: true }
    : failure("EVIDENCE_LINK_NOT_FOUND", "That evidence link does not exist.");
}
