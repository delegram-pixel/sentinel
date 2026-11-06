import "server-only";

import { getServerEnv } from "@/config/env.server";

import { EvidenceStorageConfigurationError, type EvidenceStorage } from "../application/storage";
import { LocalEvidenceStorage } from "./local-storage";
import { s3StorageFromEnv } from "./s3-storage";

/**
 * Composition root for evidence storage. Production must use the configured
 * S3-compatible bucket; local filesystem storage is a development fallback.
 */
export function createEvidenceStorage(): EvidenceStorage {
  const s3 = s3StorageFromEnv();

  if (s3) {
    return s3;
  }

  const env = getServerEnv();

  if (env.NODE_ENV === "production") {
    throw new EvidenceStorageConfigurationError();
  }

  return new LocalEvidenceStorage();
}
