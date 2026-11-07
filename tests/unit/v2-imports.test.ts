import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseToolImport,
  duplicateSignals,
  importRequestSchema,
} from "@/modules/imports/domain/tool-import";
import { validateManualRetestScope } from "@/modules/remediation/domain/remediation";
const input = { format: "JSON" as const, sourceTool: "supplied", fieldMapping: {}, rawContent: "" };
describe("supplied tool results", () => {
  it("maps explicit fields without confirming severity or losing originals", () => {
    const result = parseToolImport({
      ...input,
      rawContent: JSON.stringify({
        records: [{ Name: "Unverified alert", level: "critical", toolMetadata: { x: 1 } }],
      }),
      fieldMapping: { title: "Name", severity: "level" },
    });
    expect(result[0]?.canonical.title).toBe("Unverified alert");
    expect(result[0]?.canonical.severity).toBe("critical");
    expect(result[0]?.rawRecord).toEqual({
      Name: "Unverified alert",
      level: "critical",
      toolMetadata: { x: 1 },
    });
    expect(
      importRequestSchema.safeParse({
        ...input,
        engagementId: "00000000-0000-4000-8000-000000000001",
        operationKey: "unique-operation",
        fileName: "file.json",
        rawContent: "[]",
      }).success,
    ).toBe(true);
  });
  it("supports CSV escaped quotes and embedded newlines; rejects malformed widths and quoting", () => {
    expect(parseCsv('title,description\r\n"Alert, one","Line one\nLine ""two"""\r\n')).toEqual([
      { title: "Alert, one", description: 'Line one\nLine "two"' },
    ]);
    for (const value of [
      "title,title\na,b",
      "title,description\na",
      'title\n"unterminated',
      'title\n"a"garbage',
    ])
      expect(() => parseCsv(value)).toThrow();
  });
  it("supports actual SARIF 2.1.0 runs and indexed artifact locations", () => {
    const raw = {
      ruleId: "R1",
      message: { text: "Potential unsafe sink" },
      level: "warning",
      locations: [
        { physicalLocation: { artifactLocation: { index: 0 }, region: { startLine: 12 } } },
      ],
    };
    const sarif = {
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Static analyzer",
              rules: [{ id: "R1", name: "Unsafe sink", helpUri: "https://example.test/rule" }],
            },
          },
          artifacts: [{ location: { uri: "src/page.ts" } }],
          results: [raw],
        },
      ],
    };
    const result = parseToolImport({
      ...input,
      format: "SARIF",
      rawContent: JSON.stringify(sarif),
    });
    expect(result[0]?.canonical).toMatchObject({
      title: "Unsafe sink",
      sourceTool: "Static analyzer",
      locationReference: "src/page.ts:12",
      severity: "warning",
      classification: "R1",
    });
    expect(result[0]?.rawRecord).toEqual(raw);
    expect(() =>
      parseToolImport({
        ...input,
        format: "SARIF",
        rawContent: JSON.stringify({ ...sarif, version: "2.0.0" }),
      }),
    ).toThrow();
  });
  it("rejects invalid JSON, field limits, invalid encoding, empty and oversized collections", () => {
    for (const content of [
      "{",
      "[]",
      '[{"title":"a\\u0000"}]',
      JSON.stringify([{ title: "a", description: "x".repeat(16001) }]),
      JSON.stringify(Array.from({ length: 1001 }, () => ({ title: "a" }))),
    ])
      expect(() => parseToolImport({ ...input, rawContent: content })).toThrow();
  });
  it("retains ambiguous duplicates as multi-signal candidates", () => {
    const a = {
      sourceTool: "tool",
      sourceRecordId: "one",
      title: "Alert",
      assetReference: "host",
      classification: "CWE-79",
      locationReference: "/route",
      references: [],
    };
    expect(duplicateSignals(a, { ...a })).toEqual([
      "SAME_TOOL_SOURCE_ID",
      "SAME_ASSET_CLASSIFICATION_LOCATION",
      "SAME_ASSET_TITLE",
    ]);
    expect(duplicateSignals(a, { ...a, assetReference: "other", sourceRecordId: "two" })).toEqual(
      [],
    );
  });
});
it("manual retest documentation rejects revoked, expired, excluded or prohibited authorizations", () => {
  const scope = {
    status: "ACTIVE" as const,
    approvedBy: "human",
    approvedAt: new Date(0),
    effectiveFrom: new Date(0),
    effectiveUntil: new Date(2000),
    assets: [
      { assetIdentifier: "lab.test", matchType: "DOMAIN" as const, effect: "ALLOWED" as const },
    ],
    activities: [{ activity: "ACTIVE_TEST" as const, effect: "PERMITTED" as const }],
  };
  expect(() =>
    validateManualRetestScope(scope, "lab.test", "ACTIVE_TEST", new Date(1000)),
  ).not.toThrow();
  expect(() =>
    validateManualRetestScope(scope, "lab.test", "ACTIVE_TEST", new Date(3000)),
  ).toThrow();
  expect(() =>
    validateManualRetestScope(
      { ...scope, status: "REVOKED" },
      "lab.test",
      "ACTIVE_TEST",
      new Date(1000),
    ),
  ).toThrow();
  expect(() =>
    validateManualRetestScope(
      {
        ...scope,
        assets: [
          ...scope.assets,
          { assetIdentifier: "lab.test", matchType: "DOMAIN", effect: "EXCLUDED" },
        ],
      },
      "lab.test",
      "ACTIVE_TEST",
      new Date(1000),
    ),
  ).toThrow();
  expect(() =>
    validateManualRetestScope(scope, "lab.test", "PASSIVE_FETCH", new Date(1000)),
  ).toThrow();
});
