import Link from "next/link";
import { AgentResearchOutput } from "./agent-research-output";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { adoptSuggestionAction } from "@/app/(dashboard)/dashboard/investigations/adoption";

import { EvidenceReference } from "@/components/shared/evidence-reference";
import { ResearchPoints } from "@/components/shared/research-points";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  conversationOutputSchema,
  hypothesisGenerationOutputSchema,
  reconAnalysisOutputSchema,
  sessionSummaryOutputSchema,
  verificationReviewOutputSchema,
} from "@/modules/ai/domain/structured-output";

function OutputReferences({
  observations = [],
  hypotheses = [],
  investigationId,
}: {
  observations?: string[];
  hypotheses?: string[];
  investigationId: string;
}) {
  if (!observations.length && !hypotheses.length) return null;
  const base = `/dashboard/investigations/${investigationId}`;
  return (
    <div>
      <p className="mb-2 text-xs font-medium">Referenced research records</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {observations.map((id) => (
          <EvidenceReference
            key={id}
            id={id}
            label="Observation"
            href={`${base}#observation-${id}`}
          />
        ))}
        {hypotheses.map((id) => (
          <EvidenceReference
            key={id}
            id={id}
            label="Hypothesis"
            href={`${base}#hypothesis-${id}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ResearchOutput({
  output,
  investigationId,
  fallback,
  sourceTaskId,
}: {
  output: unknown;
  investigationId: string;
  fallback?: string;
  sourceTaskId?: string;
}) {
  const hypotheses = hypothesisGenerationOutputSchema.safeParse(output);
  if (hypotheses.success)
    return (
      <div className="flex flex-col gap-6">
        <p className="text-xs text-text-secondary">
          Here are some ideas to explore. Check the reasoning and sources before adding a hypothesis
          to the investigation.
        </p>
        {hypotheses.data.hypotheses.length ? (
          hypotheses.data.hypotheses.map((hypothesis, index) => (
            <div key={index} className="flex flex-col gap-3 border-l-2 border-primary/40 pl-4">
              <h4 className="text-base font-medium break-words">{hypothesis.title}</h4>
              <p className="research-copy text-sm">{hypothesis.description}</p>
              <p className="text-xs text-text-secondary">
                AI confidence: {hypothesis.confidence}
                {hypothesis.vulnerabilityCategory
                  ? `; category: ${hypothesis.vulnerabilityCategory}`
                  : ""}
              </p>
              <div>
                <p className="mb-1 text-xs font-medium">Reasoning</p>
                <p className="research-copy text-sm text-text-secondary">{hypothesis.rationale}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Information still needed</p>
                <p className="research-copy text-sm text-text-secondary">
                  {hypothesis.missingInformation}
                </p>
              </div>
              <OutputReferences
                observations={hypothesis.supportingObservationIds}
                investigationId={investigationId}
              />
              {sourceTaskId ? (
                <ResearchActionForm
                  action={adoptSuggestionAction}
                  hidden={{ taskId: sourceTaskId, index: String(index), kind: "HYPOTHESIS" }}
                  submitLabel="Adopt hypothesis for research"
                  fields={[
                    {
                      name: "rationale",
                      label: "Adoption rationale",
                      type: "textarea",
                      required: true,
                      maxLength: 2000,
                    },
                  ]}
                />
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-text-secondary">The task proposed no hypotheses.</p>
        )}
        <ResearchPoints
          title="Possible overlap with existing research"
          values={hypotheses.data.duplicateRiskNotes}
        />
        <ResearchPoints title="Suggested next actions" values={hypotheses.data.nextActions} />
      </div>
    );

  const recon = reconAnalysisOutputSchema.safeParse(output);
  if (recon.success)
    return (
      <div className="flex flex-col gap-6">
        <p className="research-copy text-sm">{recon.data.summary}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <ResearchPoints
            title="Information supplied in context"
            values={recon.data.knownInformation}
          />
          <ResearchPoints
            title="Information still unknown"
            values={recon.data.unknownInformation}
          />
        </div>
        {recon.data.observations.length ? (
          <div>
            <p className="mb-3 text-xs font-medium">AI-generated observations for review</p>
            <div className="flex flex-col gap-5">
              {recon.data.observations.map((observation, index) => (
                <div key={index} className="border-l-2 border-primary/40 pl-4">
                  <h4 className="text-sm font-medium break-words">{observation.title}</h4>
                  <p className="research-copy mt-2 text-sm">{observation.description}</p>
                  <p className="mt-2 text-xs text-text-secondary">
                    AI confidence: {observation.confidence}. Human review required.
                  </p>
                  {observation.source ? (
                    <p className="record-metadata mt-2">AI-cited source: {observation.source}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <ResearchPoints title="Uncertainty" values={recon.data.uncertaintyNotes} />
        <ResearchPoints title="Suggested next actions" values={recon.data.recommendedActions} />
        <OutputReferences
          observations={recon.data.referencedObservationIds}
          hypotheses={recon.data.referencedHypothesisIds}
          investigationId={investigationId}
        />
      </div>
    );

  const conversation = conversationOutputSchema.safeParse(output);
  if (conversation.success)
    return (
      <div className="flex flex-col gap-5">
        <p className="research-copy text-sm">{conversation.data.message}</p>
        <ResearchPoints
          title="Suggested next steps"
          values={conversation.data.suggestedNextSteps}
        />
        <ResearchPoints title="Limitations and warnings" values={conversation.data.warnings} />
        <OutputReferences
          observations={conversation.data.referencedObservationIds}
          hypotheses={conversation.data.referencedHypothesisIds}
          investigationId={investigationId}
        />
      </div>
    );

  const summary = sessionSummaryOutputSchema.safeParse(output);
  if (summary.success)
    return (
      <div className="flex flex-col gap-6">
        <p className="research-copy text-sm">{summary.data.summary}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <ResearchPoints title="Completed work" values={summary.data.completedWork} />
          <ResearchPoints title="Rejected hypotheses" values={summary.data.rejectedHypotheses} />
          <ResearchPoints title="Unresolved questions" values={summary.data.unresolvedQuestions} />
          <ResearchPoints title="Suggested next actions" values={summary.data.nextActions} />
        </div>
      </div>
    );

  const verification = verificationReviewOutputSchema.safeParse(output);
  if (verification.success)
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="warning">
          <AlertDescription>
            Use this review to help you assess the finding. Confirmation still needs a human
            decision.
          </AlertDescription>
        </Alert>
        <p className="record-metadata">AI conclusion: {verification.data.conclusion}</p>
        <p className="research-copy text-sm">{verification.data.reviewSummary}</p>
        <ResearchPoints
          title="Supporting information"
          values={verification.data.supportingEvidence}
        />
        <ResearchPoints
          title="Contradicting information"
          values={verification.data.contradictoryEvidence}
        />
        <ResearchPoints title="Missing evidence" values={verification.data.missingEvidence} />
        <p className="research-copy text-sm">{verification.data.impactAssessment}</p>
        <OutputReferences
          observations={verification.data.referencedObservationIds}
          hypotheses={verification.data.referencedHypothesisIds}
          investigationId={investigationId}
        />
        <Link
          href={`/dashboard/investigations/${investigationId}`}
          className="record-link w-fit text-sm text-primary"
        >
          Review the investigation
        </Link>
      </div>
    );

  const agent = <AgentResearchOutput output={output} />;
  if (
    output &&
    typeof output === "object" &&
    ("patterns" in output || "assessments" in output || "findings" in output)
  )
    return agent;
  return (
    <p className="research-copy text-sm">
      {fallback ??
        "There's no structured result to show for this task. Check its status and history for more detail."}
    </p>
  );
}
