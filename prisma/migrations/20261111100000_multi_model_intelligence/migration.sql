ALTER TYPE "AIProvider" ADD VALUE 'GEMINI';
ALTER TYPE "AIProvider" ADD VALUE 'OPENROUTER';
ALTER TYPE "AITaskType" ADD VALUE 'RESEARCH_CONCLUSION_REVIEW';

ALTER TABLE "AIProviderQuota"
  ADD COLUMN "failures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cooldownUntil" TIMESTAMP(3),
  ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastFailureCode" TEXT;

CREATE TABLE "AICollaboration" (
  "id" UUID NOT NULL, "workspaceId" UUID NOT NULL, "investigationId" UUID NOT NULL,
  "jobId" UUID NOT NULL, "taskType" "AITaskType" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING', "contextVersion" TEXT NOT NULL,
  "context" JSONB NOT NULL, "result" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AICollaboration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AICollaboration_jobId_key" ON "AICollaboration"("jobId");
CREATE UNIQUE INDEX "AICollaboration_id_workspaceId_key" ON "AICollaboration"("id", "workspaceId");
CREATE INDEX "AICollaboration_workspaceId_investigationId_idx" ON "AICollaboration"("workspaceId", "investigationId");
ALTER TABLE "AITask" ADD COLUMN "collaborationId" UUID, ADD COLUMN "collaborationStage" TEXT, ADD COLUMN "evaluation" JSONB;
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_collaborationId_workspaceId_fkey"
  FOREIGN KEY ("collaborationId", "workspaceId") REFERENCES "AICollaboration"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AIExecutionAttempt"
  ADD COLUMN "provider" "AIProvider", ADD COLUMN "model" TEXT, ADD COLUMN "returnedModel" TEXT,
  ADD COLUMN "host" TEXT, ADD COLUMN "latencyMs" INTEGER, ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fallbackFrom" TEXT, ADD COLUMN "estimatedCostUsd" DECIMAL(12,6),
  ADD COLUMN "reservedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0, ADD COLUMN "delivery" TEXT;
UPDATE "AIExecutionAttempt" a SET "provider" = t."provider", "model" = t."model"
  FROM "AITask" t WHERE t.id = a."taskId";
