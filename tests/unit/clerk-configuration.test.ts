// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sentinel.example");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_configured");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_configured");
  vi.stubEnv("GROQ_ZDR_ENABLED", "not-a-boolean");
  vi.stubEnv("AI_ROUTING_MODE", "not-a-routing-mode");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Clerk configuration", () => {
  it("keeps authentication available when unrelated AI settings are malformed", async () => {
    const { isClerkConfigured } = await import("@/config/clerk");

    expect(isClerkConfigured()).toBe(true);
  });

  it("loads the proxy without validating unrelated AI settings", async () => {
    const { default: proxy } = await import("@/proxy");

    expect(proxy).toBeTypeOf("function");
  });

  it.each(["", " \t\n"])("requires a nonblank Clerk secret (%j)", async (secret) => {
    vi.stubEnv("CLERK_SECRET_KEY", secret);
    const { isClerkConfigured } = await import("@/config/clerk");

    expect(isClerkConfigured()).toBe(false);
  });

  it("requires a Clerk publishable key", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    const { isClerkConfigured } = await import("@/config/clerk");

    expect(isClerkConfigured()).toBe(false);
  });

  it("preserves the authentication shell when the build secret is redacted", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "[SENSITIVE]");
    const { isClerkConfigured } = await import("@/config/clerk");

    expect(isClerkConfigured()).toBe(true);
  });

  it("returns the configured publishable key", async () => {
    const { getClerkPublishableKey } = await import("@/config/clerk");

    expect(getClerkPublishableKey()).toBe("pk_test_configured");
  });
});
