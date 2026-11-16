import "server-only";

import { clientEnv } from "@/config/env.client";

/**
 * Clerk is optional at build time so CI can compile without secrets. When the
 * keys are absent, authenticated routes render a configuration notice instead
 * of pretending a session exists.
 * Check only Clerk credentials so unrelated provider settings cannot prevent
 * the proxy and public authentication pages from starting.
 */
export function isClerkConfigured(): boolean {
  return Boolean(
    clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY?.trim(),
  );
}

export function getClerkPublishableKey(): string | undefined {
  return clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}
