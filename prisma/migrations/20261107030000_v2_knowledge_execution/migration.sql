-- AlterTable
ALTER TABLE "AITask" ADD COLUMN     "executionJobId" UUID,
ADD COLUMN     "executorToken" TEXT;

-- AlterTable
ALTER TABLE "AIExecutionAttempt" ADD COLUMN     "response" JSONB;

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "processingVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalRecord" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "engagementId" UUID,
    "investigationId" UUID,
    "query" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "strategy" TEXT NOT NULL,
    "requestedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeChunk_workspaceId_documentId_idx" ON "KnowledgeChunk"("workspaceId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_documentVersion_sequence_key" ON "KnowledgeChunk"("documentId", "documentVersion", "sequence");

-- CreateIndex
CREATE INDEX "RetrievalRecord_workspaceId_investigationId_createdAt_idx" ON "RetrievalRecord"("workspaceId", "investigationId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_workspaceId_fkey" FOREIGN KEY ("documentId", "workspaceId") REFERENCES "KnowledgeDocument"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ADR-029: exact-filtered full-text search is usable without vector extensions.
CREATE INDEX "KnowledgeChunk_content_fts_idx" ON "KnowledgeChunk" USING GIN (to_tsvector('english', content));
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_offsets_check" CHECK ("startOffset" >= 0 AND "endOffset" > "startOffset" AND "documentVersion" > 0 AND sequence >= 0);
ALTER TABLE "RetrievalRecord" ADD CONSTRAINT "RetrievalRecord_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE RESTRICT;
ALTER TABLE "RetrievalRecord" ADD CONSTRAINT "RetrievalRecord_user_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"(id) ON DELETE RESTRICT;
