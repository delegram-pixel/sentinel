import type { AuthenticatedIdentity } from "../domain/identity";
import type { AuthStore, SessionContext } from "./ports";

/**
 * Ensure an authenticated user has a personal workspace.
 *
 * The webhook and the first authenticated request both call this. A concurrent
 * call can lose the unique race on `authProviderId`, so a failure is resolved by
 * re-reading the provisioned context rather than by creating a second
 * workspace.
 */
export async function ensureUserProvisioned(
  store: AuthStore,
  identity: AuthenticatedIdentity,
): Promise<SessionContext> {
  const existing = await store.findByAuthProviderId(identity.authProviderId);

  if (existing) {
    return existing;
  }

  try {
    return await store.createUserWithWorkspace(identity);
  } catch (error) {
    const raced = await store.findByAuthProviderId(identity.authProviderId);

    if (raced) {
      return raced;
    }

    throw error;
  }
}

/**
 * Apply a Clerk profile update without touching the workspace or membership.
 * The lazy path uses this when a user already exists but their display fields
 * changed before the webhook arrived.
 */
export async function syncUserProfile(
  store: AuthStore,
  identity: AuthenticatedIdentity,
): Promise<SessionContext> {
  const existing = await store.findByAuthProviderId(identity.authProviderId);

  if (!existing) {
    return ensureUserProvisioned(store, identity);
  }

  if (
    existing.user.displayName === identity.displayName &&
    existing.user.email === identity.email &&
    existing.user.avatarUrl === identity.avatarUrl
  ) {
    return existing;
  }

  await store.updateUserProfile(identity);

  return {
    ...existing,
    user: {
      ...existing.user,
      displayName: identity.displayName,
      email: identity.email,
      avatarUrl: identity.avatarUrl,
    },
  };
}
