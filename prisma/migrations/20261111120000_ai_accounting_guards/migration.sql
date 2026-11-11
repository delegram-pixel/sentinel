CREATE INDEX "AITask_executionJobId_idx" ON "AITask"("executionJobId");
CREATE INDEX "AITask_collaborationId_workspaceId_idx" ON "AITask"("collaborationId", "workspaceId");
CREATE INDEX "AIExecutionAttempt_startedAt_idx" ON "AIExecutionAttempt"("startedAt");
CREATE INDEX "AIExecutionAttempt_open_cost_idx" ON "AIExecutionAttempt"("reservedCostUsd") WHERE "reservedCostUsd" > 0;
ALTER TABLE "AICollaboration" ADD CONSTRAINT "AICollaboration_investigationId_workspaceId_fkey"
  FOREIGN KEY ("investigationId", "workspaceId") REFERENCES "Investigation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_collaboration_stage_check"
  CHECK (("collaborationId" IS NULL AND "collaborationStage" IS NULL) OR
    ("collaborationId" IS NOT NULL AND "collaborationStage" IN ('PRIMARY', 'SECONDARY', 'REVIEW')));
