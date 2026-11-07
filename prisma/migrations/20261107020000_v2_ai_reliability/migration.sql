-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AIMessage" ADD COLUMN     "sourceTaskId" UUID;

-- AlterTable
ALTER TABLE "AITask" ADD COLUMN     "requestHash" TEXT,
ADD COLUMN     "reservedTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIExecutionAttempt" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "requestHash" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "providerRequestId" TEXT,
    "failureCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIExecutionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJob_status_availableAt_idx" ON "BackgroundJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_leaseUntil_idx" ON "BackgroundJob"("leaseUntil");

-- CreateIndex
CREATE INDEX "BackgroundJob_workspaceId_createdAt_idx" ON "BackgroundJob"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_workspaceId_operationKey_key" ON "BackgroundJob"("workspaceId", "operationKey");

-- CreateIndex
CREATE INDEX "AIExecutionAttempt_workspaceId_taskId_idx" ON "AIExecutionAttempt"("workspaceId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "AIExecutionAttempt_taskId_sequence_key" ON "AIExecutionAttempt"("taskId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AIMessage_sourceTaskId_key" ON "AIMessage"("sourceTaskId");

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "AITask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIExecutionAttempt" ADD CONSTRAINT "AIExecutionAttempt_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "AITask"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ADR-029: workspace/member ownership, bounded registered job types, and immutable inputs.
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_requester_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_limits_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 5 AND "progress" BETWEEN 0 AND 100 AND "kind" IN ('AI_TASK', 'KNOWLEDGE_INDEX', 'TOOL_IMPORT', 'EVIDENCE_CLEANUP'));
ALTER TABLE "AIExecutionAttempt" ADD CONSTRAINT "AIExecutionAttempt_limits_check" CHECK (sequence BETWEEN 1 AND 2 AND "inputTokens" >= 0 AND "outputTokens" >= 0 AND status IN ('STARTED', 'RECEIVED', 'FAILED'));
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_reservation_check" CHECK ("reservedTokens" >= 0);

CREATE FUNCTION sentinel_ai_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."inputContext" IS NOT NULL AND OLD."inputContext" ? 'snapshotVersion' AND NEW."inputContext" IS DISTINCT FROM OLD."inputContext" THEN
    RAISE EXCEPTION 'AI context snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "v2_ai_snapshot" BEFORE UPDATE ON "AITask" FOR EACH ROW EXECUTE FUNCTION sentinel_ai_snapshot_guard();
