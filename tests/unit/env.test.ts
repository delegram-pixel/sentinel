import { describe, expect, it } from "vitest";

import {
  assertProductionEnv,
  missingProductionEnv,
  parseServerEnv,
  REQUIRED_PRODUCTION_ENV,
} from "@/config/env.schema";

const completeProductionEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://sentinel.example",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/sentinel",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/sentinel",
  CLERK_SECRET_KEY: "sk_test_123",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_123",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "redis_token",
  UPLOADTHING_TOKEN: "ut_token",
  GROQ_API_KEY: "gsk_123",
  GROQ_ZDR_ENABLED: "true",
} as const;

const aiBooleanSettings = [
  "GROQ_ZDR_ENABLED",
  "AI_USE_MOCK_PROVIDER",
  "GEMINI_PAID_API_ENABLED",
  "GEMINI_CONFIDENTIAL_DATA_APPROVED",
  "OPENROUTER_PRIVACY_APPROVED",
  "OPENROUTER_ZDR_ENABLED",
  "AI_ALLOW_PAID_MODELS",
] as const;

describe("environment contract", () => {
  it("provides development defaults", () => {
    const env = parseServerEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("treats blank optional values as absent", () => {
    const env = parseServerEnv({
      DATABASE_URL: "",
      CLERK_SECRET_KEY: "   ",
      UPLOADTHING_TOKEN: "",
    });

    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
    expect(env.UPLOADTHING_TOKEN).toBeUndefined();
  });

  it("allows Vercel's redacted AI settings during production builds without enabling approvals", () => {
    const source = {
      ...completeProductionEnv,
      ...Object.fromEntries(aiBooleanSettings.map((key) => [key, "[SENSITIVE]"])),
      AI_ROUTING_MODE: "[SENSITIVE]",
      CLERK_SECRET_KEY: "[SENSITIVE]",
    };
    const env = parseServerEnv(source);

    for (const key of aiBooleanSettings) expect(env[key]).toBeUndefined();
    expect(env.AI_ROUTING_MODE).toBe("LEGACY");
    expect(env.CLERK_SECRET_KEY).toBe("[SENSITIVE]");
    expect(() => assertProductionEnv(source)).not.toThrow();
  });

  it("keeps explicit false AI flags disabled and honors the configured routing mode", () => {
    const env = parseServerEnv({
      ...completeProductionEnv,
      ...Object.fromEntries(aiBooleanSettings.map((key) => [key, "false"])),
      AI_ROUTING_MODE: "MULTI_MODEL",
    });

    for (const key of aiBooleanSettings) expect(env[key]).toBe(false);
    expect(env.AI_ROUTING_MODE).toBe("MULTI_MODEL");
  });

  it("still rejects malformed AI settings instead of treating arbitrary strings as approvals", () => {
    expect(() => parseServerEnv({ GROQ_ZDR_ENABLED: "yes" })).toThrow();
    expect(() => parseServerEnv({ AI_ROUTING_MODE: "UNKNOWN" })).toThrow();
  });

  it("rejects malformed urls and unknown log levels", () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow();
    expect(() => parseServerEnv({ LOG_LEVEL: "verbose" })).toThrow();
  });

  it("requires the pooled and direct database URLs to be set together", () => {
    expect(() =>
      parseServerEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/sentinel" }),
    ).toThrow();

    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/sentinel",
        DIRECT_URL: "postgresql://user:pass@localhost:5432/sentinel",
      }),
    ).not.toThrow();
  });

  it("lists missing production variables", () => {
    const missing = missingProductionEnv({
      NODE_ENV: "production",
      DATABASE_URL: "  ",
      UPLOADTHING_TOKEN: "ut_token",
    });

    expect(missing).toContain("DATABASE_URL");
    expect(missing).toContain("CLERK_SECRET_KEY");
    expect(missing).not.toContain("UPLOADTHING_TOKEN");
  });

  it("does not enforce production secrets outside production", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("fails fast in production when required values are absent", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production" })).toThrow(
      /Missing required production environment variables/,
    );
  });

  it("passes when every production variable is present", () => {
    expect(missingProductionEnv(completeProductionEnv)).toEqual([]);
    expect(() => assertProductionEnv(completeProductionEnv)).not.toThrow();
    expect(REQUIRED_PRODUCTION_ENV).toHaveLength(7);
  });
});
