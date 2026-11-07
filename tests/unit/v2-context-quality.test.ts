import { describe, expect, it } from "vitest";
import {
  invalidEvidenceReferences,
  verificationReviewOutputSchema,
} from "@/modules/ai/domain/structured-output";
import { chunkDocument } from "@/modules/knowledge/domain/chunk";
import { canonicalJson } from "@/modules/shared/domain/json";
describe("deterministic research quality gates", () => {
  it("rejects loaded-but-omitted and foreign evidence citations", () => {
    expect(
      invalidEvidenceReferences(
        { referencedObservationIds: ["omitted"], referencedEvidenceIds: ["foreign"] },
        new Set(["selected"]),
        new Set(),
        new Set(["approved"]),
      ),
    ).toEqual(["Unknown observation reference: omitted.", "Unknown evidence reference: foreign."]);
    expect(
      invalidEvidenceReferences(
        { referencedObservationIds: ["selected"], referencedEvidenceIds: ["approved"] },
        new Set(["selected"]),
        new Set(),
        new Set(["approved"]),
      ),
    ).toEqual([]);
  });
  it("rejects AI human confirmation and preserves exact document text", () => {
    expect(verificationReviewOutputSchema.safeParse({ conclusion: "CONFIRMED" }).success).toBe(
      false,
    );
    const text = "Supplied source\n".repeat(500);
    const chunks = chunkDocument(text);
    expect(chunks.map((c) => c.content).join("")).toBe(text);
    for (const c of chunks) expect(text.slice(c.startOffset, c.endOffset)).toBe(c.content);
  });
  it("normalizes object key order without changing arrays or nested source fields", () => {
    expect(canonicalJson({ b: [1, 2], a: { z: 3, x: 4 } })).toBe(
      canonicalJson({ a: { x: 4, z: 3 }, b: [1, 2] }),
    );
  });
});
