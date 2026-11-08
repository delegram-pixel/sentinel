import { invalidAgentSources } from "../domain/agent-output";
import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { isTextEvidenceMimeType } from "@/modules/evidence/domain/evidence";
import { evaluateCapability } from "@/modules/security/domain/capability";
import { failure, type DomainResult } from "@/modules/shared/domain/result";

import {
  AI_TASK_PROFILES,
  assistantRoleForTask,
  modelForTask,
  type AiModelOverrides,
  type AiTaskType,
} from "../domain/ai-config";
import { estimateCostUsd, estimateTokens } from "../domain/ai-budgets";
import { aiErrorFromUnknown } from "../domain/ai-errors";
import {
  invalidEvidenceReferences,
  outputSchemaForTask,
  type ConversationOutput,
  type SessionSummaryOutput,
} from "../domain/structured-output";
import { findPrompt } from "../prompts/registry";
import { assembleContext } from "./context-manager";
import type {
  AiContextRecord,
  AiConversationRow,
  AiMessageRow,
  AiProviderName,
  AiStore,
  AiTaskRow,
} from "./ports";
import {
  STRUCTURED_OUTPUT_TOOL,
  type AIProvider,
  type AiProviderMessage,
  type AiProviderResponse,
} from "./provider";

type Actor = {
  userId: string;
  workspaceId: string;
};

type EvidenceReader = {
  getObject(key: string): Promise<{ body: Buffer; contentType: string | null } | null>;
};

export type AiServiceDependencies = {
  store: AiStore;
  provider: AIProvider;
  evidenceStorage?: EvidenceReader;
  modelOverrides?: AiModelOverrides;
  now?: () => Date;
  timeoutMs?: number;
  idempotencyKey?: () => string;
};

const PROVIDER_NAME: AiProviderName = "ANTHROPIC";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_EVIDENCE_READS = 12;
const MAX_EVIDENCE_READ_BYTES = 512 * 1024;
const MAX_EVIDENCE_TEXT_CHARS = 6_000;

/**
 * Add approved text evidence to the context. Binary evidence keeps its
 * metadata only, large text files are skipped, and storage failures degrade to
 * metadata rather than failing the task. The provider never receives raw bytes
 * (ADR-013 §10).
 */
async function hydrateEvidenceContent(
  context: AiContextRecord,
  reader: EvidenceReader | undefined,
): Promise<AiContextRecord> {
  if (!reader || context.evidence.length === 0) {
    return context;
  }

  let reads = 0;
  const evidence = await Promise.all(
    context.evidence.map(async (item) => {
      if (
        !item.storageKey ||
        !isTextEvidenceMimeType(item.mimeType) ||
        item.fileSize > MAX_EVIDENCE_READ_BYTES ||
        reads >= MAX_EVIDENCE_READS
      ) {
        return item;
      }

      reads += 1;

      try {
        const object = await reader.getObject(item.storageKey);

        if (!object) {
          return item;
        }

        const text = object.body.toString("utf8").replaceAll("\u0000", "").trim();

        return {
          ...item,
          textContent: text.slice(0, MAX_EVIDENCE_TEXT_CHARS),
        };
      } catch {
        return item;
      }
    }),
  );

  return { ...context, evidence };
}

const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Write a message first.").max(8_000),
});

function nowOf(deps: AiServiceDependencies): Date {
  return deps.now?.() ?? new Date();
}

