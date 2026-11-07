-- AlterEnum
ALTER TYPE "AITaskType" ADD VALUE 'PATTERN_ANALYSIS';

-- AlterTable
ALTER TABLE "VerificationReview" ADD COLUMN     "basis" JSONB;

-- CreateTable
CREATE TABLE "EvidenceResearchLink" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "observationId" UUID,
    "hypothesisId" UUID,
    "subjectKey" TEXT NOT NULL,
    "relationship" "EvidenceLinkRelationship" NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceResearchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAssessment" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "sourceTaskId" UUID,
    "assessorType" "ReviewerType" NOT NULL,
    "assessorId" UUID,
    "reviewStatus" "KnowledgeReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "assessment" JSONB NOT NULL,
    "basis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceResearchLink_workspaceId_idx" ON "EvidenceResearchLink"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceResearchLink_evidenceId_subjectKey_relationship_key" ON "EvidenceResearchLink"("evidenceId", "subjectKey", "relationship");

-- CreateIndex
CREATE INDEX "EvidenceAssessment_workspaceId_evidenceId_idx" ON "EvidenceAssessment"("workspaceId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAssessment_sourceTaskId_evidenceId_key" ON "EvidenceAssessment"("sourceTaskId", "evidenceId");

-- AddForeignKey
ALTER TABLE "EvidenceResearchLink" ADD CONSTRAINT "EvidenceResearchLink_evidenceId_workspaceId_fkey" FOREIGN KEY ("evidenceId", "workspaceId") REFERENCES "Evidence"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAssessment" ADD CONSTRAINT "EvidenceAssessment_evidenceId_workspaceId_fkey" FOREIGN KEY ("evidenceId", "workspaceId") REFERENCES "Evidence"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evidence relationships retain source identity and cannot cross investigations.
ALTER TABLE "EvidenceResearchLink" ADD CONSTRAINT "EvidenceResearchLink_subject_check" CHECK (("observationId" IS NULL) <> ("hypothesisId" IS NULL));
ALTER TABLE "EvidenceResearchLink" ADD CONSTRAINT "EvidenceResearchLink_observation_fkey" FOREIGN KEY ("observationId") REFERENCES "InvestigationObservation"(id) ON DELETE RESTRICT;
ALTER TABLE "EvidenceResearchLink" ADD CONSTRAINT "EvidenceResearchLink_hypothesis_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"(id) ON DELETE RESTRICT;
ALTER TABLE "EvidenceAssessment" ADD CONSTRAINT "EvidenceAssessment_task_fkey" FOREIGN KEY ("sourceTaskId", "workspaceId") REFERENCES "AITask"(id,"workspaceId") ON DELETE RESTRICT;
ALTER TABLE "EvidenceAssessment" ADD CONSTRAINT "EvidenceAssessment_review_check" CHECK ("reviewStatus" <> 'REVIEWED' OR ("reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL));
CREATE FUNCTION sentinel_evidence_research_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "Evidence" e WHERE e.id=NEW."evidenceId" AND ((NEW."observationId" IS NOT NULL AND EXISTS (SELECT 1 FROM "InvestigationObservation" o WHERE o.id=NEW."observationId" AND o."investigationId"=e."investigationId")) OR (NEW."hypothesisId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Hypothesis" h WHERE h.id=NEW."hypothesisId" AND h."investigationId"=e."investigationId")))) THEN
 RAISE EXCEPTION 'Evidence research subject mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER v2_evidence_research_link BEFORE INSERT OR UPDATE ON "EvidenceResearchLink" FOR EACH ROW EXECUTE FUNCTION sentinel_evidence_research_link_guard();
