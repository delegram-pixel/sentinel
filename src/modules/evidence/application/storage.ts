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

/**
 * Storage boundary for evidence (ADR-019). Application code never imports an
 * S3 client directly; tests use an in-memory implementation.
 */
export interface EvidenceStorage {
  readonly kind: "S3" | "LOCAL" | "MEMORY";
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
