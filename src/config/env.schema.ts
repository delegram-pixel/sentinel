import { z } from "zod";

/**
 * Treat blank values as absent. A copied `.env.example` must not break local
 * startup or tests just because optional secrets are empty strings.
 */
function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const httpUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Must be an http(s) URL.");
const optionalUrl = z.preprocess(emptyToUndefined, httpUrl.optional());
const optionalBoolean = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "") {
    return undefined;
  }

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return value;
}, z.boolean().optional());

/**
 * Server-side environment contract. Nothing in this file may be imported by a
 * client component. See src/config/env.server.ts for the server-only entry.
 */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.preprocess(emptyToUndefined, httpUrl.default("http://localhost:3000")),

    // Phase 2 — database and authentication
    DATABASE_URL: optionalSecret,
    DIRECT_URL: optionalSecret,
    TEST_DATABASE_URL: optionalSecret,
    CLERK_SECRET_KEY: optionalSecret,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalSecret,
    CLERK_WEBHOOK_SIGNING_SECRET: optionalSecret,

    // Phase 2 — rate limiting
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalSecret,

    // Phase 4/5 — AI provider
    ANTHROPIC_API_KEY: optionalSecret,
    AI_RESEARCH_MODEL: optionalSecret,
    AI_SUMMARY_MODEL: optionalSecret,
    AI_USE_MOCK_PROVIDER: optionalBoolean,

    // Phase 5 — private object storage
    STORAGE_ENDPOINT: optionalUrl,
    STORAGE_REGION: optionalSecret,
    STORAGE_BUCKET: optionalSecret,
    STORAGE_ACCESS_KEY_ID: optionalSecret,
    STORAGE_SECRET_ACCESS_KEY: optionalSecret,
    // Development-only local storage. Production uses the S3-compatible set above.
    EVIDENCE_LOCAL_SIGNING_SECRET: optionalSecret,

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.DATABASE_URL) !== Boolean(env.DIRECT_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["DIRECT_URL"],
        message: "DATABASE_URL and DIRECT_URL must be set together.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ANTHROPIC_API_KEY",
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
] as const;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function missingProductionEnv(
  source: Record<string, string | undefined>,
): readonly string[] {
  return REQUIRED_PRODUCTION_ENV.filter((key) => !source[key]?.trim());
}

/**
 * Call from server startup in a real deployment, not at module import time, so
 * builds and tests do not require production secrets.
 */
export function assertProductionEnv(source: Record<string, string | undefined>): void {
  if (source.NODE_ENV !== "production") {
    return;
  }

  const missing = missingProductionEnv(source);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}.`);
  }
}
