import { describe, expect, it } from "vitest";

import { identityFromClerkUser, identityFromClerkUserJson } from "@/modules/auth/domain/identity";

describe("Clerk identity mapping", () => {
  it("maps the SDK user shape", () => {
    expect(
      identityFromClerkUser({
        id: "user_123",
        primaryEmailAddressId: "email_1",
        emailAddresses: [
          { id: "email_2", emailAddress: "secondary@example.test" },
          { id: "email_1", emailAddress: "Primary@Example.test" },
        ],
        firstName: "Ada",
        lastName: "Lovelace",
        username: null,
        imageUrl: "https://img.example.test/ada.png",
      }),
    ).toEqual({
      authProviderId: "user_123",
      email: "primary@example.test",
      displayName: "Ada Lovelace",
      avatarUrl: "https://img.example.test/ada.png",
    });
  });

  it("maps the webhook JSON shape", () => {
    expect(
      identityFromClerkUserJson({
        id: "user_456",
        primary_email_address_id: "email_1",
        email_addresses: [{ id: "email_1", email_address: "researcher@example.test" }],
        first_name: null,
        last_name: null,
        username: "researcher",
        image_url: null,
      }),
    ).toEqual({
      authProviderId: "user_456",
      email: "researcher@example.test",
      displayName: "researcher",
      avatarUrl: null,
    });
  });

  it("falls back to the email local part for a display name", () => {
    const identity = identityFromClerkUser({
      id: "user_789",
      primaryEmailAddressId: null,
      emailAddresses: [{ id: "email_1", emailAddress: "lab@example.test" }],
      firstName: null,
      lastName: null,
      username: null,
      imageUrl: null,
    });

    expect(identity?.displayName).toBe("lab");
  });

  it("returns null when the account has no email", () => {
    expect(
      identityFromClerkUser({
        id: "user_none",
        primaryEmailAddressId: null,
        emailAddresses: [],
        firstName: "No",
        lastName: "Email",
        username: null,
        imageUrl: null,
      }),
    ).toBeNull();
  });
});
