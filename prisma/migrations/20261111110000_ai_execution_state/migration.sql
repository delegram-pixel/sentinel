-- Progress is mutable; source snapshots remain protected by v2_ai_snapshot.
ALTER TABLE "AITask" ADD COLUMN "executionState" JSONB;
ALTER TABLE "AIExecutionAttempt" DROP CONSTRAINT "AIExecutionAttempt_limits_check";
ALTER TABLE "AIExecutionAttempt" ADD CONSTRAINT "AIExecutionAttempt_limits_check"
  CHECK (sequence >= 1 AND "inputTokens" >= 0 AND "outputTokens" >= 0
    AND status IN ('STARTED', 'RECEIVED', 'FAILED') AND "retryCount" BETWEEN 0 AND 2
    AND "reservedCostUsd" >= 0 AND ("estimatedCostUsd" IS NULL OR "estimatedCostUsd" >= 0));
ALTER TABLE "AICollaboration" ADD CONSTRAINT "AICollaboration_status_check"
  CHECK (status IN ('RUNNING', 'COMPLETE', 'INCOMPLETE', 'FAILED', 'CANCELLED'));
CREATE FUNCTION sentinel_collaboration_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.context IS DISTINCT FROM OLD.context OR NEW."contextVersion" IS DISTINCT FROM OLD."contextVersion" THEN
    RAISE EXCEPTION 'Collaboration context snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "collaboration_snapshot" BEFORE UPDATE ON "AICollaboration"
  FOR EACH ROW EXECUTE FUNCTION sentinel_collaboration_snapshot_guard();
