import type { AIProvider } from "./provider";
import { AI_TASK_PROFILES, type AiTaskType } from "../domain/ai-config";
import { AiError } from "../domain/ai-errors";
import {
  estimateModelCost,
  taskModelCapabilities,
  type ModelEntry,
  type ModelRole,
  type RoutingConfig,
} from "../domain/model-registry";

export type ModelRoute = { model: ModelEntry; provider: AIProvider; fallbackFrom?: string };
export type AiRuntime = {
  models: readonly ModelEntry[];
  config: RoutingConfig;
  providerFor(model: ModelEntry): AIProvider | null;
  privacyApproved(model: ModelEntry): boolean;
  allowPaid: boolean;
  maxTaskCostUsd: number;
  maxDailyCostUsd: number;
  health?: (model: ModelEntry) => Promise<{ available: boolean; retryAt?: Date }>;
};
export async function routeModel(
  runtime: AiRuntime,
  task: AiTaskType,
  role: ModelRole = "PRIMARY",
  options: {
    excludedModels?: readonly string[];
    inputTokens?: number;
    remainingCostUsd?: number;
  } = {},
): Promise<ModelRoute> {
  const profile = AI_TASK_PROFILES[task];
  const keys =
    role === "PRIMARY" && ["FINDING_SUMMARY", "SESSION_SUMMARY"].includes(task)
      ? (runtime.config.tasks[task] ?? ["summary", "groq-research", "research"])
      : role === "PRIMARY"
        ? (runtime.config.tasks[task] ?? runtime.config.roles.PRIMARY)
        : runtime.config.roles[role];
  const input = options.inputTokens ?? profile.inputTokenBudget;
  const required = taskModelCapabilities(task, role);
  for (const key of keys) {
    const model = runtime.models.find((m) => m.key === key);
    if (
      !model ||
      model.availability !== "AVAILABLE" ||
      !model.taskTypes.includes(task) ||
      !required.every((c) => model.capabilities.includes(c)) ||
      options.excludedModels?.includes(model.modelId) ||
      input + profile.outputTokenBudget > model.contextWindow ||
      profile.outputTokenBudget > model.maxOutputTokens ||
      !runtime.privacyApproved(model)
    )
      continue;
    const cost = estimateModelCost(model, input, profile.outputTokenBudget);
    if (
      !model.free &&
      (!runtime.allowPaid ||
        cost === null ||
        cost >
          Math.min(runtime.maxTaskCostUsd, options.remainingCostUsd ?? runtime.maxTaskCostUsd) ||
        runtime.maxDailyCostUsd <= 0)
    )
      continue;
    const provider = runtime.providerFor(model);
    if (!provider || (runtime.health && !(await runtime.health(model)).available)) continue;
    return {
      model,
      provider,
      ...(keys[0] !== key
        ? { fallbackFrom: runtime.models.find((m) => m.key === keys[0])?.modelId ?? keys[0] }
        : {}),
    };
  }
  throw new AiError("AI_NO_COMPATIBLE_MODEL");
}
