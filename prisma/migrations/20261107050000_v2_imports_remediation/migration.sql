-- AlterTable
ALTER TABLE "ReportRevision" ADD COLUMN     "sourceTaskId" UUID;

-- CreateTable
CREATE TABLE "ToolImport" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "operationKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sourceTool" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "fieldMapping" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedResult" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "recordIndex" INTEGER NOT NULL,
    "sourceRecordId" TEXT,
    "canonical" JSONB NOT NULL,
    "rawRecord" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "duplicateCandidates" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewRationale" TEXT,
    "investigationId" UUID,
    "assetId" UUID,
    "adoptedObservationId" UUID,
    "adoptedFindingId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationPlan" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetestRecord" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "scopeVersionId" UUID NOT NULL,
    "activity" TEXT NOT NULL,
    "requestedBy" UUID NOT NULL,
    "requestRationale" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suppliedResults" TEXT,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "conclusion" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewRationale" TEXT,

    CONSTRAINT "RetestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "reportId" UUID,
    "findingId" UUID,
    "outcome" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "externalReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL,
    "recordedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolImport_workspaceId_createdAt_idx" ON "ToolImport"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolImport_id_workspaceId_key" ON "ToolImport"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolImport_workspaceId_operationKey_key" ON "ToolImport"("workspaceId", "operationKey");

