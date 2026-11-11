import { describe, expect, it, vi } from "vitest";

import {
  UploadThingEvidenceStorage,
  type UploadThingApi,
} from "@/modules/evidence/infrastructure/uploadthing-storage";

function createStorage(fetchImpl: typeof fetch, deleteSuccess = true) {
  const api: UploadThingApi = {
    generateSignedURL: vi.fn(async () => ({ ufsUrl: "https://ut.example/signed" })),
    deleteFiles: vi.fn(async () => ({ success: deleteSuccess, deletedCount: 1 })),
  };

  return { api, storage: new UploadThingEvidenceStorage({ api, fetchImpl }) };
}

describe("UploadThingEvidenceStorage", () => {
  it("refuses the presigned upload flow because uploads use the FileRouter", async () => {
    const { storage } = createStorage(vi.fn() as unknown as typeof fetch);

    await expect(storage.createUploadTarget()).rejects.toThrow(/FileRouter/);
  });

  it("stats a private object through a signed URL", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(null, {
        status: 200,
        headers: { "content-length": "42", "content-type": "text/plain" },
      });
    }) as unknown as typeof fetch;
    const { storage } = createStorage(fetchImpl);

    await expect(storage.statObject("file-key")).resolves.toEqual({
      key: "file-key",
      size: 42,
      contentType: "text/plain",
    });
  });

  it("treats a missing or forbidden object as absent", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;
    const { storage } = createStorage(fetchImpl);

    await expect(storage.statObject("file-key")).resolves.toBeNull();
  });

  it("falls back to GET when the signed URL rejects HEAD", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 405 });
      }

      return new Response("evidence", {
        status: 200,
        headers: { "content-length": "8", "content-type": "text/plain" },
      });
    }) as unknown as typeof fetch;
    const { storage } = createStorage(fetchImpl);

    await expect(storage.statObject("file-key")).resolves.toEqual({
      key: "file-key",
      size: 8,
      contentType: "text/plain",
    });
  });

  it("downloads object bytes through a signed URL", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("evidence", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }) as unknown as typeof fetch;
    const { storage } = createStorage(fetchImpl);

    const object = await storage.getObject("file-key");

    expect(object?.body.toString("utf8")).toBe("evidence");
    expect(object?.contentType).toBe("text/plain");
  });

  it("returns a short-lived signed download URL", async () => {
    const { api, storage } = createStorage(vi.fn() as unknown as typeof fetch);

    const target = await storage.createDownloadTarget({
      key: "file-key",
      mimeType: "text/plain",
      fileName: "evidence.txt",
      expiresInSeconds: 3600,
    });

    expect(target.url).toBe("https://ut.example/signed");
    expect(api.generateSignedURL).toHaveBeenCalledWith("file-key", { expiresIn: 300 });
    expect(target.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("deletes through UTApi and surfaces failures", async () => {
    const { storage } = createStorage(vi.fn() as unknown as typeof fetch);
    await expect(storage.deleteObject("file-key")).resolves.toBeUndefined();

    const failing = createStorage(vi.fn() as unknown as typeof fetch, false);
    await expect(failing.storage.deleteObject("file-key")).rejects.toThrow();
  });

  it("rejects the copy promotion path", async () => {
    const { storage } = createStorage(vi.fn() as unknown as typeof fetch);

    await expect(storage.copyObject()).rejects.toThrow(/in place/);
  });
});
