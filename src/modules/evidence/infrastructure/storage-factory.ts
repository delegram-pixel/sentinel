import "server-only";

import { getServerEnv } from "@/config/env.server";

import { EvidenceStorageConfigurationError, type EvidenceStorage } from "../application/storage";
import { LocalEvidenceStorage } from "./local-storage";
import { UploadThingEvidenceStorage } from "./uploadthing-storage";

/**
 * Composition root for evidence storage. Production must configure an
 * UploadThing token; the local filesystem is a development/test fallback.
 */
export function createEvidenceStorage(): EvidenceStorage {
  const env = getServerEnv();

  if (env.UPLOADTHING_TOKEN) {
    return new UploadThingEvidenceStorage({ token: env.UPLOADTHING_TOKEN });
  }

  if (env.NODE_ENV === "production") {
    throw new EvidenceStorageConfigurationError(
      "Private evidence storage is not configured. Set UPLOADTHING_TOKEN on this deployment.",
    );
  }

  return new LocalEvidenceStorage();
}
