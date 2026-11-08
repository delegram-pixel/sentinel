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
    description: "Read this workspace's saved project details.",
  },
  READ_INVESTIGATION_CONTEXT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Read this workspace's saved investigation records.",
  },
  AI_ANALYZE_SUPPLIED_CONTENT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description:
      "Ask AI to analyse the content you've supplied. This uses saved material without accessing the network.",
  },
  AI_ANALYZE_TARGET_CONTEXT: {
    status: "ENABLED",
    requiresDocumentedTarget: true,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description:
      "Ask AI to analyse saved target details. It uses the recorded context without connecting to the target.",
  },
  EXPORT_REPORT: {
    status: "ENABLED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: true,
    description: "Export a report based on reportable findings after a human has approved it.",
  },
  MODIFY_SCOPE: {
    status: "HUMAN_ONLY",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description:
      "Create or approve a scope version yourself. This requires a human action; AI can't do it.",
  },
  PASSIVE_FETCH: {
    status: "NOT_IMPLEMENTED",
    requiresDocumentedTarget: true,
    requiresActiveScope: true,
    requiresHumanApproval: false,
    description:
      "Fetching from a target isn't available yet. It will require an active scope and checks on which addresses can be accessed.",
  },
  ACTIVE_TEST: {
    status: "NOT_IMPLEMENTED",
    requiresDocumentedTarget: true,
    requiresActiveScope: true,
    requiresHumanApproval: true,
    description:
      "Active testing isn't available yet. It will require an active scope and separate human approval.",
  },
  BROWSE_WEB: {
    status: "NOT_IMPLEMENTED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Automated web browsing isn't available in this version.",
  },
  EXECUTE_COMMAND: {
    status: "PROHIBITED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description: "Running commands is prohibited in Sentinel.",
  },
  SUBMIT_EXTERNAL_REPORT: {
    status: "PROHIBITED",
    requiresDocumentedTarget: false,
    requiresActiveScope: false,
    requiresHumanApproval: false,
    description:
      "Sentinel doesn't submit reports automatically. Export an approved report, then submit it yourself.",
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
      message: `This action isn't recognised: ${String(capability)}.`,
    };
  }

  if (policy.status === "PROHIBITED") {
    return {
      allowed: false,
      code: "CAPABILITY_PROHIBITED",
      message: `${CAPABILITY_LABELS[capability]} is prohibited in Sentinel.`,
    };
  }

  if (policy.status === "NOT_IMPLEMENTED") {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_IMPLEMENTED",
      message: `${CAPABILITY_LABELS[capability]} isn't available in this version.`,
    };
  }

  if (policy.status === "HUMAN_ONLY" && context.actor !== "HUMAN") {
    return {
      allowed: false,
      code: "HUMAN_ONLY_CAPABILITY",
      message: `${CAPABILITY_LABELS[capability]} needs a human action. AI can't do it for you.`,
    };
  }

  if (policy.requiresDocumentedTarget && !context.targetDocumented) {
    return {
      allowed: false,
      code: "TARGET_NOT_DOCUMENTED",
      message: `Register the target before using ${CAPABILITY_LABELS[capability]}.`,
    };
  }

  if (policy.requiresActiveScope && !context.activeScope) {
    return {
      allowed: false,
      code: "SCOPE_NOT_ACTIVE",
      message: `Activate an approved scope before using ${CAPABILITY_LABELS[capability]}.`,
    };
  }

  if (policy.requiresHumanApproval && !context.humanApproved) {
    return {
      allowed: false,
      code: "HUMAN_APPROVAL_REQUIRED",
      message: `Get human approval before using ${CAPABILITY_LABELS[capability]}.`,
    };
  }

  return { allowed: true };
}

export function isCapabilityAllowed(capability: Capability, context: CapabilityContext): boolean {
  return evaluateCapability(capability, context).allowed;
}
