import "server-only";

import { UTApi } from "uploadthing/server";

import type {
  DownloadedEvidenceObject,
  EvidenceDownloadTarget,
  EvidenceStorage,
  EvidenceUploadTarget,
  StoredEvidenceObject,
} from "../application/storage";

const DOWNLOAD_URL_SECONDS = 5 * 60;

/**
 * The subset of UTApi this adapter needs. Tests inject a deterministic fake
 * instead of making network calls.
 */
export type UploadThingApi = Pick<UTApi, "deleteFiles" | "generateSignedURL">;

export type UploadThingEvidenceStorageOptions = {
  token?: string;
  api?: UploadThingApi;
  fetchImpl?: typeof fetch;
};

/**
 * Evidence storage backed by UploadThing.
 *
 * Files are uploaded by the browser through the authenticated FileRouter and
 * remain private (the UploadThing app must use the `private` ACL). Quarantine
 * is therefore a database state rather than a second physical copy, which is
 * why promotion is `IN_PLACE`.
 */
export class UploadThingEvidenceStorage implements EvidenceStorage {
  readonly kind = "UPLOADTHING" as const;
  readonly promotionMode = "IN_PLACE" as const;

  private readonly api: UploadThingApi;
  private readonly fetchImpl: typeof fetch;

  constructor(options: UploadThingEvidenceStorageOptions = {}) {
    this.api = options.api ?? new UTApi({ token: options.token });
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createUploadTarget(): Promise<EvidenceUploadTarget> {
    throw new Error("UploadThing uploads must go through the authenticated FileRouter.");
  }

  async statObject(key: string): Promise<StoredEvidenceObject | null> {
    const signed = await this.api.generateSignedURL(key, { expiresIn: DOWNLOAD_URL_SECONDS });
    let response = await this.fetchImpl(signed.ufsUrl, { method: "HEAD" });

    // Some signed-URL providers sign the method and reject HEAD. Fall back to a
    // GET so finalize still gets a size instead of treating the object as absent.
    if (response.status === 403 || response.status === 405) {
      response = await this.fetchImpl(signed.ufsUrl);
    }

    if (response.status === 403 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return {
      key,
      size: Number(response.headers.get("content-length") ?? 0),
      contentType: response.headers.get("content-type"),
    };
  }

  async getObject(key: string): Promise<DownloadedEvidenceObject | null> {
    const signed = await this.api.generateSignedURL(key, { expiresIn: DOWNLOAD_URL_SECONDS });
    const response = await this.fetchImpl(signed.ufsUrl);

    if (response.status === 403 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type"),
    };
  }

  async copyObject(): Promise<void> {
    throw new Error("UploadThing evidence is promoted in place; there is no second copy.");
  }

  async deleteObject(key: string): Promise<void> {
    const result = await this.api.deleteFiles(key);

    if (!result.success) {
      throw new Error("UploadThing did not delete the evidence object.");
    }
  }

  async createDownloadTarget(input: {
    key: string;
    mimeType: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<EvidenceDownloadTarget> {
    const expiresIn = Math.max(1, Math.min(input.expiresInSeconds, DOWNLOAD_URL_SECONDS));
    const signed = await this.api.generateSignedURL(input.key, { expiresIn });

    return {
      url: signed.ufsUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
}
