import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getOptionalSessionContext } from "@/lib/session";
import {
  EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_BYTES,
  isEvidenceMimeType,
} from "@/modules/evidence/domain/evidence";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";

const f = createUploadthing();

const evidenceInput = z.object({ evidenceId: z.uuid() });

async function discardUpload(key: string): Promise<void> {
  try {
    await new UTApi().deleteFiles(key);
  } catch {
    /* Orphaned uploads are safe: they remain private and are not referenced. */
  }
}

/**
 * Authenticated direct-to-UploadThing route for evidence files. The FileRoute
 * enforces ownership, the evidence allowlist and the 25 MB limit before any
 * bytes are accepted. `finalize` still re-downloads the object and verifies its
 * size, MIME type and checksum before the evidence can be reviewed.
 */
export const ourFileRouter = {
  evidenceUploader: f({
    blob: {
      maxFileSize: "32MB",
      maxFileCount: 1,
    },
  })
    .input(evidenceInput)
    .middleware(async ({ files, input }) => {
      const session = await getOptionalSessionContext();

      if (!session) {
        throw new UploadThingError("Sign in before uploading evidence.");
      }

      const file = files[0];

      if (!file) {
        throw new UploadThingError("Choose a file to upload.");
      }

      if (file.size > MAX_EVIDENCE_BYTES) {
        throw new UploadThingError(
          "This file is too large. Choose an evidence file of 25 MB or less.",
        );
      }

      if (file.type && !isEvidenceMimeType(file.type)) {
        throw new UploadThingError(
          `This file type is not supported. Use one of: ${EVIDENCE_MIME_TYPES.join(", ")}.`,
        );
      }

      const store = new PrismaEvidenceStore(getDb());
      const evidence = await store.findEvidence(session.workspace.id, input.evidenceId);

      if (!evidence || evidence.deletedAt) {
        throw new UploadThingError("We can't find that evidence in this workspace.");
      }

      if (evidence.uploadedBy !== session.user.id) {
        throw new UploadThingError("Only the uploader can add this file.");
      }

      if (evidence.storageKey || evidence.quarantineKey) {
        throw new UploadThingError("This evidence already has a file.");
      }

      const investigation = await store.findInvestigation(
        session.workspace.id,
        evidence.investigationId,
      );

      if (!investigation) {
        throw new UploadThingError("That investigation is unavailable.");
      }

      if (
        investigation.projectStatus === "ARCHIVED" ||
        investigation.investigationStatus === "ARCHIVED"
      ) {
        throw new UploadThingError("This investigation is archived, so its evidence is read-only.");
      }

      if (file.size !== evidence.fileSize) {
        throw new UploadThingError(
          "The selected file changed. Choose it again and retry the upload.",
        );
      }

      return {
        evidenceId: evidence.id,
        workspaceId: session.workspace.id,
        userId: session.user.id,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const store = new PrismaEvidenceStore(getDb());
      const recorded = await store.recordUploadedObject(
        metadata.workspaceId,
        metadata.evidenceId,
        file.key,
        {
          workspaceId: metadata.workspaceId,
          userId: metadata.userId,
          action: "EVIDENCE_UPLOADED",
          entityType: "Evidence",
          metadata: {
            fileKey: file.key,
            fileSize: file.size,
            mimeType: file.type,
          },
        },
      );

      if (!recorded) {
        await discardUpload(file.key);
        throw new UploadThingError("The upload could not be attached to its evidence record.");
      }

      return { evidenceId: metadata.evidenceId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
