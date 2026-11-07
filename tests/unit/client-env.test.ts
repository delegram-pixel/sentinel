import { afterEach, describe, expect, it, vi } from "vitest";

import { clientEnvSchema } from "@/config/env.client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public environment contract", () => {
  it("provides defaults when public variables are absent", () => {
    const env = clientEnvSchema.parse({});

    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeUndefined();
  });

  it.each(["", " \t\n"])("treats blank public values (%j) as absent", (value) => {
    const env = clientEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: value,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: value,
    });

    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeUndefined();
  });

  it("preserves configured public values", () => {
    const configured = {
      NEXT_PUBLIC_APP_URL: "https://sentinel.example",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
    };

    expect(clientEnvSchema.parse(configured)).toEqual(configured);
  });

  it("still rejects malformed app URLs", () => {
    expect(() => clientEnvSchema.parse({ NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow();
  });

  it("loads at module evaluation when CI supplies an empty Clerk secret", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.resetModules();

    const { clientEnv } = await import("@/config/env.client");

    expect(clientEnv.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeUndefined();
  });
});
