import { genUploader } from "uploadthing/client";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

/**
 * Client-safe UploadThing uploader. The router type is imported with
 * `import type`, so no server-only code reaches the browser bundle.
 */
export const uploadEvidenceFile = genUploader<OurFileRouter>();
