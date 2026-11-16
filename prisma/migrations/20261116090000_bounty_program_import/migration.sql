BEGIN;

ALTER TABLE "BackgroundJob" DROP CONSTRAINT "BackgroundJob_limits_check";
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_limits_check"
  CHECK (
    "attempts" >= 0
    AND "maxAttempts" BETWEEN 1 AND 5
    AND "progress" BETWEEN 0 AND 100
    AND "kind" IN ('AI_TASK', 'BOUNTY_IMPORT', 'KNOWLEDGE_INDEX', 'TOOL_IMPORT', 'EVIDENCE_CLEANUP', 'EVIDENCE_PROMOTION')
  );

COMMIT;
