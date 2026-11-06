-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('PERSONAL', 'TEAM');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'RESEARCHER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "PreferredMode" AS ENUM ('GUIDED', 'DELEGATED', 'BOTH');

-- CreateEnum
CREATE TYPE "ResearchInterest" AS ENUM ('WEB_APPLICATION_SECURITY', 'BUG_BOUNTY_RESEARCH', 'PENETRATION_TESTING', 'API_SECURITY', 'SECURITY_EDUCATION');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('LEARNING_LAB', 'BUG_BOUNTY', 'AUTHORIZED_ASSESSMENT', 'INTERNAL_RESEARCH');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('DOMAIN', 'APPLICATION', 'API', 'IP_ASSET', 'LOCAL_LAB', 'OTHER');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('PRACTICE_LAB', 'BUG_BOUNTY_PROGRAM', 'AUTHORIZED_ASSESSMENT', 'INTERNAL_ENVIRONMENT');

-- CreateEnum
CREATE TYPE "TargetAuthorizationStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'EXPIRED', 'REVOKED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ScopeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ScopeAssetMatchType" AS ENUM ('EXACT', 'DOMAIN', 'SUBDOMAIN', 'CIDR', 'URL_PREFIX');

-- CreateEnum
CREATE TYPE "ScopeAssetEffect" AS ENUM ('ALLOWED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "ScopeActivityEffect" AS ENUM ('PERMITTED', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('READ_PROJECT_CONTEXT', 'READ_INVESTIGATION_CONTEXT', 'AI_ANALYZE_SUPPLIED_CONTENT', 'AI_ANALYZE_TARGET_CONTEXT', 'EXPORT_REPORT', 'MODIFY_SCOPE', 'PASSIVE_FETCH', 'ACTIVE_TEST', 'BROWSE_WEB', 'EXECUTE_COMMAND', 'SUBMIT_EXTERNAL_REPORT');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'UNDER_REVIEW', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('APPLICATION_BEHAVIOUR', 'ROUTE_INFORMATION', 'HTTP_METADATA', 'USER_NOTE', 'AI_OBSERVATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfidenceLabel" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "HypothesisStatus" AS ENUM ('IDEA', 'OBSERVED', 'NEEDS_VALIDATION', 'CONFIRMED', 'NOT_REPRODUCIBLE', 'REJECTED');

-- CreateEnum
CREATE TYPE "HypothesisObservationRelationship" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'CONTEXT');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('DRAFT', 'NEEDS_VALIDATION', 'UNDER_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'REJECTED', 'REPORTABLE', 'CLOSED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNASSESSED');

-- CreateEnum
CREATE TYPE "ResolutionReason" AS ENUM ('DUPLICATE', 'OUT_OF_SCOPE', 'INSUFFICIENT_EVIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SCREENSHOT', 'HTTP_REQUEST', 'HTTP_RESPONSE', 'TEXT_OBSERVATION', 'DOCUMENT', 'LOG', 'EXTERNAL_REFERENCE', 'REPRODUCTION_NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceLinkRelationship" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'REPRODUCTION');

-- CreateEnum
CREATE TYPE "RedactionStatus" AS ENUM ('NOT_REVIEWED', 'QUARANTINED', 'REDACTED', 'VERIFIED_SAFE');

-- CreateEnum
CREATE TYPE "RedactionMethod" AS ENUM ('NONE', 'CLIENT_MASK', 'HUMAN_REVIEW');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('ANTHROPIC');

-- CreateEnum
CREATE TYPE "AIConversationMode" AS ENUM ('GUIDED', 'DELEGATED');

-- CreateEnum
CREATE TYPE "AIConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "AITaskType" AS ENUM ('RECON_ANALYSIS', 'ATTACK_SURFACE_ANALYSIS', 'HYPOTHESIS_GENERATION', 'EVIDENCE_REVIEW', 'FALSE_POSITIVE_REVIEW', 'FINDING_SUMMARY', 'REPORT_GENERATION', 'SESSION_SUMMARY');

-- CreateEnum
CREATE TYPE "AITaskStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "AITaskEventType" AS ENUM ('TASK_CREATED', 'PERMISSION_CHECK', 'CONTEXT_ASSEMBLY', 'TASK_ASSIGNMENT', 'AI_PROCESSING', 'OUTPUT_VALIDATION', 'RESULT_STORAGE', 'HUMAN_REVIEW', 'TASK_COMPLETED', 'TASK_FAILED', 'TASK_CANCELLED', 'TASK_TIMED_OUT');

-- CreateEnum
CREATE TYPE "ReviewerType" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "VerificationConclusion" AS ENUM ('NEEDS_MORE_EVIDENCE', 'NOT_REPRODUCIBLE', 'FALSE_POSITIVE', 'REVIEW_SUPPORTS_CONFIRMATION', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SummaryAuthorType" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'EXPORTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('MARKDOWN', 'PDF');

-- CreateEnum
CREATE TYPE "ReportGenerationSource" AS ENUM ('HUMAN', 'AI_ASSISTED');

-- CreateEnum
CREATE TYPE "ReportTemplateScope" AS ENUM ('SYSTEM', 'WORKSPACE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "authProviderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'BEGINNER',
    "preferredMode" "PreferredMode" NOT NULL DEFAULT 'GUIDED',
    "researchInterests" "ResearchInterest"[] DEFAULT ARRAY[]::"ResearchInterest"[],
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "WorkspaceKind" NOT NULL DEFAULT 'PERSONAL',
    "ownerId" UUID NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'RESEARCHER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "projectType" "ProjectType" NOT NULL DEFAULT 'LEARNING_LAB',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assetIdentifier" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "environmentType" "EnvironmentType" NOT NULL,
    "programName" TEXT,
    "programUrl" TEXT,
    "authorizationStatus" "TargetAuthorizationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "authorizationSource" TEXT,
    "authorizationDate" TIMESTAMP(3),
    "authorizationExpiresAt" TIMESTAMP(3),
    "authorizationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeVersion" (
    "id" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ScopeStatus" NOT NULL DEFAULT 'DRAFT',
    "attestationNotes" TEXT,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeAsset" (
    "id" UUID NOT NULL,
    "scopeVersionId" UUID NOT NULL,
    "assetIdentifier" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "matchType" "ScopeAssetMatchType" NOT NULL DEFAULT 'EXACT',
    "effect" "ScopeAssetEffect" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeActivityRule" (
    "id" UUID NOT NULL,
    "scopeVersionId" UUID NOT NULL,
    "activity" "Capability" NOT NULL,
    "effect" "ScopeActivityEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeActivityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationArtifact" (
    "id" UUID NOT NULL,
    "scopeVersionId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "category" TEXT,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationObservation" (
    "id" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "observationType" "ObservationType" NOT NULL,
    "source" TEXT,
    "confidenceLabel" "ConfidenceLabel" NOT NULL DEFAULT 'UNKNOWN',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hypothesis" (
    "id" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vulnerabilityCategory" TEXT,
    "missingInformation" TEXT,
    "status" "HypothesisStatus" NOT NULL DEFAULT 'IDEA',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HypothesisObservation" (
    "id" UUID NOT NULL,
    "hypothesisId" UUID NOT NULL,
    "observationId" UUID NOT NULL,
    "relationshipType" "HypothesisObservationRelationship" NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypothesisObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "hypothesisId" UUID,
    "title" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vulnerabilityCategory" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'UNASSESSED',
    "severityRationale" TEXT,
    "severityAssessedBy" UUID,
    "severityAssessedAt" TIMESTAMP(3),
    "affectedAsset" TEXT,
    "affectedAssetType" "AssetType",
    "status" "FindingStatus" NOT NULL DEFAULT 'DRAFT',
    "resolutionReason" "ResolutionReason",
    "impact" TEXT,
    "remediation" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "duplicateOfId" UUID,
    "duplicateConfirmedBy" UUID,
    "duplicateConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageKey" TEXT,
    "quarantineKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "source" TEXT,
    "redactionStatus" "RedactionStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "redactionMethod" "RedactionMethod" NOT NULL DEFAULT 'NONE',
    "scanFindings" JSONB,
    "uploadedBy" UUID NOT NULL,
    "redactionReviewedBy" UUID,
    "redactionReviewedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "relationshipType" "EvidenceLinkRelationship" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProviderConfig" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "displayName" TEXT,
    "encryptedCredentialReference" TEXT,
    "defaultModel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "AIConversationMode" NOT NULL DEFAULT 'GUIDED',
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AIConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredContent" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITask" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "conversationId" UUID,
    "taskType" "AITaskType" NOT NULL,
    "status" "AITaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedRole" TEXT,
    "inputContext" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "failureCode" TEXT,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "promptTemplateId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "contextVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requiredCapabilities" "Capability"[] DEFAULT ARRAY[]::"Capability"[],
    "inputTokenBudget" INTEGER NOT NULL,
    "outputTokenBudget" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "correlationId" TEXT,
    "requestedBy" UUID NOT NULL,
    "parentTaskId" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AITask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITaskEvent" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "eventType" "AITaskEventType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationReview" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "taskId" UUID,
    "reviewerType" "ReviewerType" NOT NULL,
    "reviewerUserId" UUID,
    "conclusion" "VerificationConclusion" NOT NULL,
    "supportingEvidence" JSONB,
    "contradictingEvidence" JSONB,
    "missingEvidence" JSONB,
    "impactAssessment" TEXT,
    "reasoningSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSummary" (
    "id" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "completedWork" JSONB,
    "rejectedHypotheses" JSONB,
    "unresolvedQuestions" JSONB,
    "nextActions" JSONB,
    "generatedByType" "SummaryAuthorType" NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "sourceTaskId" UUID,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "investigationId" UUID NOT NULL,
    "templateId" UUID,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "format" "ReportFormat" NOT NULL DEFAULT 'MARKDOWN',
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFinding" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ReportFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scope" "ReportTemplateScope" NOT NULL DEFAULT 'WORKSPACE',
    "sectionSchema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRevision" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "findingSnapshot" JSONB NOT NULL,
    "generatedByType" "ReportGenerationSource" NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authProviderId_key" ON "User"("authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_status_idx" ON "Project"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Target_projectId_idx" ON "Target"("projectId");

-- CreateIndex
CREATE INDEX "Target_authorizationStatus_idx" ON "Target"("authorizationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Target_projectId_assetIdentifier_key" ON "Target"("projectId", "assetIdentifier");

-- CreateIndex
CREATE INDEX "ScopeVersion_targetId_status_idx" ON "ScopeVersion"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeVersion_targetId_version_key" ON "ScopeVersion"("targetId", "version");

-- CreateIndex
CREATE INDEX "ScopeAsset_scopeVersionId_idx" ON "ScopeAsset"("scopeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeAsset_scopeVersionId_assetIdentifier_matchType_key" ON "ScopeAsset"("scopeVersionId", "assetIdentifier", "matchType");

-- CreateIndex
CREATE INDEX "ScopeActivityRule_scopeVersionId_idx" ON "ScopeActivityRule"("scopeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeActivityRule_scopeVersionId_activity_key" ON "ScopeActivityRule"("scopeVersionId", "activity");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationArtifact_storageKey_key" ON "AuthorizationArtifact"("storageKey");

-- CreateIndex
CREATE INDEX "AuthorizationArtifact_scopeVersionId_idx" ON "AuthorizationArtifact"("scopeVersionId");

-- CreateIndex
CREATE INDEX "Investigation_workspaceId_status_idx" ON "Investigation"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Investigation_projectId_status_idx" ON "Investigation"("projectId", "status");

-- CreateIndex
CREATE INDEX "Investigation_targetId_idx" ON "Investigation"("targetId");

-- CreateIndex
CREATE INDEX "InvestigationObservation_investigationId_createdAt_idx" ON "InvestigationObservation"("investigationId", "createdAt");

-- CreateIndex
CREATE INDEX "Hypothesis_investigationId_status_idx" ON "Hypothesis"("investigationId", "status");

-- CreateIndex
CREATE INDEX "HypothesisObservation_observationId_idx" ON "HypothesisObservation"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "HypothesisObservation_hypothesisId_observationId_key" ON "HypothesisObservation"("hypothesisId", "observationId");

-- CreateIndex
CREATE INDEX "Finding_workspaceId_status_idx" ON "Finding"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Finding_investigationId_status_idx" ON "Finding"("investigationId", "status");

-- CreateIndex
CREATE INDEX "Finding_investigationId_vulnerabilityCategory_idx" ON "Finding"("investigationId", "vulnerabilityCategory");

-- CreateIndex
CREATE INDEX "Finding_duplicateOfId_idx" ON "Finding"("duplicateOfId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_storageKey_key" ON "Evidence"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_quarantineKey_key" ON "Evidence"("quarantineKey");

-- CreateIndex
CREATE INDEX "Evidence_investigationId_idx" ON "Evidence"("investigationId");

-- CreateIndex
CREATE INDEX "Evidence_workspaceId_redactionStatus_idx" ON "Evidence"("workspaceId", "redactionStatus");

-- CreateIndex
CREATE INDEX "Evidence_supersedesId_idx" ON "Evidence"("supersedesId");

-- CreateIndex
CREATE INDEX "EvidenceLink_findingId_idx" ON "EvidenceLink"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_evidenceId_findingId_relationshipType_key" ON "EvidenceLink"("evidenceId", "findingId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "AIProviderConfig_userId_provider_key" ON "AIProviderConfig"("userId", "provider");

-- CreateIndex
CREATE INDEX "AIConversation_investigationId_idx" ON "AIConversation"("investigationId");

-- CreateIndex
CREATE INDEX "AIConversation_workspaceId_idx" ON "AIConversation"("workspaceId");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AITask_workspaceId_status_idx" ON "AITask"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AITask_investigationId_status_idx" ON "AITask"("investigationId", "status");

-- CreateIndex
CREATE INDEX "AITask_conversationId_idx" ON "AITask"("conversationId");

-- CreateIndex
CREATE INDEX "AITask_correlationId_idx" ON "AITask"("correlationId");

-- CreateIndex
CREATE INDEX "AITask_parentTaskId_idx" ON "AITask"("parentTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "AITask_workspaceId_idempotencyKey_key" ON "AITask"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AITaskEvent_taskId_createdAt_idx" ON "AITaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationReview_findingId_idx" ON "VerificationReview"("findingId");

-- CreateIndex
CREATE INDEX "VerificationReview_taskId_idx" ON "VerificationReview"("taskId");

-- CreateIndex
CREATE INDEX "SessionSummary_investigationId_createdAt_idx" ON "SessionSummary"("investigationId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_workspaceId_status_idx" ON "Report"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Report_investigationId_status_idx" ON "Report"("investigationId", "status");

-- CreateIndex
CREATE INDEX "ReportFinding_findingId_idx" ON "ReportFinding"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportFinding_reportId_findingId_key" ON "ReportFinding"("reportId", "findingId");

-- CreateIndex
CREATE INDEX "ReportTemplate_name_version_idx" ON "ReportTemplate"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_workspaceId_name_version_key" ON "ReportTemplate"("workspaceId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRevision_reportId_version_key" ON "ReportRevision"("reportId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeVersion" ADD CONSTRAINT "ScopeVersion_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeVersion" ADD CONSTRAINT "ScopeVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeVersion" ADD CONSTRAINT "ScopeVersion_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeAsset" ADD CONSTRAINT "ScopeAsset_scopeVersionId_fkey" FOREIGN KEY ("scopeVersionId") REFERENCES "ScopeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeActivityRule" ADD CONSTRAINT "ScopeActivityRule_scopeVersionId_fkey" FOREIGN KEY ("scopeVersionId") REFERENCES "ScopeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationArtifact" ADD CONSTRAINT "AuthorizationArtifact_scopeVersionId_fkey" FOREIGN KEY ("scopeVersionId") REFERENCES "ScopeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationArtifact" ADD CONSTRAINT "AuthorizationArtifact_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationObservation" ADD CONSTRAINT "InvestigationObservation_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationObservation" ADD CONSTRAINT "InvestigationObservation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HypothesisObservation" ADD CONSTRAINT "HypothesisObservation_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HypothesisObservation" ADD CONSTRAINT "HypothesisObservation_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "InvestigationObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HypothesisObservation" ADD CONSTRAINT "HypothesisObservation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_severityAssessedBy_fkey" FOREIGN KEY ("severityAssessedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_duplicateConfirmedBy_fkey" FOREIGN KEY ("duplicateConfirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_redactionReviewedBy_fkey" FOREIGN KEY ("redactionReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProviderConfig" ADD CONSTRAINT "AIProviderConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "AITask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITaskEvent" ADD CONSTRAINT "AITaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AITask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReview" ADD CONSTRAINT "VerificationReview_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReview" ADD CONSTRAINT "VerificationReview_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AITask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReview" ADD CONSTRAINT "VerificationReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSummary" ADD CONSTRAINT "SessionSummary_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSummary" ADD CONSTRAINT "SessionSummary_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "AITask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSummary" ADD CONSTRAINT "SessionSummary_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFinding" ADD CONSTRAINT "ReportFinding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFinding" ADD CONSTRAINT "ReportFinding_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints that Prisma cannot express in the schema.
-- Every rule below is traceable to an accepted ADR in docs/DECISIONS.md.
-- ---------------------------------------------------------------------------

-- ADR-014: exactly one PERSONAL workspace per owner. TEAM workspaces may share an owner.
CREATE UNIQUE INDEX "Workspace_personal_owner_key" ON "Workspace" ("ownerId") WHERE "kind" = 'PERSONAL';

-- ADR-017: at most one ACTIVE scope version per target. Superseded and expired
-- versions remain stored; they are status-managed, never deleted.
CREATE UNIQUE INDEX "ScopeVersion_active_target_key" ON "ScopeVersion" ("targetId") WHERE "status" = 'ACTIVE';

-- ADR-017: an ACTIVE scope must carry a complete self-attestation window.
ALTER TABLE "ScopeVersion" ADD CONSTRAINT "ScopeVersion_active_attestation_check" CHECK (
  "status" <> 'ACTIVE' OR (
    "approvedBy" IS NOT NULL
    AND "approvedAt" IS NOT NULL
    AND "effectiveFrom" IS NOT NULL
    AND "effectiveUntil" IS NOT NULL
    AND "effectiveFrom" < "effectiveUntil"
  )
);

-- ADR-017: the materialised AUTHORIZED status always has an expiry to compare
-- against the clock. The action-time validator remains authoritative.
ALTER TABLE "Target" ADD CONSTRAINT "Target_authorized_expiry_check" CHECK (
  "authorizationStatus" <> 'AUTHORIZED' OR "authorizationExpiresAt" IS NOT NULL
);

-- ADR-015: a REJECTED finding records why it was rejected.
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_rejected_resolution_check" CHECK (
  "status" <> 'REJECTED' OR "resolutionReason" IS NOT NULL
);

-- ADR-016: confirmation requires a severity assessment and an affected asset.
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_confirmed_readiness_check" CHECK (
  "status" NOT IN ('CONFIRMED', 'REPORTABLE') OR (
    "severity" <> 'UNASSESSED'
    AND "severityRationale" IS NOT NULL
    AND "affectedAsset" IS NOT NULL
    AND "affectedAssetType" IS NOT NULL
  )
);

-- ADR-016: reportability additionally requires impact and remediation.
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reportable_readiness_check" CHECK (
  "status" <> 'REPORTABLE' OR ("impact" IS NOT NULL AND "remediation" IS NOT NULL)
);

-- ADR-015: a finding cannot duplicate itself, and a confirmed duplicate
-- records the human who confirmed it and when.
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_duplicate_self_check" CHECK (
  "duplicateOfId" IS NULL OR "duplicateOfId" <> "id"
);
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_duplicate_confirmation_check" CHECK (
  "duplicateOfId" IS NULL OR (
    "duplicateConfirmedBy" IS NOT NULL AND "duplicateConfirmedAt" IS NOT NULL
  )
);

-- ADR-005: AI reviewers may not confirm or reject; human reviewers must be
-- identified and may not carry the AI-only "supports confirmation" conclusion.
ALTER TABLE "VerificationReview" ADD CONSTRAINT "VerificationReview_actor_conclusion_check" CHECK (
  (
    "reviewerType" = 'AI'
    AND "taskId" IS NOT NULL
    AND "reviewerUserId" IS NULL
    AND "conclusion" IN (
      'NEEDS_MORE_EVIDENCE',
      'NOT_REPRODUCIBLE',
      'FALSE_POSITIVE',
      'REVIEW_SUPPORTS_CONFIRMATION'
    )
  )
  OR (
    "reviewerType" = 'HUMAN'
    AND "reviewerUserId" IS NOT NULL
    AND "conclusion" IN (
      'NEEDS_MORE_EVIDENCE',
      'NOT_REPRODUCIBLE',
      'FALSE_POSITIVE',
      'CONFIRMED',
      'REJECTED'
    )
  )
);

-- ADR-004: an evidence version never supersedes itself.
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_supersedes_self_check" CHECK (
  "supersedesId" IS NULL OR "supersedesId" <> "id"
);

-- ADR-012: budgets and recorded usage cannot be negative; a retry never
-- points at itself.
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_budget_nonnegative_check" CHECK (
  "inputTokenBudget" >= 0
  AND "outputTokenBudget" >= 0
  AND "inputTokens" >= 0
  AND "outputTokens" >= 0
  AND "estimatedCostUsd" >= 0
);
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_parent_self_check" CHECK (
  "parentTaskId" IS NULL OR "parentTaskId" <> "id"
);

-- ADR-015: advisory duplicate detection uses trigram similarity over the
-- normalised title. The category index already exists on Finding.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Finding_titleNormalized_trgm_idx" ON "Finding" USING GIN ("titleNormalized" gin_trgm_ops);
