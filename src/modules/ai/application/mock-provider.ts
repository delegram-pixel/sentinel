import { AiError } from "../domain/ai-errors";
import type { AiTaskType } from "../domain/ai-config";

import type {
  AIProvider,
  AiProviderRequest,
  AiProviderResponse,
  AiStructuredOutputRequest,
} from "./provider";

export type MockScenario =
  | "valid"
  | "malformed"
  | "schema_error"
  | "unknown_reference"
  | "timeout"
  | "rate_limit"
  | "refusal";

export type MockAIProviderOptions = {
  scenario?: MockScenario;
  outputs?: Partial<Record<AiTaskType, unknown>>;
};

function validOutput(taskType: AiTaskType): unknown {
  switch (taskType) {
    case "ATTACK_SURFACE_ANALYSIS":
      return {
        message:
          "The deterministic mock AI provider is active. Configure ANTHROPIC_API_KEY to enable live analysis.",
        suggestedNextSteps: [
          "Record the observed behaviour as an observation.",
          "Add the missing information before opening a hypothesis.",
        ],
        referencedObservationIds: [],
        referencedHypothesisIds: [],
        warnings: ["No live model call was made."],
      };
    case "RECON_ANALYSIS":
      return {
        summary:
          "The supplied records describe the current state without claiming new network activity.",
        knownInformation: ["The target is documented in the project."],
        unknownInformation: ["No live reconnaissance was performed."],
        observations: [],
        recommendedActions: ["Record a new observation from a human-run check."],
        referencedObservationIds: [],
        referencedHypothesisIds: [],
        uncertaintyNotes: ["Mock output is not an assessment of the target."],
      };
    case "HYPOTHESIS_GENERATION":
      return {
        hypotheses: [
          {
            title: "Review the recorded behaviour for a validation gap",
            description:
              "The deterministic mock suggests a candidate hypothesis for human review. It is not based on a live model assessment.",
            vulnerabilityCategory: "Unclassified",
            rationale: "A human must validate this suggestion against recorded observations.",
            missingInformation: "Confirm the observed behaviour with a repeatable request.",
            supportingObservationIds: [],
            confidence: "low",
          },
        ],
        duplicateRiskNotes: ["Check existing hypotheses before adding this candidate."],
        nextActions: ["Attach a supporting observation and set the hypothesis to Observed."],
      };
    case "SESSION_SUMMARY":
      return {
        summary: "Mock session summary. Configure ANTHROPIC_API_KEY for a model-generated summary.",
        completedWork: ["Reviewed the investigation records supplied in context."],
        rejectedHypotheses: [],
        unresolvedQuestions: ["Which observation should be validated next?"],
        nextActions: ["Record the next manual observation."],
      };
    case "EVIDENCE_REVIEW":
    case "FALSE_POSITIVE_REVIEW":
      return {
        conclusion: "NEEDS_MORE_EVIDENCE",
        reviewSummary: "Mock review requires more evidence.",
        supportingEvidence: [],
        contradictoryEvidence: [],
        missingEvidence: ["No live evidence review was performed."],
        impactAssessment: "Unassessed.",
        referencedObservationIds: [],
        referencedHypothesisIds: [],
      };
    case "FINDING_SUMMARY":
      return {
        title: "Mock finding summary",
        summary: "Mock output. Configure ANTHROPIC_API_KEY for a model-generated summary.",
        impact: "Unassessed.",
        remediation: "Unassessed.",
        missingSections: ["Impact", "Remediation"],
      };
    case "REPORT_GENERATION":
      return {
        title: "Mock report",
        summary: "Mock output. Configure ANTHROPIC_API_KEY for a model-generated report.",
        description: "No live model call was made.",
        affectedAsset: "Unknown",
        preconditions: [],
        reproduction: [],
        expectedBehaviour: "Unknown",
        actualBehaviour: "Unknown",
        impact: "Unknown",
        remediation: "Unknown",
        evidenceReferences: [],
      };
  }
}

function malformedOutput(taskType: AiTaskType): unknown {
  if (taskType === "SESSION_SUMMARY") {
    return "{not valid json";
  }

  return "{not valid json";
}

function schemaErrorOutput(): unknown {
  return { message: 42 };
}

function unknownReferenceOutput(taskType: AiTaskType): unknown {
  const output = validOutput(taskType);

  if (!output || typeof output !== "object") {
    return output;
  }

  const record = output as Record<string, unknown>;

  if (Array.isArray(record.hypotheses) && record.hypotheses.length > 0) {
    return {
      ...record,
      hypotheses: record.hypotheses.map((hypothesis) => ({
        ...(hypothesis as Record<string, unknown>),
        supportingObservationIds: ["00000000-0000-4000-8000-000000000000"],
      })),
    };
  }

  return {
    ...record,
    referencedObservationIds: ["00000000-0000-4000-8000-000000000000"],
  };
}

/**
 * Deterministic provider used by tests and by local development when no
 * Anthropic key is configured (ADR-021, ADR-025 / M-25). It never performs
 * network I/O.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "MOCK";
  private readonly scenario: MockScenario;
  private readonly outputs: Partial<Record<AiTaskType, unknown>>;

  constructor(options: MockAIProviderOptions = {}) {
    this.scenario = options.scenario ?? "valid";
    this.outputs = options.outputs ?? {};
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    if (!request.structuredOutput) {
      throw new AiError("AI_INVALID_OUTPUT", "The mock provider requires structured output.");
    }

    switch (this.scenario) {
      case "timeout":
        throw new AiError("AI_TIMEOUT", undefined, true);
      case "rate_limit":
        throw new AiError("AI_RATE_LIMITED", undefined, true);
      case "refusal":
        throw new AiError("AI_REFUSAL");
      default:
        break;
    }

    const structured =
      this.scenario === "malformed"
        ? malformedOutput(request.taskType)
        : this.scenario === "schema_error"
          ? schemaErrorOutput()
          : this.scenario === "unknown_reference"
            ? unknownReferenceOutput(request.taskType)
            : (this.outputs[request.taskType] ?? validOutput(request.taskType));

    return {
      structured,
      text: typeof structured === "string" ? structured : JSON.stringify(structured, null, 2),
      usage: {
        inputTokens: Math.min(request.maxTokens, estimateMockInputTokens(request)),
        outputTokens: 120,
      },
      stopReason: "tool_use",
    };
  }
}

function estimateMockInputTokens(request: AiProviderRequest): number {
  const promptLength =
    request.system.length +
    request.messages.reduce((total, message) => total + message.content.length, 0);

  return Math.max(1, Math.ceil(promptLength / 4));
}

export function isStructuredOutputRequest(
  request: AiProviderRequest,
): request is AiProviderRequest & { structuredOutput: AiStructuredOutputRequest } {
  return request.structuredOutput !== undefined;
}
