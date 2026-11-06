import { describe, expect, it } from "vitest";

import {
  activeStorageKey,
  detectMimeType,
  evidenceIntentSchema,
  evidenceMimeTypeSchema,
  isApprovedEvidence,
  MAX_EVIDENCE_BYTES,
  mimeTypesCompatible,
  quarantineStorageKey,
  redactionReviewSchema,
  safeFileName,
  scanTextForSensitiveData,
  storedMimeType,
  totalScanFindings,
} from "@/modules/evidence/domain/evidence";

describe("evidence MIME validation", () => {
  it("rejects HTML and SVG", () => {
    expect(evidenceMimeTypeSchema.safeParse("text/html").success).toBe(false);
    expect(evidenceMimeTypeSchema.safeParse("image/svg+xml").success).toBe(false);
  });

  it("detects PNG, JPEG, WebP, and PDF magic bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const webp = Buffer.from("RIFF0000WEBP", "ascii");
    const pdf = Buffer.from("%PDF-1.7", "ascii");

    expect(detectMimeType(png)).toBe("image/png");
    expect(detectMimeType(jpeg)).toBe("image/jpeg");
    expect(detectMimeType(webp)).toBe("image/webp");
    expect(detectMimeType(pdf)).toBe("application/pdf");
  });

  it("detects JSON and plain text structurally", () => {
    expect(detectMimeType(Buffer.from('{"a":1}'))).toBe("application/json");
    expect(detectMimeType(Buffer.from("plain observation"))).toBe("text/plain");
  });

  it("allows a text declaration to match a generic text detection", () => {
    expect(mimeTypesCompatible("text/csv", "text/plain")).toBe(true);
    expect(mimeTypesCompatible("application/x-ndjson", "text/plain")).toBe(true);
    expect(mimeTypesCompatible("image/png", "text/plain")).toBe(false);
    expect(mimeTypesCompatible("text/xml", "application/xml")).toBe(true);
  });

  it("stores the declared text subtype while storing detected binary types", () => {
    expect(storedMimeType("text/csv", "text/plain")).toBe("text/csv");
    expect(storedMimeType("image/png", "image/png")).toBe("image/png");
  });
});

describe("evidence intent validation", () => {
  const valid = {
    investigationId: "00000000-0000-4000-8000-000000000000",
    evidenceType: "SCREENSHOT",
    title: "Login response",
    description: "",
    fileName: "response.png",
    mimeType: "image/png",
    fileSize: 1024,
    checksum: "a".repeat(64),
    source: "",
  };

  it("accepts an allowed intent", () => {
    expect(evidenceIntentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects files above 25 MB", () => {
    expect(
      evidenceIntentSchema.safeParse({ ...valid, fileSize: MAX_EVIDENCE_BYTES + 1 }).success,
    ).toBe(false);
  });

  it("rejects a malformed checksum", () => {
    expect(evidenceIntentSchema.safeParse({ ...valid, checksum: "not-a-checksum" }).success).toBe(
      false,
    );
  });
});

describe("redaction policy", () => {
  it("only approves REDACTED and VERIFIED_SAFE", () => {
    expect(isApprovedEvidence("REDACTED")).toBe(true);
    expect(isApprovedEvidence("VERIFIED_SAFE")).toBe(true);
    expect(isApprovedEvidence("NOT_REVIEWED")).toBe(false);
    expect(isApprovedEvidence("QUARANTINED")).toBe(false);
  });

  it("requires a note when rejecting evidence", () => {
    expect(redactionReviewSchema.safeParse({ decision: "REJECT", note: "" }).success).toBe(false);
    expect(
      redactionReviewSchema.safeParse({ decision: "REJECT", note: "Contains a token." }).success,
    ).toBe(true);
  });
});

describe("evidence keys and file names", () => {
  it("separates quarantine and active keys", () => {
    expect(quarantineStorageKey("ws", "ev", "upload")).toBe("quarantine/ws/ev/upload");
    expect(activeStorageKey("ws", "inv", "ev", 2)).toBe("evidence/ws/inv/ev/v2");
  });

  it("strips directory traversal from file names", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("my file.png")).toBe("my file.png");
  });
});

describe("advisory sensitive-data scan", () => {
  it("returns counts without echoing matched values", () => {
    const counts = scanTextForSensitiveData(
      [
        "-----BEGIN RSA PRIVATE KEY-----",
        "AKIAABCDEFGHIJKLMNOP",
        "password=hunter2",
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
        "person@example.test",
      ].join("\n"),
    );

    expect(counts.private_key).toBe(1);
    expect(counts.cloud_access_key).toBe(1);
    expect(counts.credential_assignment).toBeGreaterThanOrEqual(1);
    expect(counts.bearer_token).toBe(1);
    expect(counts.email_address).toBe(1);
    expect(totalScanFindings(counts)).toBeGreaterThan(0);
  });

  it("returns zero counts for clean text", () => {
    expect(totalScanFindings(scanTextForSensitiveData("The login form accepted input."))).toBe(0);
  });
});
