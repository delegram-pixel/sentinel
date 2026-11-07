import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { loadResearchInsights } from "@/modules/insights/infrastructure/research-insights";
export const metadata = { title: "Research insights" };
export default function InsightsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Research insights"
        description="Current workspace records, review coverage and documented outcomes."
      />
      <Suspense fallback={<p>Loading insights…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
function Counts({ rows }: { rows: Array<{ label: string; count: number }> }) {
  return rows.length ? (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4 border-b border-border py-2">
          <dt>{r.label.replaceAll("_", " ")}</dt>
          <dd className="font-mono">{r.count}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p>No records yet.</p>
  );
}
async function Content() {
  const s = await getSessionContext();
  const d = await loadResearchInsights(getDb(), s.workspace.id);
  return (
    <>
      <ResearchSection id="research-phases" title="Research phases">
        <Counts rows={d.investigations.map((r) => ({ label: r.phase, count: r._count }))} />
        <p className="mt-3">{d.decisions} attributable research decisions recorded.</p>
      </ResearchSection>
      <ResearchSection id="finding-states" title="Finding review">
        <Counts rows={d.findings.map((r) => ({ label: r.status, count: r._count }))} />
      </ResearchSection>
      <ResearchSection id="evidence-quality" title="Evidence review and provenance">
        <Counts rows={d.evidence.map((r) => ({ label: r.redactionStatus, count: r._count }))} />
        <p className="mt-3">
          {d.missingProvenance} retained evidence items have an unknown collector or collection
          date.
        </p>
        <Counts
          rows={d.assessments.map((r) => ({
            label: `ASSESSMENT_${r.reviewStatus}`,
            count: r._count,
          }))}
        />
      </ResearchSection>
      <ResearchSection id="knowledge-review" title="Knowledge review">
        <Counts rows={d.knowledge.map((r) => ({ label: r.reviewStatus, count: r._count }))} />
        <p className="mt-3">{d.indexedDocuments} reviewed documents have searchable chunks.</p>
      </ResearchSection>
      <ResearchSection id="import-review" title="Imported result review">
        <Counts rows={d.importRecords.map((r) => ({ label: r.status, count: r._count }))} />
      </ResearchSection>
      <ResearchSection id="remediation-progress" title="Remediation progress">
        <Counts rows={d.remediation.map((r) => ({ label: r.status, count: r._count }))} />
      </ResearchSection>
      <ResearchSection id="external-outcomes" title="Human-recorded external outcomes">
        <Counts rows={d.outcomes.map((r) => ({ label: r.outcome, count: r._count }))} />
      </ResearchSection>
      <ResearchSection id="ai-execution" title="AI execution">
        <Counts rows={d.tasks.map((r) => ({ label: r.status, count: r._count }))} />
        <p className="mt-3">
          {d.tasks
            .reduce((n, t) => n + (t._sum.inputTokens ?? 0) + (t._sum.outputTokens ?? 0), 0)
            .toLocaleString()}{" "}
          captured provider tokens ·{" "}
          {d.tasks.reduce((n, t) => n + (t._sum.reservedTokens ?? 0), 0).toLocaleString()} reserved
          tokens.
        </p>
      </ResearchSection>
    </>
  );
}
