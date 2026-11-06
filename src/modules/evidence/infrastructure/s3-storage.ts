import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getServerEnv } from "@/config/env.server";

import type {
  DownloadedEvidenceObject,
  EvidenceDownloadTarget,
  EvidenceStorage,
  EvidenceUploadTarget,
  StoredEvidenceObject,
} from "../application/storage";

const SIGNED_URL_SECONDS = 5 * 60;

export type S3EvidenceStorageOptions = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export class S3EvidenceStorage implements EvidenceStorage {
  readonly kind = "S3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3EvidenceStorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async createUploadTarget(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<EvidenceUploadTarget> {
    const expiresIn = Math.min(input.expiresInSeconds, SIGNED_URL_SECONDS);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.mimeType,
      }),
      { expiresIn },
    );

    return {
      url,
      method: "PUT",
      headers: { "content-type": input.mimeType },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async statObject(key: string): Promise<StoredEvidenceObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        key,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async getObject(key: string): Promise<DownloadedEvidenceObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      if (!result.Body) {
        return null;
      }

      const body = Buffer.from(await result.Body.transformToByteArray());

      return { body, contentType: result.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeURIComponent(`${this.bucket}/${sourceKey}`),
        Key: destinationKey,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async createDownloadTarget(input: {
    key: string;
    mimeType: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<EvidenceDownloadTarget> {
    const expiresIn = Math.min(input.expiresInSeconds, SIGNED_URL_SECONDS);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ResponseContentType: input.mimeType,
        ResponseContentDisposition: contentDisposition(input.mimeType, input.fileName),
      }),
      { expiresIn },
    );

    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      error.name === "404" ||
      ("$metadata" in error &&
        typeof error.$metadata === "object" &&
        error.$metadata !== null &&
        "httpStatusCode" in error.$metadata &&
        error.$metadata.httpStatusCode === 404))
  );
}

export function contentDisposition(mimeType: string, fileName: string): string {
  const safeName = fileName.replace(/["\\\r\n]/g, "_");
  const inline = mimeType.startsWith("image/");

  return `${inline ? "inline" : "attachment"}; filename="${safeName}"`;
}

export function s3StorageFromEnv(): S3EvidenceStorage | null {
  const env = getServerEnv();

  if (
    !env.STORAGE_ENDPOINT ||
    !env.STORAGE_REGION ||
    !env.STORAGE_BUCKET ||
    !env.STORAGE_ACCESS_KEY_ID ||
    !env.STORAGE_SECRET_ACCESS_KEY
  ) {
    return null;
  }

  return new S3EvidenceStorage({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  });
}
