-- AlterTable
ALTER TABLE "AIMessage" ADD COLUMN     "operationKey" TEXT;

-- AlterTable
ALTER TABLE "AITask" ADD COLUMN     "usageReconciledAt" TIMESTAMP(3),
ADD COLUMN     "usageUncertain" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "AIMessage_conversationId_operationKey_key" ON "AIMessage"("conversationId", "operationKey");

ALTER TABLE "AITask" ADD CONSTRAINT "AITask_uncertain_usage_check" CHECK (NOT "usageUncertain" OR "reservedTokens" > 0);
-- Original user turns with an operation identity cannot be repurposed by a retry.
CREATE FUNCTION sentinel_v2_message_operation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."operationKey" IS NOT NULL AND ROW(NEW."operationKey",NEW."conversationId",NEW.role,NEW.content) IS DISTINCT FROM ROW(OLD."operationKey",OLD."conversationId",OLD.role,OLD.content) THEN RAISE EXCEPTION 'Idempotent conversation turns are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "AIMessage_operation_immutable" BEFORE UPDATE ON "AIMessage" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_message_operation_immutable();
