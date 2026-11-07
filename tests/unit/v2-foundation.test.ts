import { describe, expect, it } from "vitest";
import { engagementInputSchema } from "@/modules/engagements/domain/engagement";
import {
  decisionInputSchema,
  investigationRelationSchema,
  researchPhaseSchema,
} from "@/modules/research/domain/research-decision";
import { knowledgeInputSchema } from "@/modules/knowledge/domain/knowledge";
import {
  assertEvidenceRelationshipMutable,
  assertEvidenceUnlinkAllowed,
} from "@/modules/evidence/domain/relationship";
const id = "c1a532e4-b937-4c1b-9a07-12e2a436f813";
describe("V2 research invariants", () => {
  it("requires ordered engagement dates without creating authorization", () => {
    expect(
      engagementInputSchema.safeParse({
        projectId: id,
        name: "Audit",
        engagementType: "AUTHORIZED_ASSESSMENT",
        startsAt: "2026-11-10",
        endsAt: "2026-11-01",
      }).success,
    ).toBe(false);
    const draft = engagementInputSchema.parse({
      projectId: id,
      name: "Audit",
      engagementType: "AUTHORIZED_ASSESSMENT",
      startsAt: "",
      endsAt: "",
    });
    expect(draft.startsAt).toBeUndefined();
    expect(draft).not.toHaveProperty("approvedBy");
  });
  it("requires source identity for rejection and AI adoption", () => {
    for (const kind of ["REJECT_HYPOTHESIS", "ADOPT_AI_RESULT"])
      expect(
        decisionInputSchema.safeParse({ investigationId: id, kind, rationale: "Review rationale" })
          .success,
      ).toBe(false);
    expect(
      researchPhaseSchema.safeParse({
        investigationId: id,
        expectedPhase: "ANALYSIS",
        phase: "CLOSED",
      }).success,
    ).toBe(false);
    expect(
      investigationRelationSchema.safeParse({
        fromId: id,
        toId: id,
        relationship: "RELATED",
        rationale: "Same source",
      }).success,
    ).toBe(false);
  });
  it("does not fetch source URLs or permit executable URL schemes", () => {
    expect(
      knowledgeInputSchema.safeParse({
        title: "Reference",
        content: "Supplied reference",
        origin: "PUBLIC_REFERENCE",
        url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      knowledgeInputSchema.parse({
        title: "Reference",
        content: "Supplied reference",
        origin: "AI_INTERPRETATION",
      }),
    ).not.toHaveProperty("reviewStatus");
  });
  it("preserves approved evidence support and archived history", () => {
    expect(() => assertEvidenceUnlinkAllowed("CONFIRMED", "SUPPORTS", 0)).toThrow(
      /last supporting/,
    );
    expect(() => assertEvidenceUnlinkAllowed("REPORTABLE", "SUPPORTS", 0)).toThrow(
      /last supporting/,
    );
    expect(() => assertEvidenceUnlinkAllowed("CONFIRMED", "CONTEXT", 0)).not.toThrow();
    expect(() => assertEvidenceUnlinkAllowed("CONFIRMED", "SUPPORTS", 1)).not.toThrow();
    expect(() =>
      assertEvidenceRelationshipMutable({
        status: "DRAFT",
        projectStatus: "ARCHIVED",
        investigationStatus: "ACTIVE",
      }),
    ).toThrow(/archived/);
  });
});
