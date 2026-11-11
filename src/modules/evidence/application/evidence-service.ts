import { researchOperation } from "@/modules/shared/application/actor";
import { removeResearchEvidenceLink } from "@/modules/evidence/application/relationship-service";
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
    return failure(
      "PROJECT_ARCHIVED",
      "This project is archived, so its evidence records are read-only.",
    );
  }

  if (context.investigationStatus === "ARCHIVED") {
    return failure(
      "INVESTIGATION_ARCHIVED",
      "This investigation is archived. You can revisit its history, but editing is closed.",
    );
  }

  return { ok: true, value: true };
}

/**
 * ADR-013 §7: pending and quarantined evidence is visible only to its
 * uploader, the workspace owner, and reviewers who must resolve it.
 */
function canView(actor: EvidenceActor, evidence: EvidenceRow): boolean {
  return (
    isApprovedEvidence(evidence.redactionStatus) ||
    isReviewer(actor.role) ||
    evidence.uploadedBy === actor.userId
  );
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

export type EvidenceUploadIntentValue = {
  evidenceId: string;
  upload: { kind: "UPLOADTHING" } | { kind: "LOCAL"; url: string; expiresAt: Date };
};

export async function createEvidenceUploadIntent(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  rawInput: unknown,
): Promise<DomainResult<EvidenceUploadIntentValue>> {
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
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  const editable = assertEditable(investigation);

  if (!editable.ok) {
    return editable;
  }

  const evidenceId = randomUUID();
  const uploadId = randomUUID();
  const key = quarantineStorageKey(actor.workspaceId, evidenceId, uploadId);
  const upload: EvidenceUploadIntentValue["upload"] =
    storage.kind === "UPLOADTHING"
      ? { kind: "UPLOADTHING" }
      : {
          kind: "LOCAL",
          ...(await storage.createUploadTarget({
            key,
            mimeType: parsed.data.mimeType,
            expiresInSeconds: UPLOAD_URL_SECONDS,
          })),
        };

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
      quarantineKey: storage.kind === "UPLOADTHING" ? null : key,
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
    value: { evidenceId, upload },
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
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  if (evidence.storageKey) {
    return failure("EVIDENCE_ALREADY_ACTIVE", "That evidence has already been activated.");
  }

  if (!evidence.quarantineKey) {
    return failure(
      "EVIDENCE_NOT_UPLOADED",
      "We couldn't find the quarantined upload. Upload the file again to continue its review.",
    );
  }

  if (!isEvidenceMimeType(evidence.mimeType)) {
    return failure(
      "UNSUPPORTED_MEDIA_TYPE",
      "This file type isn't supported. Choose one of the formats listed beside the upload field.",
    );
  }

  const stored = await storage.statObject(evidence.quarantineKey);

  if (!stored) {
    return failure(
      "EVIDENCE_UPLOAD_MISSING",
      "We couldn't find the upload. Upload the file, then try again.",
    );
  }

  if (stored.size <= 0) {
    return failure(
      "EVIDENCE_EMPTY",
      "The uploaded file is empty. Choose a file with content and upload it again.",
    );
  }

  if (stored.size > MAX_EVIDENCE_BYTES) {
    return failure(
      "EVIDENCE_TOO_LARGE",
      "This file is too large. Choose an evidence file of 25 MB or less.",
    );
  }

  if (stored.size !== evidence.fileSize) {
    return failure(
      "EVIDENCE_SIZE_MISMATCH",
      "The uploaded file's size doesn't match the file selected at the start. Choose the file again and retry the upload.",
    );
  }

  const object = await storage.getObject(evidence.quarantineKey);

  if (!object) {
    return failure(
      "EVIDENCE_UPLOAD_MISSING",
      "We couldn't read the uploaded file. Try uploading it again.",
    );
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

    return failure(
      "EVIDENCE_TYPE_UNKNOWN",
      "We couldn't verify this file's content. Check that it's a supported file and try uploading it again.",
    );
  }

  if (!mimeTypesCompatible(evidence.mimeType, detected)) {
    await storage.deleteObject(evidence.quarantineKey);

    return failure(
      "EVIDENCE_TYPE_MISMATCH",
      "The file's content doesn't match its selected type. Check the format and choose the correct file before uploading again.",
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
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
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
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  const investigation = await store.findInvestigation(actor.workspaceId, evidence.investigationId);

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
    : failure(
        "EVIDENCE_NOT_FOUND",
        "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
      );
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
      "Ask a workspace owner, admin, or reviewer to complete the redaction review.",
    );
  }

  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence) {
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  const investigation = await store.findInvestigation(actor.workspaceId, evidence.investigationId);

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

  if (evidence.storageKey) {
    return failure(
      "EVIDENCE_ALREADY_ACTIVE",
      "This evidence is already active. Use a reviewed replacement if the file needs to change.",
    );
  }

  if (!evidence.quarantineKey) {
    return failure(
      "EVIDENCE_NOT_UPLOADED",
      "There's no quarantined file to review for this evidence. Check its upload status first.",
    );
  }

  const quarantineKey = evidence.quarantineKey;

  if (parsed.data.decision === "REJECT") {
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

    if (rejected) {
      try {
        await storage.deleteObject(quarantineKey);
      } catch {
        /* The recorded cleanup job retains the original key and retries. */
      }
    }

    return rejected
      ? { ok: true, value: { id: rejected.id, redactionStatus: rejected.redactionStatus } }
      : failure(
          "EVIDENCE_NOT_FOUND",
          "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
        );
  }

  if (!evidence.uploadValidatedAt) {
    return failure(
      "UPLOAD_NOT_VALIDATED",
      "Finish the upload and its validation checks first, then approve the evidence after review.",
    );
  }

  const nextStatus: "REDACTED" | "VERIFIED_SAFE" =
    parsed.data.decision === "APPROVE_REDACTED" ? "REDACTED" : "VERIFIED_SAFE";
  const inPlace = storage.promotionMode === "IN_PLACE";
  const destination = inPlace
    ? quarantineKey
    : activeStorageKey(actor.workspaceId, evidence.investigationId, evidence.id, evidence.version);

  const activationData = {
    storageKey: destination,
    expectedChecksum: evidence.checksum,
    expectedVersion: evidence.version,
    redactionStatus: nextStatus,
    redactionMethod: "HUMAN_REVIEW" as const,
    redactionReviewedBy: actor.userId,
    redactionReviewedAt: now,
    activatedAt: now,
  };
  await store.prepareActivation(actor, evidenceId, activationData);

  if (!inPlace) {
    try {
      await storage.copyObject(quarantineKey, destination);
    } catch {
      return failure(
        "EVIDENCE_ACTIVATION_RETRY_QUEUED",
        "Your review is saved, but moving the file out of quarantine needs a retry. It's queued, and the quarantined original is still retained.",
      );
    }
  }

  const copy = await storage.getObject(destination);

  if (!copy || createHash("sha256").update(copy.body).digest("hex") !== evidence.checksum) {
    return failure(
      "EVIDENCE_ACTIVATION_FAILED",
      "The stored file didn't pass verification, so the evidence wasn't activated. Check its status before continuing.",
    );
  }

  const activated = await store.activateEvidence(
    actor.workspaceId,
    evidenceId,
    activationData,
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
    const current = await store.findEvidence(actor.workspaceId, evidenceId);
    if (
      current?.storageKey === destination &&
      current.redactionStatus === nextStatus &&
      current.redactionReviewedBy === actor.userId
    )
      return { ok: true, value: { id: current.id, redactionStatus: current.redactionStatus } };
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  if (!inPlace) {
    try {
      await storage.deleteObject(quarantineKey);
    } catch {
      /* The promotion job retries cleanup after the verified activation. */
    }
  }

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
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has already been deleted.");
  }

  if (!isReviewer(actor.role) && evidence.uploadedBy !== actor.userId) {
    return failure(
      "FORBIDDEN_EVIDENCE_DELETE",
      "Ask the uploader or a reviewer to delete this evidence.",
    );
  }

  if (evidence.findingLinkCount > 0) {
    return failure("EVIDENCE_IN_USE", "Remove the evidence from its findings before deleting it.");
  }

  const deletion = await researchOperation(() =>
    store.softDeleteEvidence(
      actor.workspaceId,
      evidenceId,
      now,
      auditDraft(actor, "EVIDENCE_DELETED", "Evidence", {
        previousValue: { redactionStatus: evidence.redactionStatus },
        newValue: { deleted: true },
      }),
    ),
  );

  if (!deletion.ok) return deletion;
  const deleted = deletion.value;
  if (deleted) {
    if (evidence.storageKey) {
      await storage.deleteObject(evidence.storageKey);
    }

    if (evidence.quarantineKey) {
      await storage.deleteObject(evidence.quarantineKey);
    }
  }

  return deleted
    ? { ok: true, value: { id: evidenceId } }
    : failure(
        "EVIDENCE_NOT_FOUND",
        "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
      );
}

export async function createEvidenceDownload(
  store: EvidenceStore,
  storage: EvidenceStorage,
  actor: EvidenceActor,
  evidenceId: string,
): Promise<DomainResult<{ url: string; expiresAt: Date }>> {
  const evidence = await store.findEvidence(actor.workspaceId, evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  if (evidence.deletedAt) {
    return failure("EVIDENCE_DELETED", "That evidence has been deleted.");
  }

  const key = evidence.storageKey ?? evidence.quarantineKey;

  if (!key) {
    return failure(
      "EVIDENCE_NOT_UPLOADED",
      "There's no stored file available for this evidence. Check the record's upload status.",
    );
  }

  if (!evidence.storageKey && !isReviewer(actor.role)) {
    return failure(
      "EVIDENCE_NOT_APPROVED",
      "Only the uploader or a reviewer can download a quarantined file. Ask them to inspect it and complete the review.",
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
    return failure(
      "VALIDATION_FAILED",
      "Choose approved evidence and say how it relates to the finding.",
    );
  }

  const evidence = await store.findEvidence(actor.workspaceId, parsed.data.evidenceId);

  if (!evidence || !canView(actor, evidence)) {
    return failure(
      "EVIDENCE_NOT_FOUND",
      "We can't find that evidence in this workspace. Open Evidence to choose an available record.",
    );
  }

  if (!isApprovedEvidence(evidence.redactionStatus) || !evidence.storageKey) {
    return failure(
      "EVIDENCE_NOT_APPROVED",
      "Complete the evidence review and approval before linking it to a finding.",
    );
  }

  const finding = await store.findFindingForLink(actor.workspaceId, parsed.data.findingId);

  if (!finding || finding.investigationId !== evidence.investigationId) {
    return failure(
      "FINDING_NOT_FOUND",
      "Choose a finding from this investigation to connect the evidence.",
    );
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
  return removeResearchEvidenceLink(() =>
    store.removeLink(
      actor.workspaceId,
      linkId,
      auditDraft(actor, "EVIDENCE_LINK_REMOVED", "EvidenceLink", { previousValue: { linkId } }),
    ),
  );
}
