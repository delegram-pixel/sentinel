import { z } from "zod";
import { AI_PROVIDER_NAMES, AI_TASK_TYPES, type AiTaskType } from "./ai-config";

export const MODEL_CAPABILITIES = [
  "REASONING",
  "SUMMARY",
  "INDEPENDENT_REVIEW",
  "STRUCTURED_OUTPUT",
] as const;
export const MODEL_ROLES = ["PRIMARY", "SECONDARY", "REVIEW"] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];
export const modelEntrySchema = z
  .object({
    key: z.string().min(1),
    provider: z.enum(AI_PROVIDER_NAMES),
    modelId: z.string().min(1),
    displayName: z.string().min(1),
    capabilities: z.array(z.enum(MODEL_CAPABILITIES)),
    taskTypes: z.array(z.enum(AI_TASK_TYPES)),
    contextWindow: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive(),
    structuredOutput: z.enum(["STRICT_JSON", "JSON_SCHEMA", "TOOL"]),
    availability: z.enum(["AVAILABLE", "DISABLED", "UNVERIFIED"]),
    verifiedAt: z.string(),
    free: z.boolean(),
    pricing: z
      .object({
        input: z.number().nonnegative(),
        output: z.number().nonnegative(),
        effectiveUntil: z.string().optional(),
        nextInput: z.number().nonnegative().optional(),
        nextOutput: z.number().nonnegative().optional(),
      })
      .nullable(),
    defaults: z.object({ timeoutMs: z.number().int().min(1000).max(180000).default(45000) }),
  })
  .strict();
export type ModelEntry = z.infer<typeof modelEntrySchema>;
const researchTasks = AI_TASK_TYPES.filter(
  (t) => !["FINDING_SUMMARY", "SESSION_SUMMARY"].includes(t),
);
function entry(
  key: string,
  provider: ModelEntry["provider"],
  modelId: string,
  displayName: string,
  contextWindow: number,
  maxOutputTokens: number,
  pricing: ModelEntry["pricing"],
  summary = false,
  free = false,
): ModelEntry {
  return {
    key,
    provider,
    modelId,
    displayName,
    contextWindow,
    maxOutputTokens,
    pricing,
    free,
    capabilities: summary
      ? ["SUMMARY", "STRUCTURED_OUTPUT"]
      : ["REASONING", "SUMMARY", "INDEPENDENT_REVIEW", "STRUCTURED_OUTPUT"],
    taskTypes: summary
      ? ["FINDING_SUMMARY", "SESSION_SUMMARY"]
      : [...researchTasks, "FINDING_SUMMARY", "SESSION_SUMMARY"],
    structuredOutput:
      provider === "ANTHROPIC" ? "TOOL" : provider === "GEMINI" ? "JSON_SCHEMA" : "STRICT_JSON",
    availability: "AVAILABLE",
    verifiedAt: "2026-11-11",
    defaults: { timeoutMs: 45000 },
  };
}
/** Curated, dated metadata. Unknown model overrides require an explicit verified entry. */
export const DEFAULT_MODEL_REGISTRY: readonly ModelEntry[] = [
  entry("research", "GEMINI", "gemini-3.8-flash", "Gemini 3.8 Flash", 1048576, 65536, {
    input: 0.75,
    output: 3.75,
    effectiveUntil: "2027-01-01",
    nextInput: 1.5,
    nextOutput: 7.5,
  }),
  entry(
    "summary",
    "GROQ",
    "openai/gpt-oss-20b",
    "Groq GPT-OSS 20B",
    131072,
    65536,
    { input: 0, output: 0 },
    true,
    true,
  ),
  entry(
    "groq-research",
    "GROQ",
    "openai/gpt-oss-120b",
    "Groq GPT-OSS 120B",
    131072,
    65536,
    { input: 0, output: 0 },
    false,
    true,
  ),
  entry(
    "review",
    "OPENROUTER",
    "nvidia/nemotron-3.5-super-vl",
    "Nemotron Super VL",
    262144,
    65536,
    { input: 0.15, output: 0.47 },
  ),
  entry("secondary", "OPENROUTER", "qwen/qwen3.8-27b", "Qwen 3.8 27B", 262144, 65536, {
    input: 0.15,
    output: 1.875,
  }),
  entry(
    "anthropic-research",
    "ANTHROPIC",
    "claude-sonnet-4-5",
    "Claude Sonnet 4.5 (legacy)",
    200000,
    64000,
    { input: 3, output: 15 },
  ),
  entry(
    "anthropic-summary",
    "ANTHROPIC",
    "claude-haiku-4-5",
    "Claude Haiku 4.5 (legacy)",
    200000,
    64000,
    { input: 1, output: 5 },
    true,
  ),
];
export const routingConfigSchema = z
  .object({
    models: z.array(modelEntrySchema).default([]),
    tasks: z.partialRecord(z.enum(AI_TASK_TYPES), z.array(z.string()).min(1)).default({}),
    roles: z
      .object({
        PRIMARY: z.array(z.string()).min(1).default(["research", "secondary", "groq-research"]),
        SECONDARY: z.array(z.string()).min(1).default(["secondary", "groq-research"]),
        REVIEW: z.array(z.string()).min(1).default(["review", "groq-research"]),
      })
      .default({
        PRIMARY: ["research", "secondary", "groq-research"],
        SECONDARY: ["secondary", "groq-research"],
        REVIEW: ["review", "groq-research"],
      }),
    maxRetries: z.number().int().min(0).max(2).default(2),
    quotas: z
      .partialRecord(
        z.enum(AI_PROVIDER_NAMES),
        z.object({
          tokensPerMinute: z.number().int().positive(),
          tokensPerDay: z.number().int().positive(),
          requestsPerDay: z.number().int().positive(),
          requestsPerMinute: z.number().int().positive(),
        }),
      )
      .default({}),
  })
  .strict();
export type RoutingConfig = z.infer<typeof routingConfigSchema>;
export function estimateModelCost(
  model: ModelEntry,
  input: number,
  output: number,
  now = new Date(),
): number | null {
  if (model.free) return 0;
  if (!model.pricing) return null;
  const p = model.pricing;
  const next = p.effectiveUntil && now >= new Date(p.effectiveUntil);
  if (next && (p.nextInput === undefined || p.nextOutput === undefined)) return null;
  return (
    (input * (next ? p.nextInput! : p.input) + output * (next ? p.nextOutput! : p.output)) / 1000000
  );
}
export function taskModelCapabilities(
  task: AiTaskType,
  role: ModelRole,
): ModelEntry["capabilities"] {
  return [
    "STRUCTURED_OUTPUT",
    role === "REVIEW"
      ? "INDEPENDENT_REVIEW"
      : ["FINDING_SUMMARY", "SESSION_SUMMARY"].includes(task)
        ? "SUMMARY"
        : "REASONING",
  ];
}
