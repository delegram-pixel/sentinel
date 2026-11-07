import { createHash } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  createEvidenceDownload,
  createEvidenceUploadIntent,
  deleteEvidence,
  finalizeEvidenceUpload,
  getEvidence,
  linkEvidence,
  removeEvidenceLink,
  reviewEvidenceRedaction,
} from "@/modules/evidence/application/evidence-service";
import type {
  DownloadedEvidenceObject,
  EvidenceDownloadTarget,
  EvidenceStorage,
  EvidenceUploadTarget,
  StoredEvidenceObject,
} from "@/modules/evidence/application/storage";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

class MemoryEvidenceStorage implements EvidenceStorage {
  readonly kind = "MEMORY" as const;
  readonly objects = new Map<string, { body: Buffer; mimeType: string }>();
  lastUploadKey: string | null = null;

  async createUploadTarget(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<EvidenceUploadTarget> {
    this.lastUploadKey = input.key;

    return {
      url: `memory://${input.key}`,
      method: "PUT",
      headers: { "content-type": input.mimeType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    };
  }

  async statObject(key: string): Promise<StoredEvidenceObject | null> {
    const object = this.objects.get(key);

    return object ? { key, size: object.body.length, contentType: object.mimeType } : null;
  }

  async getObject(key: string): Promise<DownloadedEvidenceObject | null> {
    const object = this.objects.get(key);

    return object ? { body: object.body, contentType: object.mimeType } : null;
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const source = this.objects.get(sourceKey);

    if (!source) {
      throw new Error("Missing source object.");
    }

    this.objects.set(destinationKey, {
      body: Buffer.from(source.body),
      mimeType: source.mimeType,
    });
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async createDownloadTarget(input: {
    key: string;
    mimeType: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<EvidenceDownloadTarget> {
    return {
      url: `memory://download/${input.key}`,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    };
  }

  put(key: string, body: Buffer, mimeType = "text/plain"): void {
    this.objects.set(key, { body, mimeType });
  }
}

function checksumOf(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

function intentFor(investigationId: string, body: Buffer, overrides: Record<string, unknown> = {}) {
  return {
    investigationId,
    evidenceType: "HTTP_REQUEST",
    title: "Search request and response",
    description: "Captured during a permitted lab session.",
    fileName: "search-request.txt",
    mimeType: "text/plain",
    fileSize: body.byteLength,
    checksum: checksumOf(body),
    source: "Manual request",
    ...overrides,
  };
}

describe("evidence lifecycle", () => {
  it("shares approved evidence with workspace researchers while keeping quarantine and foreign workspaces private", () =>
    withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const foreign = await createTenancy(tx);
      await tx.workspaceMember.create({
        data: { workspaceId: tenancy.workspace.id, userId: foreign.user.id, role: "RESEARCHER" },
      });
      const peer = {
        workspaceId: tenancy.workspace.id,
        userId: foreign.user.id,
        role: "RESEARCHER" as const,
      };
      const outsider = { ...peer, workspaceId: foreign.workspace.id };
      const store = new PrismaEvidenceStore(tx);
      const pending = await tx.evidence.create({
        data: {
          workspaceId: tenancy.workspace.id,
          investigationId: tenancy.investigation.id,
          title: "Pending source",
          fileName: "pending.txt",
          evidenceType: "LOG",
          mimeType: "text/plain",
          fileSize: 20,
          checksum: "d".repeat(64),
          quarantineKey: "quarantine/pending",
          uploadedBy: tenancy.user.id,
        },
      });
      const approved = await tx.evidence.create({
        data: {
          workspaceId: tenancy.workspace.id,
          investigationId: tenancy.investigation.id,
          title: "Reviewed source",
          fileName: "reviewed.txt",
          evidenceType: "LOG",
          mimeType: "text/plain",
          fileSize: 20,
          checksum: "e".repeat(64),
          storageKey: "active/reviewed",
          uploadValidatedAt: new Date(),
          redactionStatus: "VERIFIED_SAFE",
          uploadedBy: tenancy.user.id,
        },
      });
      expect(await getEvidence(store, peer, pending.id)).toBeNull();
      expect((await getEvidence(store, peer, approved.id))?.id).toBe(approved.id);
      expect(await getEvidence(store, outsider, approved.id)).toBeNull();
    }));
  it("uploads to quarantine, activates after human review, links, and blocks deletion while linked", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaEvidenceStore(tx);
      const storage = new MemoryEvidenceStorage();
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };
      const body = Buffer.from("GET /search?q=test HTTP/1.1\nHost: lab.example.test\n");

      const intent = await createEvidenceUploadIntent(
        store,
        storage,
        actor,
        intentFor(tenancy.investigation.id, body),
      );
      expect(intent.ok).toBe(true);
      if (!intent.ok) {
        return null;
      }

      storage.put(storage.lastUploadKey ?? "", body);

      const finalized = await finalizeEvidenceUpload(
        store,
        storage,
        actor,
        intent.value.evidenceId,
      );
      expect(finalized.ok).toBe(true);
      if (!finalized.ok) {
        return null;
      }
      expect(finalized.value.redactionStatus).toBe("NOT_REVIEWED");

      const quarantined = await getEvidence(store, actor, intent.value.evidenceId);
      expect(quarantined?.storageKey).toBeNull();
      expect(quarantined?.quarantineKey).toBeTruthy();

      const approved = await reviewEvidenceRedaction(
        store,
        storage,
        actor,
        intent.value.evidenceId,
        { decision: "APPROVE_REDACTED", note: "Removed the session cookie." },
      );
      expect(approved.ok).toBe(true);
      if (!approved.ok) {
        return null;
      }
      expect(approved.value.redactionStatus).toBe("REDACTED");

      const active = await getEvidence(store, actor, intent.value.evidenceId);
      expect(active?.storageKey).toBeTruthy();
      expect(active?.quarantineKey).toBeNull();
      expect(storage.objects.has(quarantined?.quarantineKey ?? "")).toBe(false);

      const download = await createEvidenceDownload(store, storage, actor, intent.value.evidenceId);
      expect(download.ok).toBe(true);

      const linked = await linkEvidence(store, actor, {
        evidenceId: intent.value.evidenceId,
        findingId: tenancy.finding.id,
        relationshipType: "SUPPORTS",
      });
      expect(linked.ok).toBe(true);

      const linkedEvidence = await getEvidence(store, actor, intent.value.evidenceId);
      expect(linkedEvidence?.findingLinkCount).toBe(1);

      const blockedDelete = await deleteEvidence(store, storage, actor, intent.value.evidenceId);
      expect(blockedDelete.ok).toBe(false);
      if (!blockedDelete.ok) {
        expect(blockedDelete.code).toBe("EVIDENCE_IN_USE");
      }

      const linkId = linkedEvidence?.findingLinks[0]?.id;
      expect(linkId).toBeTruthy();

      if (!linkId) {
        return null;
      }

      expect((await removeEvidenceLink(store, actor, linkId)).ok).toBe(true);

      const deleted = await deleteEvidence(store, storage, actor, intent.value.evidenceId);
      expect(deleted.ok).toBe(true);

      return {
        active,
        linkedEvidence,
        storageKey: active?.storageKey ?? "",
        stillStored: storage.objects.has(active?.storageKey ?? ""),
      };
    });

    expect(result?.active?.redactionStatus).toBe("REDACTED");
    expect(result?.linkedEvidence?.findingLinkCount).toBe(1);
    expect(result?.stillStored).toBe(false);
  });

  it("quarantines flagged content and purges it when a reviewer rejects it", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaEvidenceStore(tx);
      const storage = new MemoryEvidenceStorage();
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };
      const body = Buffer.from(
        "POST /login HTTP/1.1\npassword=supersecret\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz\n",
      );

      const intent = await createEvidenceUploadIntent(
        store,
        storage,
        actor,
        intentFor(tenancy.investigation.id, body, {
          evidenceType: "HTTP_REQUEST",
          title: "Login request with credentials",
        }),
      );
      expect(intent.ok).toBe(true);
      if (!intent.ok) {
        return null;
      }

      storage.put(storage.lastUploadKey ?? "", body);

      const finalized = await finalizeEvidenceUpload(
        store,
        storage,
        actor,
        intent.value.evidenceId,
      );
      expect(finalized.ok).toBe(true);
      if (!finalized.ok) {
        return null;
      }
      expect(finalized.value.redactionStatus).toBe("QUARANTINED");

      const evidence = await getEvidence(store, actor, intent.value.evidenceId);
      const quarantineKey = evidence?.quarantineKey ?? "";
      expect(storage.objects.has(quarantineKey)).toBe(true);

      const rejected = await reviewEvidenceRedaction(
        store,
        storage,
        actor,
        intent.value.evidenceId,
        { decision: "REJECT", note: "Contains live credentials." },
      );
      expect(rejected.ok).toBe(true);

      const after = await getEvidence(store, actor, intent.value.evidenceId);
      const download = await createEvidenceDownload(store, storage, actor, intent.value.evidenceId);

      return {
        rejectedStatus: rejected.ok ? rejected.value.redactionStatus : null,
        deletedAt: after?.deletedAt ?? null,
        quarantineStillStored: storage.objects.has(quarantineKey),
        downloadOk: download.ok,
      };
    });

    expect(result?.rejectedStatus).toBe("QUARANTINED");
    expect(result?.deletedAt).not.toBeNull();
    expect(result?.quarantineStillStored).toBe(false);
    expect(result?.downloadOk).toBe(false);
  });

  it("rejects a checksum mismatch and removes the quarantined object", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaEvidenceStore(tx);
      const storage = new MemoryEvidenceStorage();
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };
      const declared = Buffer.from("declared content");
      const uploaded = Buffer.from("different content");

      const intent = await createEvidenceUploadIntent(
        store,
        storage,
        actor,
        intentFor(tenancy.investigation.id, declared, { fileSize: uploaded.byteLength }),
      );
      expect(intent.ok).toBe(true);
      if (!intent.ok) {
        return null;
      }

      storage.put(storage.lastUploadKey ?? "", uploaded);

      const finalized = await finalizeEvidenceUpload(
        store,
        storage,
        actor,
        intent.value.evidenceId,
      );

      return {
        finalized,
        quarantineStillStored: storage.objects.has(storage.lastUploadKey ?? ""),
      };
    });

    expect(result?.finalized.ok).toBe(false);
    if (result && !result.finalized.ok) {
      expect(result.finalized.code).toBe("EVIDENCE_CHECKSUM_MISMATCH");
    }
    expect(result?.quarantineStillStored).toBe(false);
  });
});
