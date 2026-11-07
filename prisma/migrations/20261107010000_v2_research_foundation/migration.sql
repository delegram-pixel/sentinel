-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResearchPhase" AS ENUM ('CONTEXT_GATHERING', 'ANALYSIS', 'HYPOTHESIS_DEVELOPMENT', 'EVIDENCE_REVIEW', 'HUMAN_REVIEW', 'REPORTING', 'CLOSED');

-- CreateEnum
CREATE TYPE "KnowledgeReviewStatus" AS ENUM ('DRAFT', 'REVIEWED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "KnowledgeOrigin" AS ENUM ('USER_NOTE', 'PUBLIC_REFERENCE', 'IMPORTED_RESULT', 'AI_INTERPRETATION', 'HUMAN_REVIEWED');

-- CreateEnum
CREATE TYPE "ResearchDecisionKind" AS ENUM ('RESEARCH_NOTE', 'MORE_RESEARCH', 'REJECT_HYPOTHESIS', 'ADOPT_AI_RESULT', 'CLOSE_INVESTIGATION', 'CLOSE_FINDING');

-- AlterTable
ALTER TABLE "Investigation" ADD COLUMN     "engagementId" UUID,
ADD COLUMN     "phase" "ResearchPhase" NOT NULL DEFAULT 'CONTEXT_GATHERING';

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "collectedAt" TIMESTAMP(3),
ADD COLUMN     "collector" TEXT,
ADD COLUMN     "uploadValidatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "engagementType" "ProjectType" NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "legacyProjectId" UUID,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementAsset" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementAuthorization" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "scopeVersionId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "recordedBy" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchDecision" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "findingId" UUID,
    "hypothesisId" UUID,
    "sourceRefs" JSONB NOT NULL DEFAULT '[]',
    "sourceTaskId" UUID,
    "kind" "ResearchDecisionKind" NOT NULL DEFAULT 'RESEARCH_NOTE',
    "rationale" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "legacySourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationRelation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "origin" "KnowledgeOrigin" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "engagementId" UUID,
    "investigationId" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewStatus" "KnowledgeReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeRelation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_legacyProjectId_key" ON "Engagement"("legacyProjectId");

-- CreateIndex
CREATE INDEX "Engagement_workspaceId_status_idx" ON "Engagement"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Engagement_projectId_idx" ON "Engagement"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_id_workspaceId_key" ON "Engagement"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "EngagementAsset_targetId_idx" ON "EngagementAsset"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementAsset_id_workspaceId_key" ON "EngagementAsset"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementAsset_engagementId_targetId_key" ON "EngagementAsset"("engagementId", "targetId");

-- CreateIndex
CREATE INDEX "EngagementAuthorization_workspaceId_idx" ON "EngagementAuthorization"("workspaceId");

-- CreateIndex
CREATE INDEX "EngagementAuthorization_scopeVersionId_idx" ON "EngagementAuthorization"("scopeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementAuthorization_assetId_scopeVersionId_key" ON "EngagementAuthorization"("assetId", "scopeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchDecision_legacySourceId_key" ON "ResearchDecision"("legacySourceId");

-- CreateIndex
CREATE INDEX "ResearchDecision_workspaceId_investigationId_createdAt_idx" ON "ResearchDecision"("workspaceId", "investigationId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchDecision_findingId_idx" ON "ResearchDecision"("findingId");

-- CreateIndex
CREATE INDEX "ResearchDecision_sourceTaskId_idx" ON "ResearchDecision"("sourceTaskId");

-- CreateIndex
CREATE INDEX "InvestigationRelation_workspaceId_toId_idx" ON "InvestigationRelation"("workspaceId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationRelation_fromId_toId_relationship_key" ON "InvestigationRelation"("fromId", "toId", "relationship");

-- CreateIndex
CREATE INDEX "KnowledgeSource_workspaceId_origin_idx" ON "KnowledgeSource"("workspaceId", "origin");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_id_workspaceId_key" ON "KnowledgeSource"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_workspaceId_reviewStatus_idx" ON "KnowledgeDocument"("workspaceId", "reviewStatus");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_engagementId_idx" ON "KnowledgeDocument"("engagementId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_investigationId_idx" ON "KnowledgeDocument"("investigationId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_id_workspaceId_key" ON "KnowledgeDocument"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeRelation_workspaceId_toId_idx" ON "KnowledgeRelation"("workspaceId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRelation_fromId_toId_relationship_key" ON "KnowledgeRelation"("fromId", "toId", "relationship");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_workspaceId_key" ON "Project"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Investigation_engagementId_idx" ON "Investigation"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "Investigation_id_workspaceId_key" ON "Investigation"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_id_workspaceId_key" ON "Finding"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_id_workspaceId_key" ON "Evidence"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AITask_id_workspaceId_key" ON "AITask"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_engagementId_workspaceId_fkey" FOREIGN KEY ("engagementId", "workspaceId") REFERENCES "Engagement"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementAsset" ADD CONSTRAINT "EngagementAsset_engagementId_workspaceId_fkey" FOREIGN KEY ("engagementId", "workspaceId") REFERENCES "Engagement"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementAsset" ADD CONSTRAINT "EngagementAsset_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementAuthorization" ADD CONSTRAINT "EngagementAuthorization_assetId_workspaceId_fkey" FOREIGN KEY ("assetId", "workspaceId") REFERENCES "EngagementAsset"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementAuthorization" ADD CONSTRAINT "EngagementAuthorization_scopeVersionId_fkey" FOREIGN KEY ("scopeVersionId") REFERENCES "ScopeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchDecision" ADD CONSTRAINT "ResearchDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchDecision" ADD CONSTRAINT "ResearchDecision_investigationId_workspaceId_fkey" FOREIGN KEY ("investigationId", "workspaceId") REFERENCES "Investigation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchDecision" ADD CONSTRAINT "ResearchDecision_findingId_workspaceId_fkey" FOREIGN KEY ("findingId", "workspaceId") REFERENCES "Finding"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchDecision" ADD CONSTRAINT "ResearchDecision_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchDecision" ADD CONSTRAINT "ResearchDecision_sourceTaskId_workspaceId_fkey" FOREIGN KEY ("sourceTaskId", "workspaceId") REFERENCES "AITask"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchDecision" ADD CONSTRAINT "ResearchDecision_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationRelation" ADD CONSTRAINT "InvestigationRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationRelation" ADD CONSTRAINT "InvestigationRelation_fromId_workspaceId_fkey" FOREIGN KEY ("fromId", "workspaceId") REFERENCES "Investigation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationRelation" ADD CONSTRAINT "InvestigationRelation_toId_workspaceId_fkey" FOREIGN KEY ("toId", "workspaceId") REFERENCES "Investigation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_sourceId_workspaceId_fkey" FOREIGN KEY ("sourceId", "workspaceId") REFERENCES "KnowledgeSource"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_engagementId_workspaceId_fkey" FOREIGN KEY ("engagementId", "workspaceId") REFERENCES "Engagement"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_investigationId_workspaceId_fkey" FOREIGN KEY ("investigationId", "workspaceId") REFERENCES "Investigation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRelation" ADD CONSTRAINT "KnowledgeRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRelation" ADD CONSTRAINT "KnowledgeRelation_fromId_workspaceId_fkey" FOREIGN KEY ("fromId", "workspaceId") REFERENCES "KnowledgeDocument"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRelation" ADD CONSTRAINT "KnowledgeRelation_toId_workspaceId_fkey" FOREIGN KEY ("toId", "workspaceId") REFERENCES "KnowledgeDocument"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ADR-028: additive tenancy/parent invariants. These do not rewrite V1 rows.
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_dates_check"
  CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" >= "startsAt");
ALTER TABLE "InvestigationRelation" ADD CONSTRAINT "InvestigationRelation_kind_check"
  CHECK ("fromId" <> "toId" AND "relationship" IN ('RELATED', 'CONTINUES', 'CONTRADICTS', 'DUPLICATE_CANDIDATE'));
ALTER TABLE "KnowledgeRelation" ADD CONSTRAINT "KnowledgeRelation_kind_check"
  CHECK ("fromId" <> "toId" AND "relationship" IN ('SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'SUPERSEDES'));
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_review_check"
  CHECK ("version" > 0 AND ("reviewStatus" <> 'REVIEWED' OR ("reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL)));

CREATE FUNCTION sentinel_v2_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean;
BEGIN
  IF TG_TABLE_NAME = 'EngagementAsset' THEN
    SELECT EXISTS (SELECT 1 FROM "Engagement" e JOIN "Target" t ON t."projectId" = e."projectId"
      WHERE e.id = NEW."engagementId" AND e."workspaceId" = NEW."workspaceId" AND t.id = NEW."targetId") INTO valid;
  ELSIF TG_TABLE_NAME = 'EngagementAuthorization' THEN
    SELECT EXISTS (SELECT 1 FROM "EngagementAsset" a JOIN "ScopeVersion" s ON s."targetId" = a."targetId"
      WHERE a.id = NEW."assetId" AND a."workspaceId" = NEW."workspaceId" AND s.id = NEW."scopeVersionId") INTO valid;
  ELSIF TG_TABLE_NAME = 'Investigation' THEN
    valid := NEW."engagementId" IS NULL OR EXISTS (SELECT 1 FROM "Engagement" e JOIN "EngagementAsset" a ON a."engagementId" = e.id
      WHERE e.id = NEW."engagementId" AND e."projectId" = NEW."projectId" AND e."workspaceId" = NEW."workspaceId" AND a."targetId" = NEW."targetId");
  ELSIF TG_TABLE_NAME = 'ResearchDecision' THEN
    valid := (NEW."findingId" IS NULL OR EXISTS (SELECT 1 FROM "Finding" WHERE id = NEW."findingId" AND "investigationId" = NEW."investigationId"))
      AND (NEW."hypothesisId" IS NULL OR EXISTS (SELECT 1 FROM "Hypothesis" WHERE id = NEW."hypothesisId" AND "investigationId" = NEW."investigationId"))
      AND (NEW."sourceTaskId" IS NULL OR EXISTS (SELECT 1 FROM "AITask" WHERE id = NEW."sourceTaskId" AND "investigationId" = NEW."investigationId"));
  ELSIF TG_TABLE_NAME = 'KnowledgeDocument' THEN
    valid := NEW."investigationId" IS NULL OR NEW."engagementId" IS NULL OR EXISTS
      (SELECT 1 FROM "Investigation" WHERE id = NEW."investigationId" AND "engagementId" = NEW."engagementId");
  ELSE valid := false;
  END IF;
  IF NOT valid THEN RAISE EXCEPTION 'V2 parent relationship mismatch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "v2_asset_parent" BEFORE INSERT OR UPDATE ON "EngagementAsset" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_parent_guard();
CREATE TRIGGER "v2_authorization_parent" BEFORE INSERT OR UPDATE ON "EngagementAuthorization" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_parent_guard();
CREATE TRIGGER "v2_investigation_parent" BEFORE INSERT OR UPDATE OF "engagementId", "projectId", "targetId", "workspaceId" ON "Investigation" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_parent_guard();
CREATE TRIGGER "v2_decision_parent" BEFORE INSERT OR UPDATE ON "ResearchDecision" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_parent_guard();
CREATE TRIGGER "v2_document_parent" BEFORE INSERT OR UPDATE ON "KnowledgeDocument" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_parent_guard();

-- Historical approvals remain valid; new activation requires a validated upload.
CREATE FUNCTION sentinel_upload_validation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."redactionStatus" IN ('REDACTED', 'VERIFIED_SAFE') AND NEW."uploadValidatedAt" IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD."redactionStatus" NOT IN ('REDACTED', 'VERIFIED_SAFE')
      OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey" THEN
      RAISE EXCEPTION 'Upload must be validated before activation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "v2_upload_validation" BEFORE INSERT OR UPDATE ON "Evidence" FOR EACH ROW EXECUTE FUNCTION sentinel_upload_validation_guard();
