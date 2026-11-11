import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "@/lib/db";
import { syncUserProfile } from "@/modules/auth/application/provisioning";
import type { SessionContext } from "@/modules/auth/application/ports";
import { identityFromClerkUser } from "@/modules/auth/domain/identity";
import { PrismaAuthStore } from "@/modules/auth/infrastructure/prisma-auth-store";

/**
 * Data access layer for the authenticated workspace (ADR-001, ADR-014).
 *
 * Call this from every page and Server Action that reads or writes research
 * data. Rendering a form on a protected page is not an authorization boundary;
 * the action re-checks the session before mutating.
 *
 * Refresh the profile from Clerk so missed webhooks do not leave stale account
 * details. React's cache deduplicates this work within a request only.
 */
async function loadSessionContext(): Promise<SessionContext | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const store = new PrismaAuthStore(getDb());
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const identity = identityFromClerkUser(clerkUser);

  if (!identity) {
    throw new Error(
      "The authenticated Clerk user has no email address, so a workspace cannot be provisioned.",
    );
  }

  return syncUserProfile(store, identity);
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const session = await loadSessionContext();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
});

/**
 * Route-handler-safe variant for callbacks that must return an error instead of
 * redirecting (for example the UploadThing middleware).
 */
export function getOptionalSessionContext(): Promise<SessionContext | null> {
  return loadSessionContext();
}
