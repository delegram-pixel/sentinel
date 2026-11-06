import { MAX_EVIDENCE_BYTES } from "@/modules/evidence/domain/evidence";
import {
  verifyLocalEvidenceRequest,
  writeLocalEvidenceObject,
} from "@/modules/evidence/infrastructure/local-storage";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";

export async function PUT(request: Request): Promise<Response> {
  if (createEvidenceStorage().kind !== "LOCAL") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires") ?? "0");
  const signature = url.searchParams.get("signature") ?? "";

  if (
    !verifyLocalEvidenceRequest({
      operation: "upload",
      key,
      expiresAtSeconds: expires,
      signature,
    }) ||
    !key.startsWith("quarantine/")
  ) {
    return new Response("Invalid upload URL", { status: 403 });
  }

  const body = Buffer.from(await request.arrayBuffer());

  if (body.length === 0) {
    return new Response("Empty upload", { status: 400 });
  }

  if (body.length > MAX_EVIDENCE_BYTES) {
    return new Response("Upload too large", { status: 413 });
  }

  await writeLocalEvidenceObject(key, body);

  return new Response(null, { status: 204 });
}
