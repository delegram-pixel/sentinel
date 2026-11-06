/**
 * The identity fields the application stores for an authenticated user.
 *
 * Clerk is the only source of this identity (ADR-002). The application never
 * stores credentials, and `authProviderId` is the Clerk user identifier.
 */
export type AuthenticatedIdentity = {
  authProviderId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Structural shape of the Clerk user payload used by both the webhook and the
 * lazy provisioning path. Keeping the shape local avoids importing the Clerk
 * SDK into application code.
 */
export type ClerkUserLike = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
};

/**
 * Clerk's webhook payload uses the API's snake_case JSON shape rather than the
 * SDK resource shape. Both adapters normalize into the same identity.
 */
export type ClerkUserJsonLike = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{ id: string; email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
};

type IdentityFields = {
  id: string;
  primaryEmailId: string | null;
  emails: ReadonlyArray<{ id: string; email: string }>;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
};

function resolveIdentity(fields: IdentityFields): AuthenticatedIdentity | null {
  const primary = fields.emails.find((address) => address.id === fields.primaryEmailId);
  const email = primary?.email ?? fields.emails[0]?.email ?? null;

  if (!email) {
    return null;
  }

  const fullName = [fields.firstName, fields.lastName].filter(Boolean).join(" ").trim();
  const displayName =
    fullName.slice(0, 80) ||
    fields.username?.slice(0, 80) ||
    email.split("@")[0]?.slice(0, 80) ||
    "Researcher";

  return {
    authProviderId: fields.id,
    email: email.trim().toLowerCase(),
    displayName,
    avatarUrl: fields.imageUrl,
  };
}

/**
 * Resolve a stable identity from a Clerk SDK user. Returns null when the Clerk
 * account has no email address, because the application requires one for the
 * user record.
 */
export function identityFromClerkUser(user: ClerkUserLike): AuthenticatedIdentity | null {
  return resolveIdentity({
    id: user.id,
    primaryEmailId: user.primaryEmailAddressId,
    emails: user.emailAddresses.map((address) => ({
      id: address.id,
      email: address.emailAddress,
    })),
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    imageUrl: user.imageUrl,
  });
}

/**
 * Resolve an identity from the JSON payload delivered to the Clerk webhook.
 */
export function identityFromClerkUserJson(user: ClerkUserJsonLike): AuthenticatedIdentity | null {
  return resolveIdentity({
    id: user.id,
    primaryEmailId: user.primary_email_address_id,
    emails: user.email_addresses.map((address) => ({
      id: address.id,
      email: address.email_address,
    })),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    imageUrl: user.image_url,
  });
}
