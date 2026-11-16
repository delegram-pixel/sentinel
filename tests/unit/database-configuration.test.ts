// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = "postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_config_test";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("sentinelPrisma", undefined);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", databaseUrl);
  vi.stubEnv("DIRECT_URL", databaseUrl);
  vi.stubEnv("AI_PROVIDER", "GROQ");
  vi.stubEnv("AI_ROUTING_MODE", "LEGACY");
  vi.stubEnv("GROQ_ZDR_ENABLED", "true");
  vi.stubEnv("GEMINI_PAID_API_ENABLED", "false");
});

afterEach(async () => {
  const client = (globalThis as typeof globalThis & { sentinelPrisma?: PrismaClient })
    .sentinelPrisma;
  await client?.$disconnect();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runtime database configuration", () => {
  it("keeps the database available when GEMINI_PAID_API_ENABLED is malformed", async () => {
    vi.stubEnv("GEMINI_PAID_API_ENABLED", "not-a-boolean");
    const { getDb } = await import("@/lib/db");
    const { getServerEnv } = await import("@/config/env.server");

    expect(() => getDb()).not.toThrow();
    expect(() => getServerEnv()).toThrow(/GEMINI_PAID_API_ENABLED/);
  });

  it.each([
    ["GROQ_ZDR_ENABLED", "not-a-boolean"],
    ["AI_ROUTING_MODE", "not-a-routing-mode"],
  ])("initializes the database independently of %s", async (key, value) => {
    vi.stubEnv(key, value);
    const { getDb } = await import("@/lib/db");

    expect(() => getDb()).not.toThrow();
  });

  it("does not require the migration-only DIRECT_URL for runtime reads", async () => {
    vi.stubEnv("DIRECT_URL", undefined);
    const { getDb } = await import("@/lib/db");

    expect(() => getDb()).not.toThrow();
  });

  it.each([undefined, "", " \t\n"])("requires a nonblank DATABASE_URL (%j)", async (value) => {
    vi.stubEnv("DATABASE_URL", value);
    vi.stubEnv("DIRECT_URL", undefined);
    vi.stubEnv("GEMINI_PAID_API_ENABLED", "not-a-boolean");
    const { getDb } = await import("@/lib/db");

    expect(() => getDb()).toThrow("DATABASE_URL is not configured. See .env.example.");
  });

  it("reuses the runtime client on subsequent reads", async () => {
    const { getDb } = await import("@/lib/db");
    const client = getDb();

    expect(getDb()).toBe(client);
  });
});
