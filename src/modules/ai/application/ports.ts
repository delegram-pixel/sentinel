import type { AuditEvent } from "@/modules/audit/domain/audit";
import type { Capability } from "@/modules/security/domain/capability";

import type { AiTaskType } from "../domain/ai-config";
import type { AiTaskEventType, AiTaskStatus } from "../domain/ai-task-status";

export type AiProviderName = "ANTHROPIC";

export type AiAuditDraft = Omit<AuditEvent, "entityId">;

export type AiConversationRow = {
  id: string;
  workspaceId: string;
  investigationId: string;
  title: string;
  mode: "GUIDED" | "DELEGATED";
  provider: AiProviderName;
  model: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

export type AiMessageRow = {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  structuredContent: unknown | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: Date;
};

export type AiConversationDetail = AiConversationRow & {
  messages: AiMessageRow[];
};

export type AiTaskRow = {
  id: string;
  workspaceId: string;
  investigationId: string;
  conversationId: string | null;
  taskType: AiTaskType;
  status: AiTaskStatus;
  assignedRole: string | null;
  inputContext: unknown | null;
  output: unknown | null;
  errorMessage: string | null;
  failureCode: string | null;
  provider: AiProviderName;
  model: string;
  promptTemplateId: string;
  promptVersion: string;
  contextVersion: string;
  idempotencyKey: string;
  requiredCapabilities: Capability[];
  inputTokenBudget: number;
  outputTokenBudget: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  correlationId: string | null;
  requestedBy: string;
  parentTaskId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AiTaskEventRow = {
  id: string;
  taskId: string;
  eventType: AiTaskEventType;
  description: string | null;
  metadata: unknown | null;
  createdAt: Date;
};

export type AiObservationContext = {
  id: string;
  title: string;
  description: string;
  observationType: string;
  source: string | null;
  confidenceLabel: string;
  createdAt: Date;
};

export type AiHypothesisContext = {
  id: string;
  title: string;
  description: string;
  vulnerabilityCategory: string | null;
  missingInformation: string | null;
  status: string;
  observationLinks: Array<{
    observationId: string;
    relationshipType: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export type AiSummaryContext = {
  id: string;
  summary: string;
  completedWork: string[];
  rejectedHypotheses: string[];
  unresolvedQuestions: string[];
  nextActions: string[];
  generatedByType: "AI" | "HUMAN";
  model: string | null;
  createdAt: Date;
};

export type AiEvidenceContext = {
  id: string;
  title: string;
  description: string | null;
  evidenceType: string;
  redactionStatus: string;
  version: number;
  checksum: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string | null;
  createdAt: Date;
  textContent?: string | null;
};

export type AiScopeContext = {
  id: string;
  version: number;
  status: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  assets: Array<{
    assetIdentifier: string;
    matchType: string;
    effect: string;
  }>;
  activities: Array<{
    activity: Capability;
    effect: string;
  }>;
};

export type AiContextRecord = {
  investigation: {
    id: string;
    title: string;
    description: string | null;
    objective: string | null;
    category: string | null;
    status: string;
    startedAt: Date | null;
    createdAt: Date;
  };
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    projectType: string;
    status: string;
  };
  target: {
    id: string;
    name: string;
    assetIdentifier: string;
    assetType: string;
    environmentType: string;
    authorizationStatus: string;
    authorizationExpiresAt: Date | null;
  };
  activeScope: AiScopeContext | null;
  observations: AiObservationContext[];
  hypotheses: AiHypothesisContext[];
  summaries: AiSummaryContext[];
  evidence: AiEvidenceContext[];
  conversation: {
    id: string;
    title: string;
    messages: AiMessageRow[];
  } | null;
};

export type AiConversationCreateData = {
  workspaceId: string;
  investigationId: string;
  title: string;
  mode?: "GUIDED" | "DELEGATED";
  provider: AiProviderName;
  model: string;
};

export type AiMessageCreateData = {
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  structuredContent?: unknown;
  inputTokens?: number;
  outputTokens?: number;
};

export type AiTaskCreateData = {
  workspaceId: string;
  investigationId: string;
  conversationId?: string;
  taskType: AiTaskType;
  assignedRole?: string;
  provider: AiProviderName;
  model: string;
  promptTemplateId: string;
  promptVersion: string;
  contextVersion: string;
  idempotencyKey: string;
  requiredCapabilities: Capability[];
  inputTokenBudget: number;
  outputTokenBudget: number;
  requestedBy: string;
  parentTaskId?: string;
  correlationId?: string;
  inputContext?: unknown;
};

export type AiTaskUpdateData = {
  status?: AiTaskStatus;
  model?: string;
  promptTemplateId?: string;
  promptVersion?: string;
  contextVersion?: string;
  inputContext?: unknown;
  output?: unknown;
  errorMessage?: string | null;
  failureCode?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export type AiSessionSummaryCreateData = {
  investigationId: string;
  summary: string;
  completedWork: string[];
  rejectedHypotheses: string[];
  unresolvedQuestions: string[];
  nextActions: string[];
  model: string;
  promptVersion: string;
  sourceTaskId: string;
  createdBy: string;
};

export interface AiStore {
  loadContext(
    workspaceId: string,
    investigationId: string,
    conversationId?: string,
  ): Promise<AiContextRecord | null>;
  listConversations(workspaceId: string, investigationId: string): Promise<AiConversationRow[]>;
  findConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<AiConversationDetail | null>;
  createConversation(data: AiConversationCreateData): Promise<AiConversationRow>;
  appendMessage(data: AiMessageCreateData): Promise<AiMessageRow>;
  createTask(data: AiTaskCreateData): Promise<AiTaskRow>;
  findTask(workspaceId: string, taskId: string): Promise<AiTaskRow | null>;
  findTaskByIdempotency(workspaceId: string, idempotencyKey: string): Promise<AiTaskRow | null>;
  updateTask(
    workspaceId: string,
    taskId: string,
    data: AiTaskUpdateData,
  ): Promise<AiTaskRow | null>;
  recordTaskEvent(
    taskId: string,
    eventType: AiTaskEventType,
    description?: string,
    metadata?: Record<string, unknown>,
  ): Promise<AiTaskEventRow>;
  listTaskEvents(workspaceId: string, taskId: string): Promise<AiTaskEventRow[]>;
  listTasks(workspaceId: string, investigationId: string, limit?: number): Promise<AiTaskRow[]>;
  sumUserUsageSince(userId: string, since: Date): Promise<number>;
  createAiSessionSummary(
    data: AiSessionSummaryCreateData,
    audit: AiAuditDraft,
  ): Promise<{ id: string }>;
  recordAudit(event: AuditEvent): Promise<void>;
}
