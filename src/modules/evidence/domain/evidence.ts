import { z } from "zod";

import { optionalText } from "@/modules/research/domain/fields";

export const EVIDENCE_TYPES = [
  "SCREENSHOT",
  "HTTP_REQUEST",
  "HTTP_RESPONSE",
  "TEXT_OBSERVATION",
  "DOCUMENT",
  "LOG",
  "EXTERNAL_REFERENCE",
  "REPRODUCTION_NOTE",
  "OTHER",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  SCREENSHOT: "Screenshot",
  HTTP_REQUEST: "HTTP request",
  HTTP_RESPONSE: "HTTP response",
  TEXT_OBSERVATION: "Text observation",
  DOCUMENT: "Document",
  LOG: "Log",
  EXTERNAL_REFERENCE: "External reference",
  REPRODUCTION_NOTE: "Reproduction note",
  OTHER: "Other",
};

export const EVIDENCE_LINK_RELATIONSHIPS = [
  "SUPPORTS",
  "CONTRADICTS",
  "CONTEXT",
  "REPRODUCTION",
] as const;

export type EvidenceLinkRelationship = (typeof EVIDENCE_LINK_RELATIONSHIPS)[number];

export const EVIDENCE_LINK_RELATIONSHIP_LABELS: Record<EvidenceLinkRelationship, string> = {
  SUPPORTS: "Supports",
  CONTRADICTS: "Contradicts",
  CONTEXT: "Context",
  REPRODUCTION: "Reproduction",
};

export const REDACTION_METHODS = ["NONE", "CLIENT_MASK", "HUMAN_REVIEW"] as const;

export type RedactionMethod = (typeof REDACTION_METHODS)[number];

export const REDACTION_STATUSES = [
  "NOT_REVIEWED",
  "QUARANTINED",
  "REDACTED",
  "VERIFIED_SAFE",
] as const;

export type RedactionStatus = (typeof REDACTION_STATUSES)[number];

export const REDACTION_STATUS_LABELS: Record<RedactionStatus, string> = {
  NOT_REVIEWED: "Awaiting redaction review",
  QUARANTINED: "Quarantined",
  REDACTED: "Redacted",
  VERIFIED_SAFE: "Verified safe",
};

/** ADR-019: evidence files are limited to 25 MB. */
export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

/** ADR-019 MIME allowlist. HTML and SVG are deliberately excluded. */
export const EVIDENCE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/x-ndjson",
] as const;

export type EvidenceMimeType = (typeof EVIDENCE_MIME_TYPES)[number];

export const evidenceMimeTypeSchema = z.enum(EVIDENCE_MIME_TYPES);

export function isEvidenceMimeType(value: string): value is EvidenceMimeType {
  return (EVIDENCE_MIME_TYPES as readonly string[]).includes(value);
}

export function isApprovedEvidence(status: RedactionStatus): boolean {
  return status === "REDACTED" || status === "VERIFIED_SAFE";
}

/**
 * Only text-like evidence can enter AI context as content (ADR-013 §10).
 * Images and PDFs contribute metadata only; their bytes are never sent.
 */
export function isTextEvidenceMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "text/xml" ||
    mimeType === "application/x-ndjson"
  );
}

export const evidenceIntentSchema = z.object({
  investigationId: z.string().uuid(),
  evidenceType: z.enum(EVIDENCE_TYPES),
  title: z.string().trim().min(2, "Use at least 2 characters.").max(150),
  description: optionalText(2000),
  fileName: z.string().trim().min(1, "Choose a file.").max(255),
  mimeType: evidenceMimeTypeSchema,
  fileSize: z.coerce
    .number()
    .int()
    .min(1, "This file is empty. Choose a file with content to upload.")
    .max(MAX_EVIDENCE_BYTES, "This file is too large. Choose an evidence file of 25 MB or less."),
  checksum: z
    .string()
    .trim()
    .regex(
      /^[a-f0-9]{64}$/i,
      "We couldn't verify the file's checksum. Choose the file again so its checksum can be recalculated.",
    ),
  source: optionalText(500),
});

