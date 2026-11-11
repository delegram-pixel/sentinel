import Link from "next/link";
import { JobRefresh } from "@/components/research/job-refresh";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";
import { cancelJobAction, queueAnalysisAction, reconcileUsageAction } from "./actions";
export const metadata = { title: "Background work" };
export default function TasksPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Background work"
        description="Check on queued analysis, imports, and document processing. Open completed AI results or cancel work you no longer need. Coffee breaks don't need a progress bar."
      />
      <Suspense fallback={<p>Loading work…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  const s = await getSessionContext();
  const [jobs, investigations, uncertain] = await Promise.all([
    new PrismaJobStore(getDb()).list(s.workspace.id),
    new PrismaResearchStore(getDb()).listInvestigations(s.workspace.id),
    new PrismaAIStore(getDb()).listUncertainUsage(s.workspace.id),
  ]);
  return (
    <>
      <JobRefresh active={jobs.some((j) => ["QUEUED", "RUNNING"].includes(j.status))} />
      <ResearchSection id="queue-analysis" title="Request analysis">
        <ResearchActionForm
          action={queueAnalysisAction}
          hidden={{ operationKey: randomUUID() }}
          submitLabel="Queue analysis"
          fields={[
            {
              name: "investigationId",
              label: "Investigation",
              required: true,
              options: investigations
                .filter((i) => i.status !== "ARCHIVED")
                .map((i) => ({ value: i.id, label: i.title })),
            },
            {
              name: "taskType",
              label: "Analysis",
              options: [
                { value: "RECON_ANALYSIS", label: "Research context" },
                { value: "HYPOTHESIS_GENERATION", label: "Develop hypotheses" },
                { value: "SESSION_SUMMARY", label: "Summarise research" },
                { value: "PATTERN_ANALYSIS", label: "Analyse patterns" },
                { value: "EVIDENCE_REVIEW", label: "Assess evidence" },
                { value: "FALSE_POSITIVE_REVIEW", label: "Independent verification" },
                { value: "REPORT_GENERATION", label: "Draft report from approved findings" },
              ],
            },
            {
              name: "mode",
              label: "Research mode",
              options: [
                { value: "GUIDED", label: "Guided" },
                { value: "DELEGATED", label: "Delegated analysis" },
              ],
            },
            {
              name: "workflow",
              label: "Analysis stages",
              options: [
                { value: "", label: "Single selected analysis" },
                { value: "CONTEXT_HYPOTHESES", label: "Context → Patterns → Hypotheses" },
                { value: "EVIDENCE_VERIFICATION", label: "Evidence → Independent verification" },
                {
                  value: "COLLABORATIVE_RESEARCH",
                  label: "Analysis → Second opinion → Conclusion review",
                },
              ],
            },
          ]}
        />
      </ResearchSection>
      <ResearchSection id="background-work" title="Work history">
        {jobs.length ? (
          <ul>
            {jobs.map((j) => (
              <li className="border-b border-border py-4" key={j.id}>
                <p>
                  {j.kind.replaceAll("_", " ")} · {j.status} · {j.progress}% · Attempt {j.attempts}
                </p>
                {j.kind === "AI_TASK" &&
                typeof j.payload === "object" &&
                j.payload &&
                "investigationId" in j.payload ? (
                  <Link
                    className="text-primary underline"
                    href={`/dashboard/investigations/${String(j.payload.investigationId)}/ai#ai-task-history`}
                  >
                    View analytical results
                  </Link>
                ) : null}
                {j.failureCode ? <p className="text-sm text-danger">{j.failureCode}</p> : null}
                {["QUEUED", "RUNNING"].includes(j.status) ? (
                  <ResearchActionForm
                    action={cancelJobAction}
                    hidden={{ jobId: j.id }}
                    fields={[]}
                    submitLabel="Cancel work"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No background work yet. Queue an analysis above, or start work from an investigation.
          </p>
        )}
      </ResearchSection>
      {uncertain.length ? (
        <ResearchSection id="uncertain-ai-usage" title="Uncertain provider usage">
          {uncertain.map((t) => (
            <div key={t.id} className="border-b border-border py-4">
              <p className="break-all">
                Task {t.id} · {t.status} · {t.reservedTokens.toLocaleString()} tokens reserved
              </p>
              {["OWNER", "ADMIN"].includes(s.role) ? (
                <ResearchActionForm
                  action={reconcileUsageAction}
                  hidden={{ taskId: t.id }}
                  submitLabel="Reconcile provider usage"
                  fields={[
                    { name: "inputTokens", label: "Total billed input tokens", required: true },
                    { name: "outputTokens", label: "Total billed output tokens", required: true },
                    { name: "costUsd", label: "Verified total cost in USD (optional)" },
                    {
                      name: "providerReference",
                      label: "Provider ledger reference",
                      required: true,
                      maxLength: 300,
                    },
                    {
                      name: "rationale",
                      label: "Reconciliation rationale",
                      type: "textarea",
                      required: true,
                      maxLength: 8000,
                    },
                  ]}
                />
              ) : (
                <p>A workspace owner or administrator can reconcile this reservation.</p>
              )}
            </div>
          ))}
        </ResearchSection>
      ) : null}
    </>
  );
}
