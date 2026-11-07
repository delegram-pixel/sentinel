import Link from "next/link";
import { ResearchPoints } from "@/components/shared/research-points";
import {
  evidenceAnalysisOutputSchema,
  independentVerificationOutputSchema,
  patternAnalysisOutputSchema,
} from "@/modules/ai/domain/agent-output";
export function AgentResearchOutput({ output }: { output: unknown }) {
  const pattern = patternAnalysisOutputSchema.safeParse(output);
  if (pattern.success)
    return (
      <div className="grid gap-5">
        {pattern.data.patterns.map((p, i) => (
          <div key={i}>
            <h4 className="font-medium">{p.name}</h4>
            <p className="text-sm">{p.relevance}</p>
            <ResearchPoints title="Alternative explanations" values={p.alternativeExplanations} />
            <ResearchPoints title="Not established" values={p.notEstablished} />
            <ResearchPoints title="Evidence needed" values={p.evidenceNeeded} />
          </div>
        ))}
        <ResearchPoints title="Uncertainty" values={pattern.data.uncertaintyNotes} />
      </div>
    );
  const evidence = evidenceAnalysisOutputSchema.safeParse(output);
  if (evidence.success)
    return (
      <div className="grid gap-5">
        {evidence.data.assessments.map((a) => (
          <div key={a.evidenceId}>
            <Link className="underline" href={`/dashboard/evidence/${a.evidenceId}`}>
              Review assessed evidence
            </Link>
            <p className="text-sm">{a.relevance}</p>
            <p className="text-xs text-muted-foreground">
              AI assessment ·{" "}
              {a.directEvidence
                ? "Direct evidence indicated"
                : "Interpretation or indirect evidence"}{" "}
              · {a.confidence} confidence
            </p>
            <ResearchPoints title="Provenance gaps" values={a.provenanceGaps} />
            <ResearchPoints title="Contradictions" values={a.contradictions} />
            <ResearchPoints title="Missing material" values={a.missingMaterial} />
            <ResearchPoints title="Redaction concerns" values={a.redactionConcerns} />
          </div>
        ))}
        <ResearchPoints title="Uncertainty" values={evidence.data.uncertaintyNotes} />
      </div>
    );
  const verification = independentVerificationOutputSchema.safeParse(output);
  if (verification.success)
    return (
      <div className="grid gap-5">
        {verification.data.findings.map((f) => (
          <div key={f.findingId}>
            <Link className="underline" href={`/dashboard/findings/${f.findingId}`}>
              Review finding
            </Link>
            <p className="text-sm">AI recommendation: {f.conclusion.replaceAll("_", " ")}</p>
            <p className="text-sm">{f.reasoning}</p>
            <ResearchPoints title="Alternative explanations" values={f.alternativeExplanations} />
            <ResearchPoints title="Unsupported impact" values={f.unsupportedImpact} />
            <ResearchPoints title="Unsupported severity" values={f.unsupportedSeverity} />
          </div>
        ))}
        <ResearchPoints title="Uncertainty" values={verification.data.uncertaintyNotes} />
      </div>
    );
  return null;
}