-- CreateIndex
CREATE INDEX "ImportedResult_workspaceId_fingerprint_idx" ON "ImportedResult"("workspaceId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedResult_importId_recordIndex_key" ON "ImportedResult"("importId", "recordIndex");

-- CreateIndex
CREATE INDEX "RemediationPlan_workspaceId_findingId_idx" ON "RemediationPlan"("workspaceId", "findingId");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationPlan_id_workspaceId_key" ON "RemediationPlan"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "RetestRecord_workspaceId_planId_idx" ON "RetestRecord"("workspaceId", "planId");

-- CreateIndex
CREATE INDEX "SubmissionEvent_workspaceId_occurredAt_idx" ON "SubmissionEvent"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "SubmissionEvent_reportId_idx" ON "SubmissionEvent"("reportId");

-- CreateIndex
CREATE INDEX "SubmissionEvent_findingId_idx" ON "SubmissionEvent"("findingId");

-- AddForeignKey
ALTER TABLE "ToolImport" ADD CONSTRAINT "ToolImport_engagementId_workspaceId_fkey" FOREIGN KEY ("engagementId", "workspaceId") REFERENCES "Engagement"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_importId_workspaceId_fkey" FOREIGN KEY ("importId", "workspaceId") REFERENCES "ToolImport"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_planId_workspaceId_fkey" FOREIGN KEY ("planId", "workspaceId") REFERENCES "RemediationPlan"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additive tenant, provenance and human review invariants.
ALTER TABLE "ToolImport" ADD CONSTRAINT "ToolImport_creator_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "ToolImport" ADD CONSTRAINT "ToolImport_format_check" CHECK (format IN ('JSON','CSV','SARIF'));
ALTER TABLE "ToolImport" ADD CONSTRAINT "ToolImport_status_check" CHECK (status IN ('QUEUED','READY','FAILED'));
ALTER TABLE "ToolImport" ADD CONSTRAINT "ToolImport_size_check" CHECK (octet_length("rawContent") BETWEEN 1 AND 500000);
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_reviewer_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_investigation_fkey" FOREIGN KEY ("investigationId","workspaceId") REFERENCES "Investigation"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_asset_fkey" FOREIGN KEY ("assetId","workspaceId") REFERENCES "EngagementAsset"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_finding_fkey" FOREIGN KEY ("adoptedFindingId","workspaceId") REFERENCES "Finding"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_observation_fkey" FOREIGN KEY ("adoptedObservationId") REFERENCES "InvestigationObservation"(id) ON DELETE RESTRICT;
ALTER TABLE "ImportedResult" ADD CONSTRAINT "ImportedResult_review_check" CHECK (
  (status = 'PENDING' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "adoptedFindingId" IS NULL AND "adoptedObservationId" IS NULL) OR
  (status = 'REJECTED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length("reviewRationale") >= 10 AND "adoptedFindingId" IS NULL AND "adoptedObservationId" IS NULL) OR
  (status = 'ADOPTED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length("reviewRationale") >= 10 AND "investigationId" IS NOT NULL AND "assetId" IS NOT NULL AND num_nonnulls("adoptedFindingId","adoptedObservationId") = 1));
ALTER TABLE "RemediationPlan" ADD CONSTRAINT "RemediationPlan_finding_fkey" FOREIGN KEY ("findingId","workspaceId") REFERENCES "Finding"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "RemediationPlan" ADD CONSTRAINT "RemediationPlan_creator_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "RemediationPlan" ADD CONSTRAINT "RemediationPlan_status_check" CHECK (status IN ('PLANNED','IN_PROGRESS','READY_FOR_RETEST','VERIFIED','CLOSED'));
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_asset_fkey" FOREIGN KEY ("assetId","workspaceId") REFERENCES "EngagementAsset"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_scope_fkey" FOREIGN KEY ("scopeVersionId") REFERENCES "ScopeVersion"(id) ON DELETE RESTRICT;
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_requester_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_reviewer_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_activity_check" CHECK (activity IN ('ACTIVE_TEST','PASSIVE_FETCH'));
ALTER TABLE "RetestRecord" ADD CONSTRAINT "RetestRecord_review_check" CHECK ((conclusion IS NULL AND "reviewedAt" IS NULL AND "reviewedBy" IS NULL) OR (conclusion IN ('RESOLVED','PERSISTS','INCONCLUSIVE') AND "reviewedAt" IS NOT NULL AND "reviewedBy" IS NOT NULL AND length("reviewRationale") >= 10 AND length("suppliedResults") > 0 AND jsonb_array_length("evidenceIds") > 0));
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT;
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_finding_fkey" FOREIGN KEY ("findingId","workspaceId") REFERENCES "Finding"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_report_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"(id) ON DELETE RESTRICT;
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_actor_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_subject_check" CHECK (num_nonnulls("reportId","findingId") >= 1);
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_outcome_check" CHECK (outcome IN ('SUBMITTED','ACCEPTED','DUPLICATE','INFORMATIONAL','REJECTED','WITHDRAWN'));
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_sourceTask_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "AITask"(id) ON DELETE RESTRICT;

CREATE FUNCTION sentinel_v2_import_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'ToolImport' THEN
    IF ROW(NEW."workspaceId", NEW."engagementId", NEW."createdBy", NEW."rawContent", NEW.checksum, NEW.format, NEW."sourceTool", NEW."parserVersion", NEW."mappingVersion", NEW."fieldMapping", NEW."operationKey", NEW."fileName") IS DISTINCT FROM
       ROW(OLD."workspaceId", OLD."engagementId", OLD."createdBy", OLD."rawContent", OLD.checksum, OLD.format, OLD."sourceTool", OLD."parserVersion", OLD."mappingVersion", OLD."fieldMapping", OLD."operationKey", OLD."fileName") THEN RAISE EXCEPTION 'Supplied import provenance is immutable'; END IF;
  ELSE
    IF OLD.status <> 'PENDING' OR ROW(NEW."workspaceId",NEW."importId",NEW."recordIndex",NEW.canonical,NEW."rawRecord",NEW.fingerprint,NEW."sourceRecordId",NEW."duplicateCandidates") IS DISTINCT FROM ROW(OLD."workspaceId",OLD."importId",OLD."recordIndex",OLD.canonical,OLD."rawRecord",OLD.fingerprint,OLD."sourceRecordId",OLD."duplicateCandidates") THEN RAISE EXCEPTION 'Imported originals and reviewed adoption are immutable'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ToolImport_immutable" BEFORE UPDATE ON "ToolImport" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_import_immutable();
CREATE TRIGGER "ImportedResult_immutable" BEFORE UPDATE ON "ImportedResult" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_import_immutable();

CREATE FUNCTION sentinel_v2_workflow_parent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'ImportedResult' THEN
    IF NEW.status = 'ADOPTED' THEN
    IF NOT EXISTS (SELECT 1 FROM "Investigation" i JOIN "ToolImport" t ON t.id = NEW."importId" JOIN "EngagementAsset" a ON a.id = NEW."assetId" WHERE i.id = NEW."investigationId" AND i."engagementId" = t."engagementId" AND a."engagementId" = t."engagementId" AND a."targetId" = i."targetId") OR
       (NEW."adoptedFindingId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Finding" WHERE id = NEW."adoptedFindingId" AND "investigationId" = NEW."investigationId")) OR
       (NEW."adoptedObservationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InvestigationObservation" WHERE id = NEW."adoptedObservationId" AND "investigationId" = NEW."investigationId")) THEN RAISE EXCEPTION 'Imported adoption must match engagement, asset and investigation'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'RetestRecord' THEN
    IF NOT EXISTS (SELECT 1 FROM "RemediationPlan" p JOIN "Finding" f ON f.id = p."findingId" JOIN "Investigation" i ON i.id = f."investigationId" JOIN "EngagementAsset" a ON a.id = NEW."assetId" JOIN "EngagementAuthorization" auth ON auth."assetId" = a.id AND auth."scopeVersionId" = NEW."scopeVersionId" JOIN "ScopeVersion" s ON s.id = auth."scopeVersionId" WHERE p.id = NEW."planId" AND a."engagementId" = i."engagementId" AND a."targetId" = i."targetId" AND s."targetId" = a."targetId") THEN RAISE EXCEPTION 'Retest must match documented engagement authorization'; END IF;
    IF TG_OP = 'UPDATE' AND (OLD."reviewedAt" IS NOT NULL OR ROW(NEW."workspaceId",NEW."planId",NEW."assetId",NEW."scopeVersionId",NEW.activity,NEW."requestedBy",NEW."requestedAt",NEW."requestRationale") IS DISTINCT FROM ROW(OLD."workspaceId",OLD."planId",OLD."assetId",OLD."scopeVersionId",OLD.activity,OLD."requestedBy",OLD."requestedAt",OLD."requestRationale")) THEN RAISE EXCEPTION 'Retest request and completed review are immutable'; END IF;
  ELSIF TG_TABLE_NAME = 'SubmissionEvent' THEN
    IF NEW."reportId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Report" WHERE id = NEW."reportId" AND "workspaceId" = NEW."workspaceId") THEN RAISE EXCEPTION 'Submission report tenant mismatch'; END IF;
    IF NEW."reportId" IS NOT NULL AND NEW."findingId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ReportFinding" WHERE "reportId" = NEW."reportId" AND "findingId" = NEW."findingId") THEN RAISE EXCEPTION 'Submission finding must be in report'; END IF;
  ELSIF TG_TABLE_NAME = 'ReportRevision' THEN
    IF NEW."sourceTaskId" IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "AITask" t JOIN "Report" r ON r.id = NEW."reportId" WHERE t.id = NEW."sourceTaskId" AND t."workspaceId" = r."workspaceId" AND t."investigationId" = r."investigationId" AND t.status = 'COMPLETED' AND t."taskType" = 'REPORT_GENERATION') OR NEW."generatedByType" <> 'AI_ASSISTED' THEN RAISE EXCEPTION 'AI report draft requires a completed matching source task'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ImportedResult_parent" BEFORE INSERT OR UPDATE ON "ImportedResult" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_workflow_parent();
CREATE TRIGGER "RetestRecord_parent" BEFORE INSERT OR UPDATE ON "RetestRecord" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_workflow_parent();
CREATE TRIGGER "SubmissionEvent_parent" BEFORE INSERT ON "SubmissionEvent" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_workflow_parent();
CREATE TRIGGER "ReportRevision_source_parent" BEFORE INSERT OR UPDATE ON "ReportRevision" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_workflow_parent();
