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
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
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
    AI_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["GROQ", "ANTHROPIC"]).default("GROQ")),
    GROQ_API_KEY: optionalSecret,
    GROQ_ZDR_ENABLED: optionalBoolean,
    GROQ_TOKENS_PER_MINUTE: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(2048).max(8000).default(8000),
    ),
    GROQ_TOKENS_PER_DAY: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(2048).max(200000).default(200000),
    ),
    GROQ_REQUESTS_PER_DAY: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(1000).default(1000),
    ),
    ANTHROPIC_API_KEY: optionalSecret,
    AI_RESEARCH_MODEL: optionalSecret,
    AI_SUMMARY_MODEL: optionalSecret,
    AI_USE_MOCK_PROVIDER: optionalBoolean,
    AI_ROUTING_MODE: z.preprocess(
      emptyToUndefined,
      z.enum(["LEGACY", "MULTI_MODEL"]).default("LEGACY"),
    ),
    GEMINI_API_KEY: optionalSecret,
    OPENROUTER_API_KEY: optionalSecret,
    GEMINI_RESEARCH_MODEL: optionalString,
    GROQ_SUMMARY_MODEL: optionalString,
    OPENROUTER_REVIEW_MODEL: optionalString,
    OPENROUTER_SECONDARY_MODEL: optionalString,
    GEMINI_PAID_API_ENABLED: optionalBoolean,
    GEMINI_CONFIDENTIAL_DATA_APPROVED: optionalBoolean,
    OPENROUTER_PRIVACY_APPROVED: optionalBoolean,
    OPENROUTER_ZDR_ENABLED: optionalBoolean,
    OPENROUTER_ALLOWED_PROVIDERS: optionalString,
    AI_ALLOW_PAID_MODELS: optionalBoolean,
    AI_MAX_TASK_COST_USD: z.preprocess(
      emptyToUndefined,
      z.coerce.number().nonnegative().default(0),
    ),
    AI_MAX_DAILY_COST_USD: z.preprocess(
      emptyToUndefined,
      z.coerce.number().nonnegative().default(0),
    ),
    // Validated lazily by the AI runtime so a bad routing configuration only disables AI.
    AI_ROUTING_CONFIG: optionalString,

    // Phase 5 — private evidence storage (UploadThing)
    UPLOADTHING_TOKEN: optionalSecret,
    // Development-only local storage. Production uses UploadThing.
    EVIDENCE_LOCAL_DIR: optionalString,
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
    if (env.AI_PROVIDER === "GROQ") {
      for (const key of ["AI_RESEARCH_MODEL", "AI_SUMMARY_MODEL"] as const) {
        if (env[key] && !["openai/gpt-oss-120b", "openai/gpt-oss-20b"].includes(env[key])) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "The Groq free setup supports GPT-OSS 120B and GPT-OSS 20B only.",
          });
        }
      }
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
  "UPLOADTHING_TOKEN",
] as const;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function missingProductionEnv(
  source: Record<string, string | undefined>,
): readonly string[] {
  const required = [...REQUIRED_PRODUCTION_ENV];
  const missing = required.filter((key) => !source[key]?.trim());
  return missing;
}

/**
 * Call from server startup in a real deployment, not at module import time, so
 * builds and tests do not require production secrets.
 */
export function assertProductionEnv(source: Record<string, string | undefined>): void {
  if (source.NODE_ENV !== "production") {
    return;
  }
  parseServerEnv(source);

  const missing = missingProductionEnv(source);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}.`);
  }
}
