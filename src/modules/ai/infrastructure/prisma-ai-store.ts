import "server-only";
import { persistAgentAssessments } from "./agent-result-store";
import { createHash } from "node:crypto";
import { AiError } from "../domain/ai-errors";
import { AI_DAILY_USER_TOKEN_CAP } from "../domain/ai-budgets";
import { estimateTokens, estimateCostUsd } from "../domain/ai-budgets";
import { AI_TASK_PROFILES } from "../domain/ai-config";
import { getServerEnv } from "@/config/env.server";
import type { AiProviderRequest, AiProviderResponse } from "../application/provider";
import { PrismaKnowledgeRetrievalStore } from "@/modules/knowledge/infrastructure/prisma-knowledge-retrieval";

import { Prisma } from "@/generated/prisma/client";
import { lockResearchInvestigation } from "@/modules/shared/infrastructure/research-transaction";
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
  collaborationId: true,
  collaborationStage: true,
  evaluation: true,
  id: true,
  workspaceId: true,
  investigationId: true,
  conversationId: true,
  taskType: true,
  status: true,
  assignedRole: true,
  inputContext: true,
  executionState: true,
  output: true,
  errorMessage: true,
  failureCode: true,
  provider: true,
  model: true,
  promptTemplateId: true,
  promptVersion: true,
  contextVersion: true,
  idempotencyKey: true,
  executionJobId: true,
  usageUncertain: true,
  usageReconciledAt: true,
  reservedTokens: true,
  executorToken: true,
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
  private responseCost(request: Prisma.JsonValue, response: AiProviderResponse): number | null {
    const r = request as {
      costEstimateUsd?: number | null;
      pricing?: { input: number; output: number };
    };
    return r.pricing
      ? (response.usage.inputTokens * r.pricing.input +
          response.usage.outputTokens * r.pricing.output) /
          1000000
      : r.costEstimateUsd === 0
        ? 0
        : null;
  }
  private async reserveCost(tx: Db, taskId: string, request: AiProviderRequest): Promise<number> {
    const cost = request.costEstimateUsd;
    if (cost === undefined || cost === 0) return 0;
    const env = getServerEnv();
    if (cost === null || !env.AI_ALLOW_PAID_MODELS || env.AI_MAX_DAILY_COST_USD <= 0)
      throw new AiError("AI_COST_LIMIT");
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('sentinel-ai-spending'))`,
    );
    const task = await tx.aITask.findUniqueOrThrow({
      where: { id: taskId },
      select: { executionJobId: true },
    });
    const group = task.executionJobId
      ? await tx.aITask.findMany({
          where: { executionJobId: task.executionJobId },
          select: { id: true },
        })
      : [{ id: taskId }];
    const taskIds = group.map((t) => t.id);
    const since = new Date(Date.now() - 86400000);
    const rows = await tx.aIExecutionAttempt.findMany({
      where: {
        OR: [
          { startedAt: { gte: since } },
          { reservedCostUsd: { gt: 0 } },
          { taskId: { in: taskIds } },
        ],
      },
      select: { taskId: true, startedAt: true, estimatedCostUsd: true, reservedCostUsd: true },
    });
    const sum = (values: typeof rows) =>
      values.reduce(
        (n, row) => n + Number(row.estimatedCostUsd ?? 0) + Number(row.reservedCostUsd),
        0,
      );
    if (
      sum(rows.filter((row) => row.startedAt >= since || Number(row.reservedCostUsd) > 0)) + cost >
        env.AI_MAX_DAILY_COST_USD ||
      sum(rows.filter((row) => taskIds.includes(row.taskId))) + cost > env.AI_MAX_TASK_COST_USD
    )
      throw new AiError("AI_COST_LIMIT");
    return cost;
  }
  listUncertainUsage(workspaceId: string) {
    return this.db.aITask.findMany({
      where: { workspaceId, usageUncertain: true },
      select: {
        id: true,
        status: true,
        reservedTokens: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async startAttempt(
    workspaceId: string,
    taskId: string,
    sequence: number,
    request: AiProviderRequest,
    lease?: { jobId: string; token: string },
  ) {
    return this.db.$transaction(async (tx) => {
      if (lease) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${lease.jobId}::uuid FOR UPDATE`,
        );
        if (
          !(await tx.backgroundJob.findFirst({
            where: {
              id: lease.jobId,
              workspaceId,
              status: "RUNNING",
              leaseToken: lease.token,
              leaseUntil: { gt: new Date() },
              cancelRequestedAt: null,
            },
          }))
        )
          throw new AiError("AI_PERMISSION_DENIED");
      }
      const task = await tx.aITask.findFirst({
        where: {
          id: taskId,
          workspaceId,
          status: "RUNNING",
          ...(lease
            ? { executionJobId: lease.jobId, executorToken: lease.token }
            : { executorToken: null }),
        },
        select: {
          id: true,
          requestedBy: true,
          provider: true,
          reservedTokens: true,
          inputContext: true,
          investigation: { select: { status: true, project: { select: { status: true } } } },
        },
      });
      if (!task) throw new AiError("AI_TASK_NOT_FOUND");
      if (
        task.investigation.status === "ARCHIVED" ||
        task.investigation.project.status === "ARCHIVED" ||
        !(await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: task.requestedBy } },
          select: { id: true },
        }))
      )
        throw new AiError("AI_PERMISSION_DENIED");
      {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "User" WHERE id = ${task.requestedBy}::uuid FOR UPDATE`,
        );
        const captured = await tx.aIExecutionAttempt.aggregate({
          where: { taskId },
          _sum: { inputTokens: true, outputTokens: true },
        });
        const needed =
          (captured._sum.inputTokens ?? 0) +
          (captured._sum.outputTokens ?? 0) +
          (request.inputTokenEstimate ??
            estimateTokens(
              request.system +
                JSON.stringify(request.messages) +
                JSON.stringify(request.structuredOutput),
            )) +
          request.maxTokens;
        if (needed > task.reservedTokens) {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const ledger = await tx.aITask.findMany({
            where: {
              requestedBy: task.requestedBy,
              OR: [
                { createdAt: { gte: since } },
                { completedAt: { gte: since } },
                { usageReconciledAt: { gte: since } },
                { reservedTokens: { gt: 0 } },
              ],
            },
            select: { reservedTokens: true, inputTokens: true, outputTokens: true },
          });
          const used = ledger.reduce(
            (total, row) => total + row.reservedTokens + row.inputTokens + row.outputTokens,
            0,
          );
          if (used + needed - task.reservedTokens > AI_DAILY_USER_TOKEN_CAP)
            throw new AiError("AI_BUDGET_EXCEEDED");
          await tx.aITask.update({ where: { id: taskId }, data: { reservedTokens: needed } });
        }
        const manifest = (
          task.inputContext as {
            sourceManifest?: { evidenceIds?: string[]; knowledgeIds?: string[] };
          } | null
        )?.sourceManifest;
        const evidenceIds = manifest?.evidenceIds ?? [];
        const evidenceVersions =
          (
            task.inputContext as {
              evidence?: Array<{ id: string; version: number; checksum?: string }>;
            } | null
          )?.evidence ?? [];
        for (const evidence of evidenceVersions)
          if (
            !(await tx.evidence.findFirst({
              where: {
                id: evidence.id,
                workspaceId,
                version: evidence.version,
                ...(evidence.checksum ? { checksum: evidence.checksum } : {}),
                deletedAt: null,
                redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
              },
              select: { id: true },
            }))
          )
            throw new AiError("AI_PERMISSION_DENIED", "Evidence changed after context capture.");
        if (
          evidenceIds.length &&
          (await tx.evidence.count({
            where: {
              id: { in: evidenceIds },
              workspaceId,
              deletedAt: null,
              storageKey: { not: null },
              redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
            },
          })) !== new Set(evidenceIds).size
        )
          throw new AiError("AI_PERMISSION_DENIED", "A source was withdrawn before this batch.");
        const knowledgeIds = manifest?.knowledgeIds ?? [];
        if (
          knowledgeIds.length &&
          (await tx.knowledgeChunk.count({
            where: {
              id: { in: knowledgeIds },
              workspaceId,
              document: { reviewStatus: "REVIEWED" },
            },
          })) !== new Set(knowledgeIds).size
        )
          throw new AiError(
            "AI_PERMISSION_DENIED",
            "A knowledge source was withdrawn before this batch.",
          );
      }
      return tx.aIExecutionAttempt.create({
        data: {
          workspaceId,
          taskId,
          sequence,
          provider: request.provider ?? task.provider,
          model: request.model,
          retryCount: request.retryCount ?? 0,
          fallbackFrom: request.fallbackFrom,
          reservedCostUsd: await this.reserveCost(tx, taskId, request),
          requestHash: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
          request: jsonInput(request),
        },
        select: { id: true },
      });
    });
  }
  async finishAttempt(
    workspaceId: string,
    attemptId: string,
    response: AiProviderResponse | null,
    failureCode?: string,
    delivery?: "REJECTED" | "UNCERTAIN",
  ) {
    const old = await this.db.aIExecutionAttempt.findFirst({
      where: { id: attemptId, workspaceId, status: "STARTED" },
    });
    await this.db.aIExecutionAttempt.updateMany({
      where: { id: attemptId, workspaceId, status: "STARTED" },
      data: {
        status: response ? "RECEIVED" : "FAILED",
        providerRequestId: response?.providerRequestId,
        inputTokens: response?.usage.inputTokens ?? 0,
        outputTokens: response?.usage.outputTokens ?? 0,
        response: response ? jsonInput(response) : Prisma.DbNull,
        failureCode,
        completedAt: new Date(),
        returnedModel: response?.model,
        host: response?.host,
        latencyMs: old ? Math.max(0, Date.now() - old.startedAt.getTime()) : undefined,
        estimatedCostUsd:
          response?.costUsd ??
          (response && old ? this.responseCost(old.request, response) : undefined),
        reservedCostUsd: response || delivery === "REJECTED" ? 0 : undefined,
        delivery: response ? "RECEIVED" : (delivery ?? "UNCERTAIN"),
      },
    });
  }
  async resultMessage(workspaceId: string, taskId: string) {
    const message = await this.db.aIMessage.findFirst({
      where: { sourceTaskId: taskId, conversation: { workspaceId } },
      select: messageSelect,
    });
    return message ? mapMessage(message) : null;
  }
  async completeTask(
    workspaceId: string,
    taskId: string,
    data: AiTaskUpdateData,
    result: { message?: AiMessageCreateData; summary?: AiSessionSummaryCreateData },
  ) {
    return this.db.$transaction(async (tx) => {
      if (data.executionJobId) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${data.executionJobId}::uuid FOR UPDATE`,
        );
        if (
          !(await tx.backgroundJob.findFirst({
            where: {
              id: data.executionJobId,
              workspaceId,
              status: "RUNNING",
              leaseToken: data.executorToken,
              leaseUntil: { gt: new Date() },
              cancelRequestedAt: null,
            },
          }))
        )
          return null;
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "AITask" WHERE id = ${taskId}::uuid AND "workspaceId" = ${workspaceId}::uuid FOR UPDATE`,
      );
      const task = await tx.aITask.findFirst({
        where: {
          id: taskId,
          workspaceId,
          status: "RUNNING",
          ...(data.executorToken ? { executorToken: data.executorToken } : { executorToken: null }),
        },
        select: {
          id: true,
          taskType: true,
          inputContext: true,
          contextVersion: true,
          requestedBy: true,
          investigationId: true,
          conversationId: true,
          investigation: { select: { status: true, project: { select: { status: true } } } },
        },
      });
      if (
        !task ||
        task.investigation.status === "ARCHIVED" ||
        task.investigation.project.status === "ARCHIVED"
      )
        return null;
      if (
        !(await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: task.requestedBy } },
          select: { id: true },
        }))
      )
        return null;
      let message: AiMessageRow | null = null;
      const versions =
        (
          task.inputContext as {
            evidence?: Array<{ id: string; version: number; checksum?: string }>;
          } | null
        )?.evidence ?? [];
      for (const evidence of versions)
        if (
          !(await tx.evidence.findFirst({
            where: {
              id: evidence.id,
              workspaceId,
              version: evidence.version,
              ...(evidence.checksum ? { checksum: evidence.checksum } : {}),
              deletedAt: null,
              redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
            },
            select: { id: true },
          }))
        )
          throw new AiError("AI_PERMISSION_DENIED", "Evidence changed before result completion.");
      const manifest = (
        task.inputContext as {
          sourceManifest?: { knowledgeIds?: string[]; evidenceIds?: string[] };
        } | null
      )?.sourceManifest;
      const knowledgeIds = manifest?.knowledgeIds ?? [];
      if (
        knowledgeIds.length &&
        (await tx.knowledgeChunk.count({
          where: { id: { in: knowledgeIds }, workspaceId, document: { reviewStatus: "REVIEWED" } },
        })) !== new Set(knowledgeIds).size
      )
        throw new AiError(
          "AI_PERMISSION_DENIED",
          "A knowledge source was withdrawn before result completion.",
        );
      const evidenceIds = manifest?.evidenceIds ?? [];
      if (
        evidenceIds.length &&
        (await tx.evidence.count({
          where: {
            id: { in: evidenceIds },
            workspaceId,
            deletedAt: null,
            storageKey: { not: null },
            redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
          },
        })) !== new Set(evidenceIds).size
      )
        throw new AiError(
          "AI_PERMISSION_DENIED",
          "An evidence source was withdrawn before result completion.",
        );
      if (result.message) {
        if (result.message.conversationId !== task.conversationId)
          throw new AiError("AI_PERMISSION_DENIED");
        message = mapMessage(
          await tx.aIMessage.create({
            data: {
              ...result.message,
              structuredContent: jsonInput(result.message.structuredContent),
              sourceTaskId: taskId,
            },
            select: messageSelect,
          }),
        );
      }
      if (result.summary) {
        const summary = result.summary;
        if (summary.investigationId !== task.investigationId || summary.sourceTaskId !== task.id)
          throw new AiError("AI_PERMISSION_DENIED");
        const saved = await tx.sessionSummary.create({
          data: { ...summary, generatedByType: "AI" },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            workspaceId,
            userId: task.requestedBy,
            action: "SESSION_SUMMARY_CREATED",
            entityType: "SessionSummary",
            entityId: saved.id,
            metadata: { sourceTaskId: taskId },
          },
        });
      }
      await persistAgentAssessments(tx, task, workspaceId, data.output);
      const completed = await tx.aITask.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          model: data.model,
          provider: data.provider,
          output: jsonInput(data.output),
          ...(data.evaluation !== undefined ? { evaluation: jsonInput(data.evaluation) } : {}),
          inputTokens: data.inputTokens ?? 0,
          outputTokens: data.outputTokens ?? 0,
          estimatedCostUsd: data.estimatedCostUsd ?? 0,
          reservedTokens: 0,
          completedAt: data.completedAt ?? new Date(),
          failureCode: null,
          errorMessage: null,
        },
        select: taskSelect,
      });
      await tx.aITaskEvent.createMany({
        data: [
          { taskId, eventType: "RESULT_STORAGE", description: "Validated result stored." },
          { taskId, eventType: "TASK_COMPLETED", description: "AI task completed." },
        ],
      });
      return { task: mapTask(completed), message };
    });
  }

  async loadContext(
    workspaceId: string,
    investigationId: string,
    conversationId?: string,
    requestedBy?: string,
    preserveAll = false,
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
        engagementId: true,
        engagement: { select: { id: true, name: true, objective: true, status: true } },
        findings: {
          orderBy: { updatedAt: "desc" },
          take: preserveAll ? undefined : 20,
          select: {
            id: true,
            title: true,
            description: true,
            affectedAsset: true,
            severityRationale: true,
            status: true,
            severity: true,
            impact: true,
            remediation: true,
            verificationReviews: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: { id: true, reviewerType: true, conclusion: true, reasoningSummary: true },
            },
          },
        },
        decisions: {
          orderBy: { createdAt: "desc" },
          take: preserveAll ? undefined : 30,
          select: { id: true, kind: true, rationale: true, sourceRefs: true, createdAt: true },
        },
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
          take: preserveAll ? undefined : 100,
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
          take: preserveAll ? undefined : 60,
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
          take: preserveAll ? undefined : 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            summary: true,
            completedWork: true,
            rejectedHypotheses: true,
            unresolvedQuestions: true,
            nextActions: true,
            generatedByType: true,
            sourceTaskId: true,
            createdBy: true,
            sourceTask: { select: { conversationId: true } },
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
          take: preserveAll ? undefined : 40,
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

    const relations = await this.db.investigationRelation.findMany({
      where: { workspaceId, OR: [{ fromId: investigationId }, { toId: investigationId }] },
      select: { fromId: true, toId: true, relationship: true, rationale: true },
      take: 20,
    });
    const relatedIds = relations.map((r) => (r.fromId === investigationId ? r.toId : r.fromId));
    const related = await this.db.investigation.findMany({
      where: {
        workspaceId,
        id: { not: investigationId },
        OR: [
          { id: { in: relatedIds } },
          ...(investigation.engagementId ? [{ engagementId: investigation.engagementId }] : []),
        ],
      },
      select: { id: true, title: true, status: true, objective: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
    const previous = await this.db.aITask.findMany({
      where: {
        workspaceId,
        investigationId,
        status: "COMPLETED",
        taskType: {
          in: [
            "RECON_ANALYSIS",
            "PATTERN_ANALYSIS",
            "HYPOTHESIS_GENERATION",
            "EVIDENCE_REVIEW",
            "FALSE_POSITIVE_REVIEW",
          ],
        },
      },
      select: { id: true, taskType: true, output: true, model: true, promptVersion: true },
      orderBy: { completedAt: "desc" },
      take: 3,
    });
    const history = [
      ...previous.map((t) => ({
        id: t.id,
        title: `Prior AI analysis: ${t.taskType}`,
        status: "COMPLETED",
        objective: null,
        sourceType: "AI_TASK",
        output: t.output,
        model: t.model,
        promptVersion: t.promptVersion,
      })),
      ...related.map((i) => ({
        ...i,
        sourceType: "INVESTIGATION",
        relations: relations.filter((r) => r.fromId === i.id || r.toId === i.id),
      })),
    ];
    const retrieved = requestedBy
      ? await new PrismaKnowledgeRetrievalStore(this.db).retrieve(
          { workspaceId, userId: requestedBy, role: "RESEARCHER" },
          {
            investigationId,
            query: [investigation.category, investigation.title]
              .filter(Boolean)
              .join(" ")
              .slice(0, 500),
            limit: 8,
          },
        )
      : null;

    return {
      engagement: investigation.engagement,
      findings: investigation.findings.map((f) => ({ ...f, reviews: f.verificationReviews })),
      decisions: investigation.decisions,
      history,
      knowledge: retrieved?.results ?? [],
      retrievalId: retrieved?.retrievalId,
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
        sourceTaskId: summary.sourceTaskId,
        sourceConversationId: summary.sourceTask?.conversationId ?? null,
        createdBy: summary.createdBy,
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
        select: { id: true, workspaceId: true, investigationId: true, status: true },
      });

      if (!conversation) {
        throw new Error("The conversation does not exist.");
      }
      if (data.actor) {
        if (data.actor.workspaceId !== conversation.workspaceId || conversation.status !== "ACTIVE")
          throw new AiError("AI_PERMISSION_DENIED");
        await lockResearchInvestigation(
          tx,
          { ...data.actor, role: "RESEARCHER" },
          conversation.investigationId,
        );
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "AIConversation" WHERE id = ${data.conversationId}::uuid FOR UPDATE`,
      );
      if (
        (await tx.aIConversation.findUniqueOrThrow({ where: { id: data.conversationId } }))
          .status !== "ACTIVE"
      )
        throw new AiError("AI_PERMISSION_DENIED");
      if (data.operationKey) {
        const old = await tx.aIMessage.findUnique({
          where: {
            conversationId_operationKey: {
              conversationId: data.conversationId,
              operationKey: data.operationKey,
            },
          },
          select: messageSelect,
        });
        if (old) {
          if (old.content !== data.content || old.role !== data.role)
            throw new AiError(
              "AI_PERMISSION_DENIED",
              "This operation identifier belongs to another message.",
            );
          return mapMessage(old);
        }
      }

      const message = await tx.aIMessage.create({
        data: {
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          operationKey: data.operationKey,
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
      if (
        data.executionJobId &&
        !(await tx.backgroundJob.findFirst({
          where: {
            id: data.executionJobId,
            workspaceId: data.workspaceId,
            requestedBy: data.requestedBy,
            status: "RUNNING",
            leaseToken: data.executorToken,
            leaseUntil: { gt: new Date() },
          },
        }))
      )
        throw new AiError("AI_PERMISSION_DENIED");
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${data.requestedBy}::uuid FOR UPDATE`,
      );
      const existing = await tx.aITask.findUnique({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId: data.workspaceId,
            idempotencyKey: data.idempotencyKey,
          },
        },
        select: { ...taskSelect, requestHash: true },
      });
      if (existing) {
        if (
          existing.requestedBy !== data.requestedBy ||
          existing.requestHash !== (data.requestHash ?? null)
        )
          throw new AiError(
            "AI_PERMISSION_DENIED",
            "The operation key belongs to a different request.",
          );
        return mapTask(existing);
      }
      const member = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: data.workspaceId, userId: data.requestedBy } },
        select: { id: true },
      });
      if (!member) throw new AiError("AI_PERMISSION_DENIED");
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tasks = await tx.aITask.findMany({
        where: {
          requestedBy: data.requestedBy,
          OR: [
            { createdAt: { gte: since } },
            { completedAt: { gte: since } },
            { usageReconciledAt: { gte: since } },
            { reservedTokens: { gt: 0 } },
          ],
        },
        select: { inputTokens: true, outputTokens: true, reservedTokens: true },
      });
      const used = tasks.reduce(
        (total, task) => total + task.inputTokens + task.outputTokens + task.reservedTokens,
        0,
      );
      const reservation =
        data.reservationTokens ?? 2 * (data.inputTokenBudget + data.outputTokenBudget);
      const budgetExceeded = used + reservation > AI_DAILY_USER_TOKEN_CAP;

      const investigation = await tx.investigation.findFirst({
        where: { id: data.investigationId, workspaceId: data.workspaceId },
        select: { id: true, status: true, project: { select: { status: true } } },
      });

      if (
        !investigation ||
        investigation.status === "ARCHIVED" ||
        investigation.project.status === "ARCHIVED"
      ) {
        throw new Error("The investigation does not exist in this workspace.");
      }

      const task = await tx.aITask.create({
        data: {
          workspaceId: data.workspaceId,
          investigationId: data.investigationId,
          conversationId: data.conversationId,
          taskType: data.taskType,
          status: budgetExceeded ? "FAILED" : "PENDING",
          failureCode: budgetExceeded ? "AI_BUDGET_EXCEEDED" : null,
          completedAt: budgetExceeded ? new Date() : null,
          reservedTokens: budgetExceeded ? 0 : reservation,
          requestHash: data.requestHash,
          executionJobId: data.executionJobId,
          executorToken: data.executorToken,
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
          collaborationId: data.collaborationId,
          collaborationStage: data.collaborationStage,
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
      if (data.executionJobId) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${data.executionJobId}::uuid FOR UPDATE`,
        );
        if (
          !(await tx.backgroundJob.findFirst({
            where: {
              id: data.executionJobId,
              workspaceId,
              status: "RUNNING",
              leaseToken: data.executorToken,
              leaseUntil: { gt: new Date() },
              cancelRequestedAt: null,
            },
          }))
        )
          return null;
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "AITask" WHERE id = ${taskId}::uuid AND "workspaceId" = ${workspaceId}::uuid FOR UPDATE`,
      );

      const existing = await tx.aITask.findFirst({
        where: { id: taskId, workspaceId },
        select: {
          id: true,
          status: true,
          reservedTokens: true,
          usageUncertain: true,
          requestedBy: true,
          executionJobId: true,
          provider: true,
          taskType: true,
        },
      });

      if (
        !existing ||
        (data.executionJobId && existing.executionJobId !== data.executionJobId) ||
        ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(existing.status) ||
        (data.status === "RUNNING" && existing.status !== "PENDING")
      ) {
        return null;
      }

      if (data.status !== undefined && data.status !== existing.status) {
        const transition = transitionAiTask(existing.status, data.status, "SYSTEM");

        if (!transition.ok) {
          throw new Error(transition.message);
        }
      }

      const terminal = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(
        data.status ?? "",
      );
      if (data.status === "RUNNING" && data.inputContext) {
        if (
          !(await tx.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: existing.requestedBy } },
            select: { id: true },
          }))
        )
          throw new AiError("AI_PERMISSION_DENIED");
        const manifest = (
          data.inputContext as {
            sourceManifest?: { evidenceIds?: string[]; knowledgeIds?: string[] };
          }
        ).sourceManifest;
        const evidenceIds = manifest?.evidenceIds ?? [];
        if (evidenceIds.length) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "Evidence" WHERE id IN (${Prisma.join(evidenceIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`,
          );
          if (
            (await tx.evidence.count({
              where: {
                id: { in: evidenceIds },
                workspaceId,
                deletedAt: null,
                storageKey: { not: null },
                redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
              },
            })) !== new Set(evidenceIds).size
          )
            throw new AiError(
              "AI_PERMISSION_DENIED",
              "An evidence source changed before request capture.",
            );
        }
        const knowledgeIds = manifest?.knowledgeIds ?? [];
        if (
          knowledgeIds.length &&
          (await tx.knowledgeChunk.count({
            where: {
              id: { in: knowledgeIds },
              workspaceId,
              document: { reviewStatus: "REVIEWED" },
            },
          })) !== new Set(knowledgeIds).size
        )
          throw new AiError(
            "AI_PERMISSION_DENIED",
            "A knowledge source was withdrawn before request capture.",
          );
      }
      const uncertainAttempt = terminal
        ? await tx.aIExecutionAttempt.count({
            where: {
              taskId,
              OR: [
                { status: "STARTED" },
                {
                  status: "FAILED",
                  OR: [
                    { delivery: "UNCERTAIN" },
                    {
                      delivery: null,
                      failureCode: { in: ["AI_TIMEOUT", "AI_PROVIDER_ERROR", "AI_INVALID_OUTPUT"] },
                    },
                  ],
                },
              ],
            },
          })
        : 0;
      const uncertain = existing.usageUncertain || uncertainAttempt > 0;
      const captured = terminal
        ? await tx.aIExecutionAttempt.aggregate({
            where: { taskId },
            _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
          })
        : null;
      const update: Prisma.AITaskUncheckedUpdateInput = {
        ...(terminal
          ? {
              reservedTokens: uncertain
                ? Math.max(
                    0,
                    existing.reservedTokens -
                      (captured?._sum.inputTokens ?? 0) -
                      (captured?._sum.outputTokens ?? 0),
                  )
                : 0,
              usageUncertain: uncertain,
            }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.executionJobId
          ? { executionJobId: data.executionJobId, executorToken: data.executorToken }
          : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.provider !== undefined ? { provider: data.provider } : {}),
        ...(data.promptTemplateId !== undefined ? { promptTemplateId: data.promptTemplateId } : {}),
        ...(data.promptVersion !== undefined ? { promptVersion: data.promptVersion } : {}),
        ...(data.contextVersion !== undefined ? { contextVersion: data.contextVersion } : {}),
        ...(data.inputContext !== undefined ? { inputContext: jsonInput(data.inputContext) } : {}),
        ...(data.output !== undefined ? { output: jsonInput(data.output) } : {}),
        ...(data.evaluation !== undefined ? { evaluation: jsonInput(data.evaluation) } : {}),
        ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
        ...(data.failureCode !== undefined ? { failureCode: data.failureCode } : {}),
        ...(terminal
          ? {
              inputTokens: Math.max(data.inputTokens ?? 0, captured?._sum.inputTokens ?? 0),
              outputTokens: Math.max(data.outputTokens ?? 0, captured?._sum.outputTokens ?? 0),
            }
          : {
              ...(data.inputTokens !== undefined ? { inputTokens: data.inputTokens } : {}),
              ...(data.outputTokens !== undefined ? { outputTokens: data.outputTokens } : {}),
            }),
        ...(data.estimatedCostUsd !== undefined
          ? { estimatedCostUsd: data.estimatedCostUsd }
          : terminal
            ? {
                estimatedCostUsd:
                  captured?._sum.estimatedCostUsd ??
                  estimateCostUsd(
                    AI_TASK_PROFILES[existing.taskType].tier,
                    captured?._sum.inputTokens ?? 0,
                    captured?._sum.outputTokens ?? 0,
                    existing.provider,
                  ),
              }
            : {}),
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
