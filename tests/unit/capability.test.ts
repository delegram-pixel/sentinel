import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  CAPABILITY_POLICY,
  evaluateCapability,
  isCapabilityAllowed,
  type Capability,
} from "@/modules/security/domain/capability";

describe("capability gate", () => {
  it("allows analysis of supplied content", () => {
    expect(isCapabilityAllowed("AI_ANALYZE_SUPPLIED_CONTENT", { actor: "AI" })).toBe(true);
  });

  it("requires a documented target for target-context analysis", () => {
    expect(isCapabilityAllowed("AI_ANALYZE_TARGET_CONTEXT", { actor: "AI" })).toBe(false);
    expect(
      isCapabilityAllowed("AI_ANALYZE_TARGET_CONTEXT", {
        actor: "AI",
        targetDocumented: true,
      }),
    ).toBe(true);
  });

  it("never lets AI modify scope", () => {
    const result = evaluateCapability("MODIFY_SCOPE", { actor: "AI" });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("HUMAN_ONLY_CAPABILITY");
    }

    expect(isCapabilityAllowed("MODIFY_SCOPE", { actor: "HUMAN" })).toBe(true);
  });

  it("refuses capabilities that are not implemented, even with an active scope", () => {
    for (const capability of ["PASSIVE_FETCH", "ACTIVE_TEST", "BROWSE_WEB"] as const) {
      const result = evaluateCapability(capability, {
        actor: "HUMAN",
        activeScope: true,
        humanApproved: true,
        targetDocumented: true,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe("CAPABILITY_NOT_IMPLEMENTED");
      }
    }
  });

  it("refuses prohibited capabilities unconditionally", () => {
    for (const capability of ["EXECUTE_COMMAND", "SUBMIT_EXTERNAL_REPORT"] as const) {
      const result = evaluateCapability(capability, {
        actor: "HUMAN",
        activeScope: true,
        humanApproved: true,
        targetDocumented: true,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe("CAPABILITY_PROHIBITED");
      }
    }
  });

  it("requires human approval to export a report", () => {
    expect(isCapabilityAllowed("EXPORT_REPORT", { actor: "HUMAN" })).toBe(false);
    expect(isCapabilityAllowed("EXPORT_REPORT", { actor: "HUMAN", humanApproved: true })).toBe(
      true,
    );
  });

  it("denies unknown capabilities instead of defaulting open", () => {
    const result = evaluateCapability("DELETE_EVERYTHING" as Capability, { actor: "HUMAN" });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("UNKNOWN_CAPABILITY");
    }
  });

  it("defines a policy for every declared capability", () => {
    expect(Object.keys(CAPABILITY_POLICY).sort()).toEqual([...CAPABILITIES].sort());

    for (const capability of CAPABILITIES) {
      expect(evaluateCapability(capability, { actor: "AI" })).toBeTypeOf("object");
    }
  });
});
