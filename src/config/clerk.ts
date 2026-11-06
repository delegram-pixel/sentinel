import "server-only";

import { clientEnv } from "@/config/env.client";
import { getServerEnv } from "@/config/env.server";

/**
 * Clerk is optional at build time so CI can compile without secrets. When the
 * keys are absent, authenticated routes render a configuration notice instead
 * of pretending a session exists.
 */
export function isClerkConfigured(): boolean {
  return Boolean(clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && getServerEnv().CLERK_SECRET_KEY);
}

export function getClerkPublishableKey(): string | undefined {
  return clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}
