import type { Capability } from "@/modules/security/domain/capability";

export const AI_TASK_TYPES = [
  "RECON_ANALYSIS",
  "ATTACK_SURFACE_ANALYSIS",
  "HYPOTHESIS_GENERATION",
  "EVIDENCE_REVIEW",
  "FALSE_POSITIVE_REVIEW",
  "FINDING_SUMMARY",
  "REPORT_GENERATION",
  "SESSION_SUMMARY",
] as const;

export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export const AI_TASK_TYPE_LABELS: Record<AiTaskType, string> = {
  RECON_ANALYSIS: "Reconnaissance analysis",
  ATTACK_SURFACE_ANALYSIS: "Attack-surface analysis",
  HYPOTHESIS_GENERATION: "Hypothesis generation",
  EVIDENCE_REVIEW: "Evidence review",
  FALSE_POSITIVE_REVIEW: "False-positive review",
  FINDING_SUMMARY: "Finding summary",
  REPORT_GENERATION: "Report generation",
  SESSION_SUMMARY: "Session summary",
};

export type AiModelTier = "SONNET" | "HAIKU";

export const DEFAULT_AI_MODELS: Record<AiModelTier, string> = {
  SONNET: "claude-sonnet-4-5",
  HAIKU: "claude-haiku-4-5",
};

export type AiModelOverrides = {
  researchModel?: string;
  summaryModel?: string;
};

/**
 * Task profiles are the single budget/model/prompt source of truth (ADR-025).
 * Unsupported task types keep a profile so the schema contract stays explicit,
 * but `promptId` is null and the service fails closed.
 */
export type AiTaskProfile = {
  tier: AiModelTier;
  inputTokenBudget: number;
  outputTokenBudget: number;
  promptId: string | null;
  requiredCapabilities: readonly Capability[];
  supportsConversation: boolean;
};

const INVESTIGATION_CAPABILITIES = [
  "READ_PROJECT_CONTEXT",
  "READ_INVESTIGATION_CONTEXT",
  "AI_ANALYZE_SUPPLIED_CONTENT",
  "AI_ANALYZE_TARGET_CONTEXT",
] as const satisfies readonly Capability[];

export const AI_TASK_PROFILES: Record<AiTaskType, AiTaskProfile> = {
  RECON_ANALYSIS: {
    tier: "SONNET",
    inputTokenBudget: 40_000,
    outputTokenBudget: 3_000,
    promptId: "recon.analysis",
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
  ATTACK_SURFACE_ANALYSIS: {
    tier: "SONNET",
    inputTokenBudget: 40_000,
    outputTokenBudget: 3_000,
    promptId: "investigation.chat",
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: true,
  },
  HYPOTHESIS_GENERATION: {
    tier: "SONNET",
    inputTokenBudget: 40_000,
    outputTokenBudget: 3_000,
    promptId: "hypothesis.generation",
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
  EVIDENCE_REVIEW: {
    tier: "SONNET",
    inputTokenBudget: 60_000,
    outputTokenBudget: 4_000,
    promptId: null,
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
  FALSE_POSITIVE_REVIEW: {
    tier: "SONNET",
    inputTokenBudget: 60_000,
    outputTokenBudget: 4_000,
    promptId: null,
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
  FINDING_SUMMARY: {
    tier: "HAIKU",
    inputTokenBudget: 30_000,
    outputTokenBudget: 2_000,
    promptId: null,
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
  REPORT_GENERATION: {
    tier: "SONNET",
    inputTokenBudget: 60_000,
    outputTokenBudget: 4_000,
    promptId: null,
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
  SESSION_SUMMARY: {
    tier: "HAIKU",
    inputTokenBudget: 30_000,
    outputTokenBudget: 2_000,
    promptId: "session.summary",
    requiredCapabilities: INVESTIGATION_CAPABILITIES,
    supportsConversation: false,
  },
};

export function modelForTask(taskType: AiTaskType, overrides: AiModelOverrides = {}): string {
  const tier = AI_TASK_PROFILES[taskType].tier;

  if (tier === "SONNET") {
    return overrides.researchModel?.trim() || DEFAULT_AI_MODELS.SONNET;
  }

  return overrides.summaryModel?.trim() || DEFAULT_AI_MODELS.HAIKU;
}

export function isSupportedTaskType(taskType: AiTaskType): boolean {
  return AI_TASK_PROFILES[taskType].promptId !== null;
}

export function assistantRoleForTask(taskType: AiTaskType): string {
  switch (taskType) {
    case "RECON_ANALYSIS":
      return "RECON_ASSISTANT";
    case "ATTACK_SURFACE_ANALYSIS":
    case "HYPOTHESIS_GENERATION":
      return "RESEARCH_ASSISTANT";
    case "EVIDENCE_REVIEW":
    case "FALSE_POSITIVE_REVIEW":
      return "VERIFICATION_ASSISTANT";
    case "FINDING_SUMMARY":
    case "REPORT_GENERATION":
      return "REPORTING_ASSISTANT";
    case "SESSION_SUMMARY":
      return "SUMMARY_ASSISTANT";
  }
}
