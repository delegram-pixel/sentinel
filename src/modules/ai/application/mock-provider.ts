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

function validOutput(taskType: AiTaskType, request?: AiProviderRequest): unknown {
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
    case "PATTERN_ANALYSIS":
      return {
        patterns: [],
        claims: [],
        uncertaintyNotes: ["The mock provider did not assess research patterns."],
      };
    case "EVIDENCE_REVIEW":
      return {
        assessments: [],
        claims: [],
        uncertaintyNotes: ["The mock provider did not assess the evidence."],
      };
    case "FALSE_POSITIVE_REVIEW":
      return {
        findings: [],
        claims: [],
        uncertaintyNotes: ["The mock provider did not verify any finding."],
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
        referencedFindingIds: [
          ...[request?.system, ...(request?.messages.map((m) => m.content) ?? [])]
            .join("\n")
            .matchAll(/finding id="([a-f0-9-]{36})"/g),
        ]
          .map((m) => m[1])
          .slice(0, 10),
        referencedEvidenceIds: [],
        claims: [
          {
            id: "claim-mock-limitation",
            statement: "No live model call was made.",
            basis: "UNKNOWN",
            sources: [],
            confidence: "low",
            limitations: ["Mock output requires human replacement before external use."],
          },
        ],
        assumptions: ["No live assessment was performed."],
        missingInformation: ["A human must provide a verified report narrative."],
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
    case "RESEARCH_CONCLUSION_REVIEW": {
      const history = [
        ...(request?.system ?? "").matchAll(/<untrusted_data[^>]*>([\s\S]*?)<\/untrusted_data>/g),
      ]
        .flatMap((match) => {
          try {
            return [JSON.parse(match[1]!)];
          } catch {
            return [];
          }
        })
        .filter(
          (record) => record.sourceType === "AI_TASK" && Array.isArray(record.output?.claims),
        );
      return {
        reviews: history.flatMap((record) =>
          record.output.claims.map((claim: { id: string }) => ({
            taskId: record.id,
            claimId: claim.id,
            verdict: "INSUFFICIENT",
            reasoning: "Mock output requires human assessment.",
            sources: [],
          })),
        ),
        conclusions: [],
        missingInformation: ["No live assessment was performed."],
      };
    }
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

    let structured =
      this.scenario === "malformed"
        ? malformedOutput(request.taskType)
        : this.scenario === "schema_error"
          ? schemaErrorOutput()
          : this.scenario === "unknown_reference"
            ? unknownReferenceOutput(request.taskType)
            : (this.outputs[request.taskType] ?? validOutput(request.taskType, request));
    if (this.scenario === "valid") {
      if (["BATCH_REVIEW", "BATCH_MERGE"].includes(request.purpose ?? "")) {
        const batch = JSON.parse(request.messages.at(-1)!.content).untrustedBatch;
        structured = {
          summary: "Mock provisional notes; no assessment was performed.",
          sourceIds: Array.isArray(batch)
            ? [...new Set(batch.flatMap((note) => note.sourceIds))]
            : batch.sourceIds,
          contradictions: [],
          missingInformation: ["Human assessment is required."],
        };
      } else if (request.purpose === "SOURCE_CHECK") structured = { problems: [] };
      else if (
        (request.structuredOutput.schema.properties as Record<string, unknown> | undefined)
          ?.analysis
      ) {
        structured = {
          version: 1,
          analysis: structured,
          claims: [
            {
              id: "claim-mock-limitation",
              statement: "The mock provider did not assess the target.",
              basis: "UNKNOWN",
              sources: [],
              confidence: "low",
              limitations: ["A human must assess the original evidence."],
            },
          ],
          conclusions: [],
        };
      }
    }

    return {
      structured,
      text: typeof structured === "string" ? structured : JSON.stringify(structured, null, 2),
      usage: {
        inputTokens: Math.min(request.maxTokens, estimateMockInputTokens(request)),
        outputTokens: 120,
      },
      stopReason: "tool_use",
      model: request.model,
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
