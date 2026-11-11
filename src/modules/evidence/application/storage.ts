export type EvidenceUploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
};

export type StoredEvidenceObject = {
  key: string;
  size: number;
  contentType: string | null;
};

export type DownloadedEvidenceObject = {
  body: Buffer;
  contentType: string | null;
};

export type EvidenceDownloadTarget = {
  url: string;
  expiresAt: Date;
};

export type EvidenceStorageKind = "UPLOADTHING" | "LOCAL" | "MEMORY";

/**
 * How an approved upload becomes active evidence.
 * - `COPY`: copy quarantine → active key, then delete the original.
 * - `IN_PLACE`: the quarantined object is already private and immutable, so
 *   activation only changes its database state.
 */
export type EvidencePromotionMode = "COPY" | "IN_PLACE";

/**
 * Storage boundary for evidence (ADR-019). Application code never imports a
 * provider SDK directly; tests use an in-memory implementation.
 */
export interface EvidenceStorage {
  readonly kind: EvidenceStorageKind;
  readonly promotionMode: EvidencePromotionMode;
  createUploadTarget(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<EvidenceUploadTarget>;
  statObject(key: string): Promise<StoredEvidenceObject | null>;
  getObject(key: string): Promise<DownloadedEvidenceObject | null>;
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  createDownloadTarget(input: {
    key: string;
    mimeType: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<EvidenceDownloadTarget>;
}

export class EvidenceStorageConfigurationError extends Error {
  constructor(message = "Private evidence storage is not configured on this deployment.") {
    super(message);
    this.name = "EvidenceStorageConfigurationError";
  }
}
