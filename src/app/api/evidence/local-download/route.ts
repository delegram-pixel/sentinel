import { connection } from "next/server";

import {
  readLocalEvidenceObject,
  verifyLocalEvidenceRequest,
} from "@/modules/evidence/infrastructure/local-storage";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";

export async function GET(request: Request): Promise<Response> {
  await connection();

  if (createEvidenceStorage().kind !== "LOCAL") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires") ?? "0");
  const signature = url.searchParams.get("signature") ?? "";

  if (
    !verifyLocalEvidenceRequest({
      operation: "download",
      key,
      expiresAtSeconds: expires,
      signature,
    })
  ) {
    return new Response("Invalid download URL", { status: 403 });
  }

  try {
    const body = await readLocalEvidenceObject(key);

    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": 'attachment; filename="evidence"',
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
