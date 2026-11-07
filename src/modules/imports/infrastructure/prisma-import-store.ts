import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { canonicalJson } from "@/modules/shared/domain/json";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  requireResearchMember,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import type { JobRow } from "@/modules/tasks/domain/job";
import type { ImportStore } from "../application/import-service";
import {
  IMPORT_MAX_BYTES,
  IMPORT_PARSER_VERSION,
  canonicalResultSchema,
  duplicateSignals,
  parseToolImport,
  type ImportRequest,
  type ImportReview,
} from "../domain/tool-import";
import { assetMatchesRule } from "@/modules/research/domain/scope-validator";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export class PrismaImportStore implements ImportStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  list(workspaceId: string) {
    return this.db.toolImport.findMany({
      where: { workspaceId },
      select: {
        id: true,
        fileName: true,
        format: true,
        sourceTool: true,
        status: true,
        createdAt: true,
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  find(workspaceId: string, id: string) {
    return this.db.toolImport.findFirst({
      where: { id, workspaceId },
      include: {
        records: { orderBy: { recordIndex: "asc" }, take: 1000 },
        engagement: {
          select: {
            name: true,
            assets: {
              select: { id: true, target: { select: { name: true, assetIdentifier: true } } },
            },
            investigations: { select: { id: true, title: true } },
          },
        },
      },
    });
  }
  create(actor: ResearchActor, input: ImportRequest) {
    if (Buffer.byteLength(input.rawContent, "utf8") > IMPORT_MAX_BYTES)
      throw new ResearchOperationError("IMPORT_TOO_LARGE", "The import exceeds 500 KB.");
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Workspace" WHERE id = ${actor.workspaceId}::uuid FOR UPDATE`,
      );
      const engagement = await tx.engagement.findFirst({
        where: { id: input.engagementId, workspaceId: actor.workspaceId },
        select: { status: true, project: { select: { status: true } } },
      });
      if (
        !engagement ||
        engagement.status === "ARCHIVED" ||
        engagement.project.status === "ARCHIVED"
      )
        throw new ResearchOperationError(
          "INVALID_ASSOCIATION",
          "Choose an active engagement in this workspace.",
        );
      const old = await tx.toolImport.findUnique({
        where: {
          workspaceId_operationKey: {
            workspaceId: actor.workspaceId,
            operationKey: input.operationKey,
          },
        },
      });
      const checksum = hash(input.rawContent);
      if (old) {
        if (
          old.createdBy !== actor.userId ||
          old.checksum !== checksum ||
          old.engagementId !== input.engagementId ||
          old.sourceTool !== input.sourceTool ||
          old.fileName !== input.fileName ||
          old.format !== input.format ||
          canonicalJson(old.fieldMapping) !== canonicalJson(input.fieldMapping)
        )
          throw new ResearchOperationError(
            "CONFLICT",
            "This import request identifier belongs to different content.",
          );
        return { id: old.id };
      }
      const row = await tx.toolImport.create({
        data: {
          ...input,
          workspaceId: actor.workspaceId,
          createdBy: actor.userId,
          checksum,
          fieldMapping: json(input.fieldMapping),
          parserVersion: IMPORT_PARSER_VERSION,
          mappingVersion: "explicit-fields-v1",
        },
        select: { id: true },
      });
      await new PrismaJobStore(tx).enqueue(actor, "TOOL_IMPORT", `import:${row.id}`, {
        importId: row.id,
      });
      await researchAudit(tx, actor, "ToolImport", row.id, "TOOL_IMPORT_REQUESTED", {
        checksum,
        format: input.format,
      });
      return row;
    });
  }
  review(actor: ResearchActor, input: ImportReview) {
    return this.db.$transaction(async (tx) => {
      await requireResearchMember(tx, actor);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "ImportedResult" WHERE id = ${input.recordId}::uuid AND "workspaceId" = ${actor.workspaceId}::uuid FOR UPDATE`,
      );
      const record = await tx.importedResult.findFirst({
        where: { id: input.recordId, workspaceId: actor.workspaceId },
        include: { import: true },
      });
      if (!record)
        throw new ResearchOperationError("NOT_FOUND", "The supplied result is unavailable.");
      if (record.status !== "PENDING") {
        if (
          record.reviewedBy === actor.userId &&
          record.reviewRationale === input.rationale &&
          ((input.action === "REJECT" && record.status === "REJECTED") ||
            (input.action === "ADOPT_FINDING" && record.adoptedFindingId) ||
            (input.action === "ADOPT_OBSERVATION" && record.adoptedObservationId))
        )
          return { id: record.adoptedFindingId ?? record.adoptedObservationId ?? record.id };
        throw new ResearchOperationError("CONFLICT", "This result has already been reviewed.");
      }
      let adoptedId = record.id;
      if (input.action !== "REJECT") {
        const investigation = await lockResearchInvestigation(tx, actor, input.investigationId!);
        const asset = await tx.engagementAsset.findFirst({
          where: {
            id: input.assetId,
            workspaceId: actor.workspaceId,
            engagementId: record.import.engagementId,
            targetId: investigation.targetId,
          },
          include: { target: { select: { assetIdentifier: true } } },
        });
        if (!asset || investigation.engagementId !== record.import.engagementId)
          throw new ResearchOperationError(
            "INVALID_ASSOCIATION",
            "Map this supplied result to the matching engagement asset and investigation.",
          );
        const scopes = await tx.scopeVersion.findMany({
          where: { targetId: asset.targetId, status: "ACTIVE" },
          include: { assets: true },
        });
        const canonical = canonicalResultSchema.parse(record.canonical);
        if (
          scopes.some((s) =>
            s.assets.some(
              (a) =>
                a.effect === "EXCLUDED" &&
                [asset.target.assetIdentifier, canonical.assetReference].some(
                  (reference) =>
                    reference && assetMatchesRule(reference, a.assetIdentifier, a.matchType),
                ),
            ),
          )
        )
          throw new ResearchOperationError(
            "ASSET_EXCLUDED",
            "The mapped asset is explicitly excluded from current scope.",
          );
        const source = `Supplied ${canonical.sourceTool} result; import ${record.importId}, record ${record.recordIndex}, original SHA-256 ${record.import.checksum}. Human-adopted interpretation; validation required.`;
        if (input.action === "ADOPT_OBSERVATION") {
          const row = await tx.investigationObservation.create({
            data: {
              investigationId: investigation.id,
              title: canonical.title,
              description: canonical.description ?? canonical.title,
              observationType: "OTHER",
              confidenceLabel: "UNKNOWN",
              source,
              createdBy: actor.userId,
            },
          });
          adoptedId = row.id;
        } else {
          const row = await tx.finding.create({
            data: {
              workspaceId: actor.workspaceId,
              investigationId: investigation.id,
              title: canonical.title,
              titleNormalized: canonical.title.toLowerCase().trim(),
              description: `${canonical.description ?? canonical.title}\n\n${source}`,
              vulnerabilityCategory: canonical.classification,
              affectedAsset: asset.target.assetIdentifier,
              status: "DRAFT",
              severity: "UNASSESSED",
              createdBy: actor.userId,
            },
          });
          adoptedId = row.id;
        }
        await tx.researchDecision.create({
          data: {
            workspaceId: actor.workspaceId,
            investigationId: investigation.id,
            findingId: input.action === "ADOPT_FINDING" ? adoptedId : null,
            kind: "RESEARCH_NOTE",
            rationale: input.rationale,
            sourceRefs: [{ kind: "IMPORTED_RESULT", id: record.id, relationship: "CONTEXT" }],
            legacySourceId: `import-adoption:${record.id}`,
            createdBy: actor.userId,
          },
        });
      }
      await tx.importedResult.update({
        where: { id: record.id },
        data: {
          status: input.action === "REJECT" ? "REJECTED" : "ADOPTED",
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          reviewRationale: input.rationale,
          investigationId: input.action === "REJECT" ? null : input.investigationId,
          assetId: input.action === "REJECT" ? null : input.assetId,
          adoptedFindingId: input.action === "ADOPT_FINDING" ? adoptedId : null,
          adoptedObservationId: input.action === "ADOPT_OBSERVATION" ? adoptedId : null,
        },
      });
      await researchAudit(tx, actor, "ImportedResult", record.id, "IMPORTED_RESULT_REVIEWED", {
        action: input.action,
        adoptedId,
      });
      return { id: adoptedId };
    });
  }
}

async function fence(tx: Prisma.TransactionClient, job: JobRow) {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "BackgroundJob" WHERE id = ${job.id}::uuid FOR UPDATE`,
  );
  if (
    !(await tx.backgroundJob.findFirst({
      where: {
        id: job.id,
        workspaceId: job.workspaceId,
        status: "RUNNING",
        leaseToken: job.leaseToken,
        leaseUntil: { gt: new Date() },
        cancelRequestedAt: null,
      },
    }))
  )
    throw new ResearchOperationError(
      "JOB_CANCELLED",
      "The import was cancelled or its worker lease expired.",
    );
}
export async function processToolImport(
  db: Prisma.TransactionClient,
  actor: ResearchActor,
  importId: string,
  job: JobRow,
) {
  const original = await db.toolImport.findFirst({
    where: { id: importId, workspaceId: actor.workspaceId },
  });
  if (!original)
    throw new ResearchOperationError("NOT_FOUND", "The supplied import is unavailable.");
  let parsed: ReturnType<typeof parseToolImport>;
  try {
    parsed = parseToolImport({
      rawContent: original.rawContent,
      format: original.format as ImportRequest["format"],
      sourceTool: original.sourceTool,
      fieldMapping: original.fieldMapping as ImportRequest["fieldMapping"],
    });
  } catch (error) {
    await db.$transaction(async (tx) => {
      await fence(tx, job);
      await tx.toolImport.update({
        where: { id: importId },
        data: {
          status: "FAILED",
          failureCode: error instanceof ResearchOperationError ? error.code : "IMPORT_INVALID",
        },
      });
    });
    throw error;
  }
  return db.$transaction(
    async (tx) => {
      await fence(tx, job);
      await requireResearchMember(tx, actor);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "ToolImport" WHERE id = ${importId}::uuid FOR UPDATE`,
      );
      if (await tx.importedResult.count({ where: { importId } }))
        return { importId, records: parsed.length };
      const engagement = await tx.engagement.findFirst({
        where: {
          id: original.engagementId,
          workspaceId: actor.workspaceId,
          status: { not: "ARCHIVED" },
          project: { status: { not: "ARCHIVED" } },
        },
      });
      if (!engagement) throw new ResearchOperationError("ARCHIVED", "The engagement is archived.");
      const prior = await tx.importedResult.findMany({
        where: { workspaceId: actor.workspaceId, import: { engagementId: original.engagementId } },
        orderBy: { createdAt: "desc" },
        take: 2000,
        select: { id: true, canonical: true },
      });
      const candidates = prior.flatMap((p) => {
        const v = canonicalResultSchema.safeParse(p.canonical);
        return v.success ? [{ id: p.id, canonical: v.data }] : [];
      });
      for (const [recordIndex, record] of parsed.entries()) {
        const duplicates = candidates
          .flatMap((p) => {
            const reasons = duplicateSignals(record.canonical, p.canonical);
            return reasons.length ? [{ id: p.id, reasons }] : [];
          })
          .slice(0, 30);
        const saved = await tx.importedResult.create({
          data: {
            workspaceId: actor.workspaceId,
            importId,
            recordIndex,
            sourceRecordId: record.canonical.sourceRecordId,
            canonical: json(record.canonical),
            rawRecord: json(record.rawRecord),
            fingerprint: hash(canonicalJson(record.canonical)),
            duplicateCandidates: json(duplicates),
          },
        });
        candidates.push({ id: saved.id, canonical: record.canonical });
      }
      await tx.toolImport.update({
        where: { id: importId },
        data: { status: "READY", failureCode: null },
      });
      await researchAudit(tx, actor, "ToolImport", importId, "TOOL_IMPORT_PROCESSED", {
        records: parsed.length,
        parserVersion: original.parserVersion,
        duplicateSearchLimit: 2000,
      });
      return { importId, records: parsed.length };
    },
    { timeout: 30000 },
  );
}