export type EvidenceIntentInput = z.infer<typeof evidenceIntentSchema>;

export const evidenceMetadataUpdateSchema = z.object({
  title: z.string().trim().min(2, "Use at least 2 characters.").max(150),
  description: optionalText(2000),
  evidenceType: z.enum(EVIDENCE_TYPES),
  source: optionalText(500),
});

export type EvidenceMetadataUpdateInput = z.infer<typeof evidenceMetadataUpdateSchema>;

export const REDACTION_DECISIONS = ["APPROVE_SAFE", "APPROVE_REDACTED", "REJECT"] as const;

export type RedactionDecision = (typeof REDACTION_DECISIONS)[number];

export const redactionReviewSchema = z
  .object({
    decision: z.enum(REDACTION_DECISIONS),
    note: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "REJECT" && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Explain why the evidence was rejected.",
      });
    }
  });

export type RedactionReviewInput = z.infer<typeof redactionReviewSchema>;

export const evidenceLinkSchema = z.object({
  evidenceId: z.string().uuid(),
  findingId: z.string().uuid(),
  relationshipType: z.enum(EVIDENCE_LINK_RELATIONSHIPS),
});

export type EvidenceLinkInput = z.infer<typeof evidenceLinkSchema>;

export function quarantineStorageKey(
  workspaceId: string,
  evidenceId: string,
  uploadId: string,
): string {
  return `quarantine/${workspaceId}/${evidenceId}/${uploadId}`;
}

export function activeStorageKey(
  workspaceId: string,
  investigationId: string,
  evidenceId: string,
  version: number,
): string {
  return `evidence/${workspaceId}/${investigationId}/${evidenceId}/v${version}`;
}

export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "evidence";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 255) || "evidence";
}

type ScanCategory =
  | "private_key"
  | "cloud_access_key"
  | "credential_assignment"
  | "bearer_token"
  | "email_address"
  | "payment_card";

/**
 * Advisory secret and personal-data scan (ADR-013). Only categories and
 * counts are persisted; matched values never leave this function.
 */
export function scanTextForSensitiveData(text: string): Record<ScanCategory, number> {
  const patterns: Record<ScanCategory, RegExp> = {
    private_key: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    cloud_access_key: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    credential_assignment:
      /(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*\S{6,}/gi,
    bearer_token: /\bBearer\s+[A-Za-z0-9\-._~+/]{16,}=*/g,
    email_address: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    payment_card: /\b(?:\d[ -]*?){13,16}\b/g,
  };

  const counts = {} as Record<ScanCategory, number>;

  for (const [category, pattern] of Object.entries(patterns) as Array<[ScanCategory, RegExp]>) {
    counts[category] = text.match(pattern)?.length ?? 0;
  }

  return counts;
}

export function totalScanFindings(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function decodeText(buffer: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

/**
 * Magic-byte / content sniffing used during finalize (ADR-019). Text formats
 * have no magic bytes, so they are detected structurally and validated as
 * UTF-8. Returns null when the content does not match any allowed family.
 */
export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length === 0) {
    return null;
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  const text = decodeText(buffer);

  if (text === null) {
    return null;
  }

  const trimmed = text.trimStart();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "application/json";
    } catch {
      // Not valid JSON; fall through to plain text.
    }
  }

  if (trimmed.startsWith("<?xml") || /^<[A-Za-z]/.test(trimmed)) {
    return "application/xml";
  }

  return "text/plain";
}

/**
 * A detected type may be less specific than the declared type for text
 * families. Binary types must match exactly.
 */
export function mimeTypesCompatible(declared: string, detected: string): boolean {
  if (declared === detected) {
    return true;
  }

  if (detected === "text/plain") {
    return (
      declared === "text/csv" || declared === "text/plain" || declared === "application/x-ndjson"
    );
  }

  if (detected === "application/xml") {
    return declared === "application/xml" || declared === "text/xml";
  }

  return false;
}

export function storedMimeType(declared: string, detected: string): string {
  return detected === "text/plain" ? declared : detected;
}
