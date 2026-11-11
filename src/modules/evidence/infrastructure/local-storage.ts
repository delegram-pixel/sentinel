import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/config/env.server";

import type {
  DownloadedEvidenceObject,
  EvidenceDownloadTarget,
  EvidenceStorage,
  EvidenceUploadTarget,
  StoredEvidenceObject,
} from "../application/storage";

const LOCAL_SECONDS = 5 * 60;
const LOCAL_SIGNING_CONTEXT = "sentinel-local-evidence";

export function localStorageRoot(): string {
  return getServerEnv().EVIDENCE_LOCAL_DIR || path.join(process.cwd(), ".data", "evidence");
}

function localSecret(): string {
  return getServerEnv().EVIDENCE_LOCAL_SIGNING_SECRET?.trim() || "sentinel-local-development-only";
}

function safeKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 512 &&
    !key.startsWith("/") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    /^[A-Za-z0-9._/-]+$/.test(key)
  );
}

export function localObjectPath(key: string): string {
  if (!safeKey(key)) {
    throw new Error("Invalid local evidence key.");
  }

  const root = localStorageRoot();
  const resolved = path.resolve(/* turbopackIgnore: true */ root, key);

  if (!resolved.startsWith(`${path.resolve(/* turbopackIgnore: true */ root)}${path.sep}`)) {
    throw new Error("Invalid local evidence key.");
  }

  return resolved;
}

export function signLocalEvidenceRequest(
  operation: "upload" | "download",
  key: string,
  expiresAtSeconds: number,
): string {
  return createHmac("sha256", localSecret())
    .update(`${LOCAL_SIGNING_CONTEXT}:${operation}:${key}:${expiresAtSeconds}`)
    .digest("hex");
}

export function verifyLocalEvidenceRequest(input: {
  operation: "upload" | "download";
  key: string;
  expiresAtSeconds: number;
  signature: string;
}): boolean {
  if (!Number.isFinite(input.expiresAtSeconds) || input.expiresAtSeconds * 1000 < Date.now()) {
    return false;
  }

  if (!safeKey(input.key) || !/^[a-f0-9]{64}$/i.test(input.signature)) {
    return false;
  }

  const expected = signLocalEvidenceRequest(input.operation, input.key, input.expiresAtSeconds);

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.signature, "hex"));
}

function localUrl(operation: "upload" | "download", key: string): string {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + LOCAL_SECONDS;
  const signature = signLocalEvidenceRequest(operation, key, expiresAtSeconds);
  const params = new URLSearchParams({
    key,
    expires: String(expiresAtSeconds),
    signature,
  });

  return `/api/evidence/local-${operation}?${params.toString()}`;
}

/**
 * Development-only filesystem adapter. It mirrors the two-step upload flow so
 * the UI and service can be exercised without an UploadThing token. Production
 * uses `UploadThingEvidenceStorage`.
 */
export class LocalEvidenceStorage implements EvidenceStorage {
  readonly kind = "LOCAL" as const;
  readonly promotionMode = "COPY" as const;

  async createUploadTarget(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<EvidenceUploadTarget> {
    return {
      url: localUrl("upload", input.key),
      method: "PUT",
      headers: { "content-type": input.mimeType },
      expiresAt: new Date(Date.now() + Math.min(input.expiresInSeconds, LOCAL_SECONDS) * 1000),
    };
  }

  async statObject(key: string): Promise<StoredEvidenceObject | null> {
    try {
      const info = await stat(localObjectPath(key));

      return { key, size: info.size, contentType: null };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<DownloadedEvidenceObject | null> {
    try {
      return { body: await readFile(localObjectPath(key)), contentType: null };
    } catch {
      return null;
    }
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const body = await readFile(localObjectPath(sourceKey));
    const destination = localObjectPath(destinationKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body);
  }

  async deleteObject(key: string): Promise<void> {
    await rm(localObjectPath(key), { force: true });
  }

  async createDownloadTarget(input: {
    key: string;
    mimeType: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<EvidenceDownloadTarget> {
    return {
      url: localUrl("download", input.key),
      expiresAt: new Date(Date.now() + Math.min(input.expiresInSeconds, LOCAL_SECONDS) * 1000),
    };
  }
}

export async function writeLocalEvidenceObject(key: string, body: Buffer): Promise<void> {
  const destination = localObjectPath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

export async function readLocalEvidenceObject(key: string): Promise<Buffer> {
  return readFile(localObjectPath(key));
}
