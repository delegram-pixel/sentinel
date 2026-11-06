import { z } from "zod";

export const CAPABILITIES = [
  "READ_PROJECT_CONTEXT",
  "READ_INVESTIGATION_CONTEXT",
  "AI_ANALYZE_SUPPLIED_CONTENT",
  "AI_ANALYZE_TARGET_CONTEXT",
  "EXPORT_REPORT",
  "MODIFY_SCOPE",
  "PASSIVE_FETCH",
  "ACTIVE_TEST",
  "BROWSE_WEB",
  "EXECUTE_COMMAND",
  "SUBMIT_EXTERNAL_REPORT",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const capabilitySchema = z.enum(CAPABILITIES);

export const CAPABILITY_LABELS: Record<Capability, string> = {
  READ_PROJECT_CONTEXT: "Read project context",
  READ_INVESTIGATION_CONTEXT: "Read investigation context",
  AI_ANALYZE_SUPPLIED_CONTENT: "Analyze supplied content",
  AI_ANALYZE_TARGET_CONTEXT: "Analyze target context",
  EXPORT_REPORT: "Export report",
  MODIFY_SCOPE: "Modify scope",
  PASSIVE_FETCH: "Passive fetch",
  ACTIVE_TEST: "Active test",
  BROWSE_WEB: "Browse web",
  EXECUTE_COMMAND: "Execute command",
  SUBMIT_EXTERNAL_REPORT: "Submit external report",
};

export type CapabilityStatus = "ENABLED" | "HUMAN_ONLY" | "NOT_IMPLEMENTED" | "PROHIBITED";

export type CapabilityActor = "AI" | "HUMAN";

export type CapabilityPolicy = {
  status: CapabilityStatus;
  requiresDocumentedTarget: boolean;
  requiresActiveScope: boolean;
  requiresHumanApproval: boolean;
  description: string;
};

export const CAPABILITY_POLICY: Record<Capability, CapabilityPolicy> = {
  READ_PROJECT_CONTEXT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Read project metadata inside the requesting workspace.",
  },
  READ_INVESTIGATION_CONTEXT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Read investigation records inside the requesting workspace.",
  },
  AI_ANALYZE_SUPPLIED_CONTENT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Analyze content supplied by the user, without network access.",
  },
  AI_ANALYZE_TARGET_CONTEXT: {
    status: "ENABLED",
    requiresDocumentedTarget: true,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Analyze supplied target metadata. The MVP performs no network access.",
  },
  EXPORT_REPORT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: true,
    description: "Export a report from a human-approved reportable finding.",
  },
  MODIFY_SCOPE: {
    status: "HUMAN_ONLY",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Create or approve a scope version. AI may never perform this action.",
  },
  PASSIVE_FETCH: {
    status: "NOT_IMPLEMENTED",
    requiresDocumentedTarget: true,
    requiresActiveScope: true,
    requiresHumanApproval: false,
    description: "Future passive retrieval. Requires active scope and SSRF controls.",
  },
  ACTIVE_TEST: {
    status: "NOT_IMPLEMENTED",
    requiresDocumentedTarget: true,
    requiresActiveScope: true,
    requiresHumanApproval: true,
    description: "Future active testing. Requires active scope and separate approval.",
  },
  BROWSE_WEB: {
    status: "NOT_IMPLEMENTED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Future browser automation. Not permitted in the MVP.",
  },
  EXECUTE_COMMAND: {
    status: "PROHIBITED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Never permitted.",
  },
  SUBMIT_EXTERNAL_REPORT: {
    status: "PROHIBITED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Never permitted. Reports are exported, never submitted automatically.",
  },
};

export type CapabilityContext = {
  actor: CapabilityActor;
  targetDocumented?: boolean;
  activeScope?: boolean;
  humanApproved?: boolean;
};

export type CapabilityDenial = {
  allowed: false;
  code:
    | "UNKNOWN_CAPABILITY"
    | "CAPABILITY_NOT_IMPLEMENTED"
    | "CAPABILITY_PROHIBITED"
    | "HUMAN_ONLY_CAPABILITY"
    | "TARGET_NOT_DOCUMENTED"
    | "SCOPE_NOT_ACTIVE"
    | "HUMAN_APPROVAL_REQUIRED";
  message: string;
};

export type CapabilityDecision = { allowed: true } | CapabilityDenial;

/**
 * Single server-side capability gate for the orchestrator (ADR-007). Unknown
 * capabilities are denied rather than defaulting to allowed.
 */
export function evaluateCapability(
  capability: Capability,
  context: CapabilityContext,
): CapabilityDecision {
  const policy = CAPABILITY_POLICY[capability] as CapabilityPolicy | undefined;

  if (!policy) {
    return {
      allowed: false,
      code: "UNKNOWN_CAPABILITY",
      message: `Unknown capability: ${String(capability)}.`,
    };
  }

  if (policy.status === "PROHIBITED") {
    return {
      allowed: false,
      code: "CAPABILITY_PROHIBITED",
      message: `${capability} is prohibited.`,
    };
  }

  if (policy.status === "NOT_IMPLEMENTED") {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_IMPLEMENTED",
      message: `${capability} is not implemented in this release.`,
    };
  }

  if (policy.status === "HUMAN_ONLY" && context.actor !== "HUMAN") {
    return {
      allowed: false,
      code: "HUMAN_ONLY_CAPABILITY",
      message: `${capability} requires an explicit human action.`,
    };
  }

  if (policy.requiresDocumentedTarget && !context.targetDocumented) {
    return {
      allowed: false,
      code: "TARGET_NOT_DOCUMENTED",
      message: `${capability} requires a documented target.`,
    };
  }

  if (policy.requiresActiveScope && !context.activeScope) {
    return {
      allowed: false,
      code: "SCOPE_NOT_ACTIVE",
      message: `${capability} requires an active scope.`,
    };
  }

  if (policy.requiresHumanApproval && !context.humanApproved) {
    return {
      allowed: false,
      code: "HUMAN_APPROVAL_REQUIRED",
      message: `${capability} requires human approval.`,
    };
  }

  return { allowed: true };
}

export function isCapabilityAllowed(capability: Capability, context: CapabilityContext): boolean {
  return evaluateCapability(capability, context).allowed;
}
