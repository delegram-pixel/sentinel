import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "./research-action-form";
import {
  recordDecisionAction,
  changePhaseAction,
} from "@/app/(dashboard)/dashboard/investigations/decisions";
import { RESEARCH_PHASES } from "@/modules/research/domain/research-decision";
import type { DecisionRow } from "@/modules/research/application/decision-service";
import type { InvestigationDetail } from "@/modules/research/application/ports";

export function ResearchDecisions({
  investigation,
  decisions,
  canEdit,
  sources,
}: {
  investigation: InvestigationDetail;
  decisions: DecisionRow[];
  canEdit: boolean;
  sources: Array<{ value: string; label: string }>;
}) {
  const phase = investigation.phase ?? "CONTEXT_GATHERING";
  const optionalSources = [{ value: "", label: "No source selected" }, ...sources];
  return (
    <ResearchSection
      id="research-decisions"
      title="Research decisions"
      description="Attributable decisions preserve the rationale and sources behind the investigation."
    >
      <p className="mb-4 text-sm">Research phase: {phase.replaceAll("_", " ")}</p>
      {canEdit && phase !== "CLOSED" ? (
        <ResearchActionForm
          action={changePhaseAction}
          hidden={{ investigationId: investigation.id, expectedPhase: phase }}
          submitLabel="Update research phase"
          fields={[
            {
              name: "phase",
              label: "Research phase",
              defaultValue: phase,
              options: RESEARCH_PHASES.filter((p) => p !== "CLOSED").map((p) => ({
                value: p,
                label: p.replaceAll("_", " "),
              })),
            },
          ]}
        />
      ) : null}
      {decisions.length ? (
        <ol className="my-6 divide-y divide-border">
          {decisions.map((d) => (
            <li className="py-3" key={d.id}>
              <p className="font-medium">{d.kind.replaceAll("_", " ")}</p>
              <p className="text-sm whitespace-pre-wrap">{d.rationale}</p>
              <p className="text-xs text-muted-foreground">
                {d.creator.displayName} · {d.createdAt.toLocaleString()}{" "}
                {d.sourceTaskId ? "· References AI analysis" : "· Human research decision"}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="my-4 text-sm text-muted-foreground">No research decisions recorded.</p>
      )}
      {canEdit && phase !== "CLOSED" ? (
        <ResearchActionForm
          action={recordDecisionAction}
          hidden={{ investigationId: investigation.id }}
          submitLabel="Record decision"
          fields={[
            {
              name: "kind",
              label: "Decision",
              options: [
                { value: "RESEARCH_NOTE", label: "Research note" },
                { value: "MORE_RESEARCH", label: "More research required" },
                { value: "REJECT_HYPOTHESIS", label: "Reject a hypothesis" },
                { value: "CLOSE_INVESTIGATION", label: "Close the investigation" },
              ],
            },
            {
              name: "hypothesisId",
              label: "Hypothesis, when rejecting",
              options: [
                { value: "", label: "No hypothesis selected" },
                ...investigation.hypotheses.map((h) => ({ value: h.id, label: h.title })),
              ],
            },
            { name: "supports", label: "Supporting source", options: optionalSources },
            { name: "contradicts", label: "Contradictory source", options: optionalSources },
            {
              name: "rationale",
              label: "Rationale and unresolved questions",
              type: "textarea",
              required: true,
              maxLength: 6000,
            },
          ]}
        />
      ) : null}
    </ResearchSection>
  );
}
