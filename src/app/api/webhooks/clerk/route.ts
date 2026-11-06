import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { ensureUserProvisioned, syncUserProfile } from "@/modules/auth/application/provisioning";
import { identityFromClerkUserJson } from "@/modules/auth/domain/identity";
import { PrismaAuthStore } from "@/modules/auth/infrastructure/prisma-auth-store";

/**
 * Signed Clerk webhook (ADR-002). The handler is idempotent and keyed by the
 * Clerk user identifier; the first authenticated request is a lazy fallback for
 * missed deliveries (ADR-014).
 */
export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Webhook verification failed.", { status: 400 });
  }

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      const identity = identityFromClerkUserJson(event.data);

      if (!identity) {
        return Response.json({ ok: true, ignored: "user has no email address" });
      }

      const store = new PrismaAuthStore(getDb());

      if (event.type === "user.created") {
        await ensureUserProvisioned(store, identity);
      } else {
        await syncUserProfile(store, identity);
      }
    }

    // `user.deleted` retention is governed by the open M-05 decision. The
    // webhook acknowledges delivery without deleting research records.
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Clerk webhook processing failed:", error);

    return new Response("Webhook processing failed.", { status: 500 });
  }
}
