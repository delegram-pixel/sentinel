import { z } from "zod";
import { ResearchOperationError } from "@/modules/shared/domain/result";

export const IMPORT_FORMATS = ["JSON", "CSV", "SARIF"] as const;
export const IMPORT_PARSER_VERSION = "supplied-results-v1";
export const IMPORT_MAX_BYTES = 500_000;
export const IMPORT_MAX_RECORDS = 1000;
const text = z.string().trim().max(16_000);
export const canonicalResultSchema = z.object({
  sourceTool: text.min(1),
  sourceRecordId: text.optional(),
  title: text.min(1).max(200),
  description: text.optional(),
  severity: text.optional(),
  confidence: text.optional(),
  assetReference: text.optional(),
  locationReference: text.optional(),
  classification: text.optional(),
  references: z.array(text).max(100).default([]),
  observedAt: z.iso.datetime().optional(),
});
export type CanonicalResult = z.infer<typeof canonicalResultSchema>;
export const mappingSchema = z.partialRecord(
  z.enum([
    "sourceRecordId",
    "title",
    "description",
    "severity",
    "confidence",
    "assetReference",
    "locationReference",
    "classification",
    "observedAt",
  ]),
  z.string().trim().min(1).max(120),
);
export const importRequestSchema = z.object({
  engagementId: z.uuid(),
  operationKey: z.string().min(8).max(160),
  fileName: z.string().trim().min(1).max(200),
  format: z.enum(IMPORT_FORMATS),
  sourceTool: z.string().trim().min(1).max(120),
  rawContent: z.string().min(1).max(IMPORT_MAX_BYTES),
  fieldMapping: mappingSchema.default({}),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;
export const importReviewSchema = z
  .object({
    recordId: z.uuid(),
    action: z.enum(["ADOPT_OBSERVATION", "ADOPT_FINDING", "REJECT"]),
    investigationId: z.uuid().optional(),
    assetId: z.uuid().optional(),
    rationale: z.string().trim().min(10).max(8000),
  })
  .refine(
    (v) => v.action === "REJECT" || (v.investigationId && v.assetId),
    "Choose the investigation and engagement asset.",
  );
export type ImportReview = z.infer<typeof importReviewSchema>;

function invalid(message: string): never {
  throw new ResearchOperationError("IMPORT_INVALID", message);
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    return invalid("A result must be an object.");
  return v as Record<string, unknown>;
}
function checkTree(value: unknown, depth = 0): void {
  if (depth > 12) invalid("The import exceeds the supported nesting depth.");
  if (
    typeof value === "string" &&
    (value.length > 16_000 || value.includes("\u0000") || value.includes("\uFFFD"))
  )
    invalid("An imported field is too long or has invalid characters.");
  if (value && typeof value === "object") {
    if (Object.keys(value).length > 5000) invalid("The import contains too many fields.");
    for (const item of Object.values(value)) checkTree(item, depth + 1);
  }
}
function jsonValue(content: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return invalid("The supplied JSON is malformed.");
  }
  checkTree(value);
  return value;
}

/** RFC 4180 quoting, embedded newlines and escaped quotes; UTF-8 supplied text only. */
export function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let endedQuote = false;
  const pushField = () => {
    if (field.length > 16_000 || row.length >= 100) invalid("CSV field limits exceeded.");
    row.push(field);
    field = "";
    endedQuote = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    if (rows.length > IMPORT_MAX_RECORDS + 1) invalid("Too many CSV rows.");
  };
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          endedQuote = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || endedQuote) invalid("Invalid CSV quoting.");
      quoted = true;
    } else if (c === ",") pushField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (endedQuote) invalid("Unexpected text after a CSV quote.");
      field += c;
    }
  }
  if (quoted) invalid("An imported CSV quote was not closed.");
  if (field || row.length || endedQuote) pushRow();
  const headers = rows.shift();
  if (
    !headers?.length ||
    headers.some((h) => !h.trim()) ||
    new Set(headers).size !== headers.length
  )
    invalid("CSV requires unique, non-empty headers.");
  return rows
    .filter((r) => r.some(Boolean))
    .map((r) => {
      if (r.length !== headers.length) invalid("CSV row width does not match its headers.");
      return Object.fromEntries(headers.map((h, i) => [h, r[i]!]));
    });
}
function normalize(
  raw: unknown,
  sourceTool: string,
  mapping: ImportRequest["fieldMapping"],
): CanonicalResult {
  const record = object(raw);
  const mapped: Record<string, unknown> = { sourceTool, references: record.references ?? [] };
  for (const key of [
    "sourceRecordId",
    "title",
    "description",
    "severity",
    "confidence",
    "assetReference",
    "locationReference",
    "classification",
    "observedAt",
  ] as const) {
    const value = record[mapping[key] ?? key];
    if (value !== undefined && value !== null && value !== "")
      mapped[key] = typeof value === "number" && key === "sourceRecordId" ? String(value) : value;
  }
  const parsed = canonicalResultSchema.safeParse(mapped);
  if (!parsed.success)
    return invalid(
      "A result is missing a title or has unsupported canonical fields. Check the field mapping.",
    );
  return parsed.data;
}
export function parseToolImport(
  input: Pick<ImportRequest, "rawContent" | "format" | "sourceTool" | "fieldMapping">,
): Array<{ canonical: CanonicalResult; rawRecord: unknown }> {
  const content = input.rawContent.replace(/^\uFEFF/, "");
  if (
    new TextEncoder().encode(content).byteLength > IMPORT_MAX_BYTES ||
    content.includes("\u0000") ||
    content.includes("\uFFFD")
  )
    invalid("Supply valid UTF-8 content within the import size limit.");
  let records: Array<{ canonical: CanonicalResult; rawRecord: unknown }>;
  if (input.format === "SARIF") {
    const sarif = object(jsonValue(content));
    if (sarif.version !== "2.1.0" || !Array.isArray(sarif.runs))
      invalid("Only SARIF 2.1.0 with a runs array is supported.");
    records = sarif.runs.flatMap((runValue) => {
      const run = object(runValue);
      const driver = object(object(run.tool).driver);
      const tool = typeof driver.name === "string" ? driver.name : input.sourceTool;
      const rules = Array.isArray(driver.rules) ? driver.rules.map(object) : [];
      if (!Array.isArray(run.results)) invalid("SARIF run.results must be an array.");
      return run.results.map((rawRecord) => {
        const result = object(rawRecord);
        const rule = rules.find((r) => r.id === result.ruleId);
        const message = object(result.message);
        const description =
          typeof message.text === "string"
            ? message.text
            : typeof message.markdown === "string"
              ? message.markdown
              : undefined;
        if (!description) invalid("A SARIF result requires a text or Markdown message.");
        const locations = Array.isArray(result.locations) ? result.locations : [];
        const physical = locations[0] ? object(object(locations[0]).physicalLocation ?? {}) : {};
        const artifact = physical.artifactLocation ? object(physical.artifactLocation) : {};
        const region = physical.region ? object(physical.region) : {};
        const artifactIndex = typeof artifact.index === "number" ? artifact.index : -1;
        const runArtifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
        const indexed = runArtifacts[artifactIndex]
          ? object(object(runArtifacts[artifactIndex]).location ?? {})
          : {};
        const uri =
          typeof artifact.uri === "string"
            ? artifact.uri
            : typeof indexed.uri === "string"
              ? indexed.uri
              : undefined;
        const fingerprint =
          typeof result.guid === "string"
            ? result.guid
            : typeof result.correlationGuid === "string"
              ? result.correlationGuid
              : undefined;
        const canonical = canonicalResultSchema.safeParse({
          sourceTool: tool,
          sourceRecordId: fingerprint,
          title:
            typeof rule?.name === "string"
              ? rule.name
              : typeof result.ruleId === "string"
                ? result.ruleId
                : description.slice(0, 200),
          description,
          severity: result.level,
          classification: result.ruleId,
          locationReference: uri
            ? `${uri}${typeof region.startLine === "number" ? `:${region.startLine}` : ""}`
            : undefined,
          references: typeof rule?.helpUri === "string" ? [rule.helpUri] : [],
        });
        if (!canonical.success) invalid("A SARIF result contains invalid canonical fields.");
        return { canonical: canonical.data, rawRecord };
      });
    });
  } else {
    const value = input.format === "CSV" ? parseCsv(content) : jsonValue(content);
    const container = Array.isArray(value)
      ? value
      : (object(value).records ?? object(value).results ?? object(value).findings);
    if (!Array.isArray(container))
      invalid("JSON requires an array or records, results or findings array.");
    records = container.map((rawRecord) => ({
      canonical: normalize(rawRecord, input.sourceTool, input.fieldMapping),
      rawRecord,
    }));
  }
  if (!records.length || records.length > IMPORT_MAX_RECORDS)
    invalid("Supply between 1 and 1000 results.");
  return records;
}

export function duplicateSignals(a: CanonicalResult, b: CanonicalResult): string[] {
  const norm = (v?: string) => v?.trim().toLowerCase();
  const sameAsset = !!a.assetReference && norm(a.assetReference) === norm(b.assetReference);
  const reasons: string[] = [];
  if (a.sourceRecordId && a.sourceTool === b.sourceTool && a.sourceRecordId === b.sourceRecordId)
    reasons.push("SAME_TOOL_SOURCE_ID");
  if (
    sameAsset &&
    a.classification &&
    a.classification === b.classification &&
    a.locationReference &&
    a.locationReference === b.locationReference
  )
    reasons.push("SAME_ASSET_CLASSIFICATION_LOCATION");
  if (sameAsset && norm(a.title) === norm(b.title)) reasons.push("SAME_ASSET_TITLE");
  if (sameAsset && a.description && b.description && norm(a.description) === norm(b.description))
    reasons.push("SAME_ASSET_DESCRIPTION");
  return reasons;
}