function timeoutOf(deps: AiServiceDependencies): number {
  return deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function promptInstruction(taskType: AiTaskType): string {
  switch (taskType) {
    case "ATTACK_SURFACE_ANALYSIS":
      return "Answer the latest researcher message using only the supplied investigation context.";
    case "RECON_ANALYSIS":
      return "Analyse the supplied investigation context and separate known information from unknown information.";
    case "HYPOTHESIS_GENERATION":
      return "Generate candidate hypotheses, duplicate-risk notes, missing information, and next actions from the supplied observations.";
    case "SESSION_SUMMARY":
      return "Summarise this investigation session for continuity, preserving rejected hypotheses and unresolved questions.";
    default:
      return "Analyse the supplied investigation context.";
  }
}

function buildSystemPrompt(
  promptSystem: string,
  restrictions: readonly string[],
  contextText: string,
): string {
  return [
    promptSystem,
    "",
    "SAFETY RESTRICTIONS:",
    ...restrictions.map((restriction) => `- ${restriction}`),
    "",
    "STRUCTURED OUTPUT:",
    "Return exactly one object through the structured-output tool. Do not return prose outside the tool call.",
    "",
    "INVESTIGATION CONTEXT (UNTRUSTED DATA):",
    contextText,
  ].join("\n");
}

function providerMessages(
  taskType: AiTaskType,
  assembledMessages: readonly AiMessageRow[],
  instruction: string,
): AiProviderMessage[] {
  if (taskType === "ATTACK_SURFACE_ANALYSIS") {
    const messages = assembledMessages
      .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
      .map((message) => ({
        role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: message.content,
      }));

    return messages.length > 0 ? messages : [{ role: "user", content: instruction }];
  }

  return [{ role: "user", content: instruction }];
}

function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

type ValidationOutcome = { ok: true; output: unknown } | { ok: false; problems: string[] };

export function validateOutput(
  taskType: AiTaskType,
  structured: unknown,
  context: {
    observationIds: ReadonlySet<string>;
    hypothesisIds: ReadonlySet<string>;
    evidenceIds: ReadonlySet<string>;
    findingIds?: ReadonlySet<string>;
    decisionIds?: ReadonlySet<string>;
    knowledgeIds?: ReadonlySet<string>;
    historyIds?: ReadonlySet<string>;
  },
): ValidationOutcome {
  const schema = outputSchemaForTask(taskType);

  if (!schema) {
    return { ok: false, problems: [`No output schema is registered for ${taskType}.`] };
  }

  if (structured === null || structured === undefined) {
    return { ok: false, problems: ["The provider returned no structured output."] };
  }

  const parsed = schema.safeParse(structured);

  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`),
    };
  }

  const references = invalidEvidenceReferences(
    parsed.data,
    context.observationIds,
    context.hypothesisIds,
    context.evidenceIds,
  );

  references.push(
    ...invalidAgentSources(parsed.data, {
      OBSERVATION: context.observationIds,
      HYPOTHESIS: context.hypothesisIds,
      EVIDENCE: context.evidenceIds,
      FINDING: context.findingIds,
      DECISION: context.decisionIds,
      KNOWLEDGE: context.knowledgeIds,
      HISTORY: context.historyIds,
    }),
  );
  const record = parsed.data as Record<string, unknown>;
  if (Array.isArray(record.referencedFindingIds))
    for (const id of record.referencedFindingIds)
      if (typeof id === "string" && !context.findingIds?.has(id))
        references.push(`Unknown finding reference: ${id}.`);
  for (const [field, set] of [
    ["relevantHistoryIds", context.historyIds],
    ["referencedKnowledgeIds", context.knowledgeIds],
  ] as const)
    if (Array.isArray(record[field]))
      for (const id of record[field])
        if (typeof id === "string" && !set?.has(id))
          references.push(`Unknown selected source: ${id}.`);
  return references.length > 0
    ? { ok: false, problems: references }
    : { ok: true, output: parsed.data };
}

export function formatAssistantMessage(taskType: AiTaskType, output: unknown): string {
  switch (taskType) {
    case "RECON_ANALYSIS": {
      const value = output as {
        summary: string;
        knownInformation: string[];
        unknownInformation: string[];
        recommendedActions: string[];
      };

      return [
        value.summary,
        "",
        "Known:",
        ...value.knownInformation.map((item) => `- ${item}`),
        "",
        "Unknown:",
        ...value.unknownInformation.map((item) => `- ${item}`),
        "",
        "Recommended next steps:",
        ...value.recommendedActions.map((item) => `- ${item}`),
      ].join("\n");
    }
    case "HYPOTHESIS_GENERATION": {
      const value = output as {
        hypotheses: Array<{ title: string; description: string; confidence: string }>;
        duplicateRiskNotes: string[];
        nextActions: string[];
      };

      return [
        ...value.hypotheses.map(
          (hypothesis) =>
            `### ${hypothesis.title} (${hypothesis.confidence} confidence)\n${hypothesis.description}`,
        ),
        "",
        "Duplicate risk:",
        ...value.duplicateRiskNotes.map((item) => `- ${item}`),
        "",
        "Next actions:",
        ...value.nextActions.map((item) => `- ${item}`),
      ].join("\n");
    }
    case "ATTACK_SURFACE_ANALYSIS":
      return (output as ConversationOutput).message;
    default:
      return JSON.stringify(output, null, 2);
  }
}

