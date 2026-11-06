import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { Capability } from "@/modules/security/domain/capability";

import { transitionAiTask } from "../domain/ai-task-status";
import type {
  AiAuditDraft,
  AiContextRecord,
  AiConversationCreateData,
  AiConversationDetail,
  AiConversationRow,
  AiMessageCreateData,
  AiMessageRow,
  AiProviderName,
  AiSessionSummaryCreateData,
  AiStore,
  AiTaskCreateData,
  AiTaskEventRow,
  AiTaskRow,
  AiTaskUpdateData,
} from "../application/ports";

type Db = Prisma.TransactionClient;

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function auditRow(event: AiAuditDraft, entityId: string): Prisma.AuditLogCreateInput {
  return {
    workspace: { connect: { id: event.workspaceId } },
    user: { connect: { id: event.userId } },
    action: event.action,
    entityType: event.entityType,
    entityId,
    previousValue: event.previousValue as Prisma.InputJsonValue | undefined,
    newValue: event.newValue as Prisma.InputJsonValue | undefined,
    metadata: event.metadata as Prisma.InputJsonValue | undefined,
  };
}

const conversationSelect = {
  id: true,
  workspaceId: true,
  investigationId: true,
  title: true,
  mode: true,
  provider: true,
  model: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AIConversationSelect;

type ConversationRecord = Prisma.AIConversationGetPayload<{ select: typeof conversationSelect }>;

const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  structuredContent: true,
  inputTokens: true,
  outputTokens: true,
  createdAt: true,
} satisfies Prisma.AIMessageSelect;

type MessageRecord = Prisma.AIMessageGetPayload<{ select: typeof messageSelect }>;

const taskSelect = {
  id: true,
  workspaceId: true,
  investigationId: true,
  conversationId: true,
  taskType: true,
  status: true,
  assignedRole: true,
  inputContext: true,
  output: true,
  errorMessage: true,
  failureCode: true,
  provider: true,
  model: true,
  promptTemplateId: true,
  promptVersion: true,
  contextVersion: true,
  idempotencyKey: true,
  requiredCapabilities: true,
  inputTokenBudget: true,
  outputTokenBudget: true,
  inputTokens: true,
  outputTokens: true,
  estimatedCostUsd: true,
  correlationId: true,
  requestedBy: true,
  parentTaskId: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AITaskSelect;

type TaskRecord = Prisma.AITaskGetPayload<{ select: typeof taskSelect }>;

function mapConversation(conversation: ConversationRecord): AiConversationRow {
  return {
    ...conversation,
    provider: conversation.provider as AiProviderName,
  };
}

function mapMessage(message: MessageRecord): AiMessageRow {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    structuredContent: message.structuredContent,
    inputTokens: message.inputTokens,
    outputTokens: message.outputTokens,
    createdAt: message.createdAt,
  };
}

function mapTask(task: TaskRecord): AiTaskRow {
  return {
    ...task,
    provider: task.provider as AiProviderName,
    requiredCapabilities: task.requiredCapabilities as Capability[],
    estimatedCostUsd: Number(task.estimatedCostUsd),
  };
}

function jsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export class PrismaAIStore implements AiStore {
  constructor(private readonly db: Db) {}

  async loadContext(
    workspaceId: string,
    investigationId: string,
    conversationId?: string,
  ): Promise<AiContextRecord | null> {
    const investigation = await this.db.investigation.findFirst({
      where: { id: investigationId, workspaceId },
      select: {
        id: true,
        title: true,
        description: true,
        objective: true,
        category: true,
        status: true,
        startedAt: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            projectType: true,
            status: true,
          },
        },
        target: {
          select: {
            id: true,
            name: true,
            assetIdentifier: true,
            assetType: true,
            environmentType: true,
            authorizationStatus: true,
            authorizationExpiresAt: true,
          },
        },
        observations: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            observationType: true,
            source: true,
            confidenceLabel: true,
            createdAt: true,
          },
        },
        hypotheses: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            vulnerabilityCategory: true,
            missingInformation: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            observationLinks: {
              select: { observationId: true, relationshipType: true },
            },
          },
        },
        sessionSummaries: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            summary: true,
            completedWork: true,
            rejectedHypotheses: true,
            unresolvedQuestions: true,
            nextActions: true,
            generatedByType: true,
            model: true,
            createdAt: true,
          },
        },
        evidence: {
          where: {
            deletedAt: null,
            redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            id: true,
            title: true,
            description: true,
            evidenceType: true,
            redactionStatus: true,
            version: true,
            checksum: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            storageKey: true,
            createdAt: true,
          },
        },
      },
    });

    if (!investigation) {
      return null;
    }

    const activeScope = await this.db.scopeVersion.findFirst({
      where: { targetId: investigation.target.id, status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        effectiveFrom: true,
        effectiveUntil: true,
        assets: {
          select: { assetIdentifier: true, matchType: true, effect: true },
        },
        activities: {
          select: { activity: true, effect: true },
        },
      },
    });

    const conversation = conversationId
      ? await this.findConversation(workspaceId, conversationId)
      : null;

    return {
      investigation: {
        id: investigation.id,
        title: investigation.title,
        description: investigation.description,
        objective: investigation.objective,
        category: investigation.category,
        status: investigation.status,
        startedAt: investigation.startedAt,
        createdAt: investigation.createdAt,
      },
      project: investigation.project,
      target: investigation.target,
      activeScope,
      observations: investigation.observations,
      hypotheses: investigation.hypotheses,
      summaries: investigation.sessionSummaries.map((summary) => ({
        id: summary.id,
        summary: summary.summary,
        completedWork: stringArray(summary.completedWork),
        rejectedHypotheses: stringArray(summary.rejectedHypotheses),
        unresolvedQuestions: stringArray(summary.unresolvedQuestions),
        nextActions: stringArray(summary.nextActions),
        generatedByType: summary.generatedByType,
        model: summary.model,
        createdAt: summary.createdAt,
      })),
      evidence: investigation.evidence,
      conversation:
        conversation && conversation.investigationId === investigationId
          ? {
              id: conversation.id,
              title: conversation.title,
              messages: conversation.messages,
            }
          : null,
    };
  }

  async listConversations(
    workspaceId: string,
    investigationId: string,
  ): Promise<AiConversationRow[]> {
    const conversations = await this.db.aIConversation.findMany({
      where: { workspaceId, investigationId },
      orderBy: { updatedAt: "desc" },
      select: conversationSelect,
    });

    return conversations.map(mapConversation);
  }

  async findConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<AiConversationDetail | null> {
    const conversation = await this.db.aIConversation.findFirst({
      where: { id: conversationId, workspaceId },
      select: {
        ...conversationSelect,
        messages: {
          orderBy: { createdAt: "asc" },
          select: messageSelect,
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      ...mapConversation(conversation),
      messages: conversation.messages.map(mapMessage),
    };
  }

  async createConversation(data: AiConversationCreateData): Promise<AiConversationRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: data.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const conversation = await tx.aIConversation.create({
        data: {
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
          title: data.title,
          mode: data.mode ?? "GUIDED",
          provider: data.provider,
          model: data.model,
        },
        select: conversationSelect,
      });

      return mapConversation(conversation);
    });
  }

  async appendMessage(data: AiMessageCreateData): Promise<AiMessageRow> {
    return this.db.$transaction(async (tx) => {
      const conversation = await tx.aIConversation.findFirst({
        where: { id: data.conversationId },
        select: { id: true },
      });

      if (!conversation) {
        throw new Error("The conversation does not exist.");
      }

      const message = await tx.aIMessage.create({
        data: {
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          ...(data.structuredContent !== undefined
            ? { structuredContent: jsonInput(data.structuredContent) }
            : {}),
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
        },
        select: messageSelect,
      });

      await tx.aIConversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
        select: { id: true },
      });

      return mapMessage(message);
    });
  }

  async createTask(data: AiTaskCreateData): Promise<AiTaskRow> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: data.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const task = await tx.aITask.create({
        data: {
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
          conversationId: data.conversationId,
          taskType: data.taskType,
          status: "PENDING",
          assignedRole: data.assignedRole,
          provider: data.provider,
          model: data.model,
          promptTemplateId: data.promptTemplateId,
          promptVersion: data.promptVersion,
          contextVersion: data.contextVersion,
          idempotencyKey: data.idempotencyKey,
          requiredCapabilities: data.requiredCapabilities,
          inputTokenBudget: data.inputTokenBudget,
          outputTokenBudget: data.outputTokenBudget,
          requestedBy: data.requestedBy,
          parentTaskId: data.parentTaskId,
          correlationId: data.correlationId,
          ...(data.inputContext !== undefined
            ? { inputContext: jsonInput(data.inputContext) }
            : {}),
        },
        select: taskSelect,
      });

      return mapTask(task);
    });
  }

  async findTask(workspaceId: string, taskId: string): Promise<AiTaskRow | null> {
    const task = await this.db.aITask.findFirst({
      where: { id: taskId, workspaceId },
      select: taskSelect,
    });

    return task ? mapTask(task) : null;
  }

  async findTaskByIdempotency(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<AiTaskRow | null> {
    const task = await this.db.aITask.findFirst({
      where: { workspaceId, idempotencyKey },
      select: taskSelect,
    });

    return task ? mapTask(task) : null;
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    data: AiTaskUpdateData,
  ): Promise<AiTaskRow | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.aITask.findFirst({
        where: { id: taskId, workspaceId },
        select: { id: true, status: true },
      });

      if (!existing) {
        return null;
      }

      if (data.status !== undefined && data.status !== existing.status) {
        const transition = transitionAiTask(existing.status, data.status, "SYSTEM");

        if (!transition.ok) {
          throw new Error(transition.message);
        }
      }

      const update: Prisma.AITaskUncheckedUpdateInput = {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.promptTemplateId !== undefined ? { promptTemplateId: data.promptTemplateId } : {}),
        ...(data.promptVersion !== undefined ? { promptVersion: data.promptVersion } : {}),
        ...(data.contextVersion !== undefined ? { contextVersion: data.contextVersion } : {}),
        ...(data.inputContext !== undefined ? { inputContext: jsonInput(data.inputContext) } : {}),
        ...(data.output !== undefined ? { output: jsonInput(data.output) } : {}),
        ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
        ...(data.failureCode !== undefined ? { failureCode: data.failureCode } : {}),
        ...(data.inputTokens !== undefined ? { inputTokens: data.inputTokens } : {}),
        ...(data.outputTokens !== undefined ? { outputTokens: data.outputTokens } : {}),
        ...(data.estimatedCostUsd !== undefined ? { estimatedCostUsd: data.estimatedCostUsd } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      };

      const task = await tx.aITask.update({
        where: { id: taskId },
        data: update,
        select: taskSelect,
      });

      return mapTask(task);
    });
  }

  async recordTaskEvent(
    taskId: string,
    eventType: AiTaskEventRow["eventType"],
    description?: string,
    metadata?: Record<string, unknown>,
  ): Promise<AiTaskEventRow> {
    const event = await this.db.aITaskEvent.create({
      data: {
        taskId,
        eventType,
        description,
        ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
      select: {
        id: true,
        taskId: true,
        eventType: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    });

    return event;
  }

  async listTaskEvents(workspaceId: string, taskId: string): Promise<AiTaskEventRow[]> {
    const task = await this.db.aITask.findFirst({
      where: { id: taskId, workspaceId },
      select: { id: true },
    });

    if (!task) {
      return [];
    }

    return this.db.aITaskEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        taskId: true,
        eventType: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  async listTasks(workspaceId: string, investigationId: string, limit = 25): Promise<AiTaskRow[]> {
    const tasks = await this.db.aITask.findMany({
      where: { workspaceId, investigationId },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(100, limit)),
      select: taskSelect,
    });

    return tasks.map(mapTask);
  }

  async sumUserUsageSince(userId: string, since: Date): Promise<number> {
    const usage = await this.db.aITask.aggregate({
      where: { requestedBy: userId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
    });

    return (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0);
  }

  async createAiSessionSummary(
    data: AiSessionSummaryCreateData,
    audit: AiAuditDraft,
  ): Promise<{ id: string }> {
    return this.db.$transaction(async (tx) => {
      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: audit.workspaceId },
        select: { id: true },
      });

      if (!investigation) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const summary = await tx.sessionSummary.create({
        data: {
          investigationId: data.investigationId,
          summary: data.summary,
          completedWork: data.completedWork,
          rejectedHypotheses: data.rejectedHypotheses,
          unresolvedQuestions: data.unresolvedQuestions,
          nextActions: data.nextActions,
          generatedByType: "AI",
          model: data.model,
          promptVersion: data.promptVersion,
          sourceTaskId: data.sourceTaskId,
          createdBy: data.createdBy,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: auditRow(
          {
            ...audit,
            newValue: {
              ...(audit.newValue ?? {}),
              investigationId: data.investigationId,
              generatedByType: "AI",
              model: data.model,
              promptVersion: data.promptVersion,
              sourceTaskId: data.sourceTaskId,
            },
          },
          summary.id,
        ),
      });

      return summary;
    });
  }

  async recordAudit(event: Parameters<AiStore["recordAudit"]>[0]): Promise<void> {
    await this.db.auditLog.create({
      data: {
        workspace: { connect: { id: event.workspaceId } },
        user: { connect: { id: event.userId } },
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        previousValue: event.previousValue as Prisma.InputJsonValue | undefined,
        newValue: event.newValue as Prisma.InputJsonValue | undefined,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