async function failTask(
  deps: AiServiceDependencies,
  task: AiTaskRow,
  code: string,
  message: string,
  usage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 },
): Promise<DomainResult<never>> {
  const now = nowOf(deps);
  const status = code === "AI_TIMEOUT" ? "TIMED_OUT" : "FAILED";

  await deps.store.updateTask(task.workspaceId, task.id, {
    status,
    failureCode: code,
    errorMessage: message,
    inputTokens: task.inputTokens + usage.inputTokens,
    outputTokens: task.outputTokens + usage.outputTokens,
    completedAt: now,
  });

  await deps.store.recordTaskEvent(
    task.id,
    status === "TIMED_OUT" ? "TASK_TIMED_OUT" : "TASK_FAILED",
    message,
    { failureCode: code },
  );

  return failure(code, message);
}

export type AiTaskInput = {
  executionLease?: { jobId: string; token: string };
  investigationId: string;
  conversationId?: string;
  taskType: AiTaskType;
  instruction?: string;
  parentTaskId?: string;
  operationKey?: string;
};

export type AiTaskResult = {
  task: AiTaskRow;
  output: unknown;
  message: AiMessageRow | null;
};

/**
 * Create, execute, validate, and persist one AI task. The provider is injected
 * so tests can use the deterministic mock without a network call.
 */
export async function runAiTask(
  deps: AiServiceDependencies,
  actor: Actor,
  input: AiTaskInput,
): Promise<DomainResult<AiTaskResult>> {
  const profile = AI_TASK_PROFILES[input.taskType];

  if (!profile.promptId) {
    return failure("AI_TASK_NOT_SUPPORTED", `${input.taskType} is not available in this release.`);
  }

  const prompt = findPrompt(profile.promptId);

  if (!prompt) {
    return failure("AI_TASK_NOT_SUPPORTED", `${input.taskType} has no registered prompt.`);
  }

  let context = await deps.store.loadContext(
    actor.workspaceId,
    input.investigationId,
    input.conversationId,
    actor.userId,
  );

  if (!context) {
    return failure(
      "AI_INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  if (context.project.status === "ARCHIVED" || context.investigation.status === "ARCHIVED") {
    return failure(
      "AI_PERMISSION_DENIED",
      "AI tasks cannot run against an archived investigation.",
    );
  }

  if (
    ["FINDING_SUMMARY", "REPORT_GENERATION"].includes(input.taskType) &&
    !(context.findings ?? []).some((f) => ["CONFIRMED", "REPORTABLE"].includes(f.status))
  )
    return failure("AI_PERMISSION_DENIED", "Reporting analysis requires a human-approved finding.");
  if (["FINDING_SUMMARY", "REPORT_GENERATION"].includes(input.taskType))
    context = {
      ...context,
      findings: context.findings?.filter((f) => ["CONFIRMED", "REPORTABLE"].includes(f.status)),
    };
  if (
    ["EVIDENCE_REVIEW", "FALSE_POSITIVE_REVIEW"].includes(input.taskType) &&
    !context.evidence.length
  )
    return failure(
      "AI_CONTEXT_UNAVAILABLE",
      "Link approved evidence before requesting evidence or verification analysis.",
    );

  context = await hydrateEvidenceContent(context, deps.evidenceStorage);

  const model = modelForTask(input.taskType, deps.modelOverrides);
  const now = nowOf(deps);
  const idempotencyKey = input.operationKey ?? deps.idempotencyKey?.() ?? randomUUID();

  let task: AiTaskRow;
  try {
    task = await deps.store.createTask({
      workspaceId: actor.workspaceId,
      investigationId: input.investigationId,
      executionJobId: input.executionLease?.jobId,
      executorToken: input.executionLease?.token,
      conversationId: input.conversationId,
      taskType: input.taskType,
      assignedRole: assistantRoleForTask(input.taskType),
      provider: PROVIDER_NAME,
      model,
      promptTemplateId: prompt.id,
      promptVersion: prompt.version,
      contextVersion: "unassembled",
      idempotencyKey,
      requiredCapabilities: [...profile.requiredCapabilities],
      inputTokenBudget: profile.inputTokenBudget,
      outputTokenBudget: profile.outputTokenBudget,
      requestedBy: actor.userId,
      parentTaskId: input.parentTaskId,
      requestHash: createHash("sha256")
        .update(
          JSON.stringify({
            investigationId: input.investigationId,
            conversationId: input.conversationId ?? null,
            taskType: input.taskType,
            instruction: input.instruction ?? null,
          }),
        )
        .digest("hex"),
    });
  } catch (error) {
    const aiError = aiErrorFromUnknown(error);
    return failure(aiError.code, aiError.message);
  }
  if (task.failureCode === "AI_BUDGET_EXCEEDED")
    return failure("AI_BUDGET_EXCEEDED", "The daily AI budget is exhausted.");
  if (task.status === "COMPLETED")
    return {
      ok: true,
      value: {
        task,
        output: task.output,
        message: await deps.store.resultMessage(actor.workspaceId, task.id),
      },
    };
  if (task.status !== "PENDING")
    return failure(
      "AI_TASK_ALREADY_ADMITTED",
      "This request is already running or has finished. Check task history.",
    );

  await deps.store.recordTaskEvent(task.id, "TASK_CREATED", "AI task created.", {
    taskType: input.taskType,
    model,
    promptId: prompt.id,
    promptVersion: prompt.version,
    promptHash: prompt.contentHash,
  });

  const targetDocumented = Boolean(context.target.assetIdentifier);
  const activeScope = context.activeScope !== null;

  for (const capability of profile.requiredCapabilities) {
    const decision = evaluateCapability(capability, {
      actor: "AI",
      targetDocumented,
      activeScope,
    });

    if (!decision.allowed) {
      await deps.store.recordTaskEvent(task.id, "PERMISSION_CHECK", decision.message, {
        capability,
        code: decision.code,
      });

      return failTask(deps, task, "AI_PERMISSION_DENIED", decision.message);
    }
  }

  await deps.store.recordTaskEvent(task.id, "PERMISSION_CHECK", "Capability check passed.");

  let assembled: ReturnType<typeof assembleContext>;

  try {
    assembled = assembleContext(
      context,
      Math.max(1, profile.inputTokenBudget - 2500 - estimateTokens(input.instruction ?? "")),
    );
  } catch (error) {
    const aiError = aiErrorFromUnknown(error);
    return failTask(deps, task, aiError.code, aiError.message);
  }

  await deps.store.recordTaskEvent(
    task.id,
    "CONTEXT_ASSEMBLY",
    assembled.compressed ? "Context compressed to fit the task budget." : "Context assembled.",
    {
      contextVersion: assembled.contextVersion,
      compressed: assembled.compressed,
      included: assembled.included,
      evidence: assembled.evidence,
      estimatedInputTokens: assembled.estimatedInputTokens,
    },
  );

  const schema = outputSchemaForTask(input.taskType);

  if (!schema) {
    return failTask(deps, task, "AI_TASK_NOT_SUPPORTED", "No output schema is registered.");
  }

  const instruction = input.instruction ?? promptInstruction(input.taskType);
  const system = buildSystemPrompt(prompt.systemPrompt, prompt.safetyRestrictions, assembled.text);
  const messages = providerMessages(input.taskType, assembled.messages, instruction);

  const request = {
    taskType: input.taskType,
    model,
    system,
    messages,
    maxTokens: profile.outputTokenBudget,
    timeoutMs: timeoutOf(deps),
    structuredOutput: {
      toolName: STRUCTURED_OUTPUT_TOOL,
      description: "Return the validated structured result for this Sentinel Research task.",
      schema: jsonSchemaFor(schema),
    },
  };

  const estimatedRequestTokens =
    estimateTokens(system) +
    messages.reduce((sum, m) => sum + estimateTokens(m.content) + 8, 0) +
    estimateTokens(JSON.stringify(request.structuredOutput));
  if (estimatedRequestTokens > profile.inputTokenBudget)
    return failTask(
      deps,
      task,
      "AI_CONTEXT_TOO_LARGE",
      "The complete model request exceeds its input budget.",
    );
  const running = await deps.store.updateTask(actor.workspaceId, task.id, {
    status: "RUNNING",
    executionJobId: input.executionLease?.jobId,
    executorToken: input.executionLease?.token,
    contextVersion: assembled.contextVersion,
    startedAt: now,
    inputContext: {
      snapshotVersion: 1,
      promptId: prompt.id,
      promptVersion: prompt.version,
      promptHash: prompt.contentHash,
      contextVersion: assembled.contextVersion,
      compressed: assembled.compressed,
      included: assembled.included,
      evidence: assembled.evidence,
      sourceManifest: assembled.sourceManifest,
      estimatedInputTokens: estimatedRequestTokens,
      conversationId: input.conversationId ?? null,
      request,
    },
  });
  if (!running) return failure("AI_TASK_ALREADY_ADMITTED", "This task is already being processed.");
  await deps.store.recordTaskEvent(
    task.id,
    "TASK_ASSIGNMENT",
    `Assigned ${input.taskType} to ${model}.`,
  );
  async function callProvider(providerRequest: typeof request, sequence: number) {
    await deps.store.recordTaskEvent(task.id, "AI_PROCESSING", "Provider request started.", {
      sequence,
    });
    const attempt = await deps.store.startAttempt(
      actor.workspaceId,
      task.id,
      sequence,
      providerRequest,
      input.executionLease,
    );
    try {
      const response = await deps.provider.generate(providerRequest);
      await deps.store.finishAttempt(actor.workspaceId, attempt.id, response);
      return response;
    } catch (error) {
      await deps.store.finishAttempt(
        actor.workspaceId,
        attempt.id,
        null,
        aiErrorFromUnknown(error).code,
      );
      throw error;
    }
  }
  let response: AiProviderResponse;
  let usage = { inputTokens: 0, outputTokens: 0 };

  try {
    response = await callProvider(request, 1);
    usage = {
      inputTokens: usage.inputTokens + response.usage.inputTokens,
      outputTokens: usage.outputTokens + response.usage.outputTokens,
    };
  } catch (error) {
    const aiError = aiErrorFromUnknown(error);
    return failTask(deps, running, aiError.code, aiError.message, usage);
  }

  if (response.stopReason === "refusal")
    return failTask(deps, running, "AI_REFUSAL", "The provider declined this request.", usage);

  const knowledge = {
    observationIds: new Set(assembled.sourceManifest.observationIds),
    hypothesisIds: new Set(assembled.sourceManifest.hypothesisIds),
    evidenceIds: new Set(assembled.sourceManifest.evidenceIds),
    findingIds: new Set(assembled.sourceManifest.findingIds),
    decisionIds: new Set(assembled.sourceManifest.decisionIds),
    knowledgeIds: new Set(assembled.sourceManifest.knowledgeIds),
    historyIds: new Set(assembled.sourceManifest.historyIds),
  };

  let validation = validateOutput(input.taskType, response.structured, knowledge);
  let finalResponse = response;

  if (!validation.ok) {
    await deps.store.recordTaskEvent(
      task.id,
      "OUTPUT_VALIDATION",
      "First structured output failed validation. Requesting one correction.",
      { problems: validation.problems },
    );

    const correction: AiProviderMessage[] = [
      ...messages,
      {
        role: "assistant",
        content:
          finalResponse.text ||
          JSON.stringify(finalResponse.structured ?? { error: "no structured output" }),
      },
      {
        role: "user",
        content: [
          "The previous structured output failed validation:",
          ...validation.problems.map((problem) => `- ${problem}`),
          "",
          "Return a corrected object through the structured-output tool. Do not add prose.",
        ].join("\n"),
      },
    ];

    try {
      const correctionTokens =
        estimateTokens(system) +
        correction.reduce((sum, m) => sum + estimateTokens(m.content) + 8, 0) +
        estimateTokens(JSON.stringify(request.structuredOutput));
      if (correctionTokens > profile.inputTokenBudget)
        return failTask(
          deps,
          running,
          "AI_CONTEXT_TOO_LARGE",
          "The correction request exceeds the input budget.",
          usage,
        );
      const retry = await callProvider({ ...request, messages: correction }, 2);
      finalResponse = retry;
      usage = {
        inputTokens: usage.inputTokens + retry.usage.inputTokens,
        outputTokens: usage.outputTokens + retry.usage.outputTokens,
      };
      if (retry.stopReason === "refusal")
        return failTask(
          deps,
          running,
          "AI_REFUSAL",
          "The provider declined the correction request.",
          usage,
        );
      validation = validateOutput(input.taskType, retry.structured, knowledge);
    } catch (error) {
      const aiError = aiErrorFromUnknown(error);
      return failTask(deps, running, aiError.code, aiError.message, usage);
    }
  }

  if (!validation.ok) {
    return failTask(
      deps,
      running,
      "AI_OUTPUT_VALIDATION_FAILED",
      `The AI response did not pass validation: ${validation.problems.join("; ")}`,
      usage,
    );
  }

  await deps.store.recordTaskEvent(task.id, "OUTPUT_VALIDATION", "Structured output validated.", {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });

  const estimatedCostUsd = estimateCostUsd(profile.tier, usage.inputTokens, usage.outputTokens);

  try {
    const summary =
      input.taskType === "SESSION_SUMMARY" ? (validation.output as SessionSummaryOutput) : null;
    const completed = await deps.store.completeTask(
      actor.workspaceId,
      task.id,
      {
        executionJobId: input.executionLease?.jobId,
        executorToken: input.executionLease?.token,
        output: validation.output,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd,
        completedAt: nowOf(deps),
      },
      {
        ...(summary
          ? {
              summary: {
                investigationId: input.investigationId,
                ...summary,
                model,
                promptVersion: prompt.version,
                sourceTaskId: task.id,
                createdBy: actor.userId,
              },
            }
          : {}),
        ...(input.conversationId && !summary
          ? {
              message: {
                conversationId: input.conversationId,
                role: "ASSISTANT",
                content: formatAssistantMessage(input.taskType, validation.output),
                structuredContent: validation.output,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              },
            }
          : {}),
      },
    );
    if (!completed)
      return failTask(
        deps,
        running,
        "AI_PERMISSION_DENIED",
        "The task was cancelled or its research access changed before completion.",
        usage,
      );
    return {
      ok: true,
      value: { task: completed.task, output: validation.output, message: completed.message },
    };
  } catch (error) {
    const aiError = aiErrorFromUnknown(error);
    return failTask(deps, running, aiError.code, aiError.message, usage);
  }
}

export type ChatResult = {
  conversation: AiConversationRow;
  task: AiTaskRow;
  message: AiMessageRow;
};

/**
 * Persist the user turn, run the guided-chat task, and persist the assistant
 * turn. The conversation must already belong to the workspace and
 * investigation.
 */
export async function sendChatMessage(
  deps: AiServiceDependencies,
  actor: Actor,
  investigationId: string,
  conversationId: string,
  rawMessage: string,
  operationKey: string = randomUUID(),
): Promise<DomainResult<ChatResult>> {
  const parsed = chatMessageSchema.safeParse({ message: rawMessage });

  if (!parsed.success) {
    return failure(
      "VALIDATION_FAILED",
      parsed.error.issues[0]?.message ?? "Write a message first.",
    );
  }

  const conversation = await deps.store.findConversation(actor.workspaceId, conversationId);

  if (!conversation || conversation.investigationId !== investigationId) {
    return failure("AI_CONVERSATION_NOT_FOUND", "That AI conversation does not exist.");
  }

  if (operationKey.length < 8 || operationKey.length > 160)
    return failure("VALIDATION_FAILED", "The message operation identifier is invalid.");
  try {
    await deps.store.appendMessage({
      conversationId,
      operationKey: `chat:${actor.userId}:${operationKey}`,
      actor,
      role: "USER",
      content: parsed.data.message,
      inputTokens: estimateTokens(parsed.data.message),
    });
  } catch (error) {
    const e = aiErrorFromUnknown(error);
    return failure(e.code, e.message);
  }

  const result = await runAiTask(deps, actor, {
    investigationId,
    conversationId,
    taskType: "ATTACK_SURFACE_ANALYSIS",
    instruction: parsed.data.message,
    operationKey: `chat:${actor.userId}:${operationKey}`,
  });

  if (!result.ok) {
    return failure(result.code, result.message);
  }

  if (!result.value.message) {
    return failure("AI_INVALID_OUTPUT", "The AI response could not be stored.");
  }

  return {
    ok: true,
    value: {
      conversation,
      task: result.value.task,
      message: result.value.message,
    },
  };
}

export type ConversationCreateInput = {
  investigationId: string;
  title: string;
};

export async function createConversation(
  deps: AiServiceDependencies,
  actor: Actor,
  input: ConversationCreateInput,
): Promise<DomainResult<AiConversationRow>> {
  const title = input.title.trim();

  if (title.length < 2 || title.length > 120) {
    return failure("VALIDATION_FAILED", "Use a title between 2 and 120 characters.");
  }

  const context = await deps.store.loadContext(actor.workspaceId, input.investigationId);

  if (!context) {
    return failure(
      "AI_INVESTIGATION_NOT_FOUND",
      "We can't find that investigation in this workspace. Open Investigations to choose an available one.",
    );
  }

  if (context.project.status === "ARCHIVED" || context.investigation.status === "ARCHIVED") {
    return failure(
      "AI_PERMISSION_DENIED",
      "AI conversations cannot be added to an archived investigation.",
    );
  }

  const model = modelForTask("ATTACK_SURFACE_ANALYSIS", deps.modelOverrides);
  const conversation = await deps.store.createConversation({
    workspaceId: actor.workspaceId,
    investigationId: input.investigationId,
    title,
    provider: PROVIDER_NAME,
    model,
  });

  return { ok: true, value: conversation };
}

export function listAiTasks(
  store: AiStore,
  workspaceId: string,
  investigationId: string,
): Promise<AiTaskRow[]> {
  return store.listTasks(workspaceId, investigationId);
}

export function listConversations(
  store: AiStore,
  workspaceId: string,
  investigationId: string,
): Promise<AiConversationRow[]> {
  return store.listConversations(workspaceId, investigationId);
}
