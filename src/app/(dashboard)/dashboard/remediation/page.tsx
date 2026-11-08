import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaRemediationStore } from "@/modules/remediation/infrastructure/prisma-remediation-store";
import { canReviewResearch } from "@/modules/shared/application/actor";
import {
  createRemediationAction,
  changeRemediationAction,
  requestRetestAction,
  reviewRetestAction,
  closeRemediationAction,
  recordOutcomeAction,
} from "./actions";
export const metadata = { title: "Remediation and outcomes" };
export default function RemediationPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Remediation & outcomes"
        description="Follow a finding through to the fix. Create a plan, track progress, record an authorized manual retest, and add any submission outcome so the story has an ending."
      />
      <Suspense fallback={<p>Loading research outcomes…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  const s = await getSessionContext();
  const data = await new PrismaRemediationStore(getDb()).list(s.workspace.id);
  const reviewer = canReviewResearch(s.role);
  const rationale = {
    name: "rationale",
    label: "Human rationale",
    type: "textarea" as const,
    required: true,
    maxLength: 8000,
  };
  const assets = data.engagements.flatMap((e) =>
    e.assets.map((a) => ({ value: a.id, label: `${e.name} · ${a.target.name}` })),
  );
  const scopes = data.engagements.flatMap((e) =>
    e.assets.flatMap((a) =>
      a.authorizations.map((auth) => ({
        value: auth.scopeVersionId,
        label: `${a.target.name} · scope v${auth.scope.version} (${auth.scope.status})`,
      })),
    ),
  );
  return (
    <>
      <ResearchSection id="plan-remediation" title="Plan remediation">
        <ResearchActionForm
          action={createRemediationAction}
          submitLabel="Create plan"
          fields={[
            {
              name: "findingId",
              label: "Confirmed finding",
              required: true,
              options: data.findings
                .filter((f) => ["CONFIRMED", "REPORTABLE"].includes(f.status))
                .map((f) => ({ value: f.id, label: f.title })),
            },
            { name: "title", label: "Plan title", required: true, maxLength: 200 },
            {
              name: "description",
              label: "Planned fix and rationale",
              type: "textarea",
              required: true,
              maxLength: 8000,
            },
          ]}
        />
      </ResearchSection>
      {data.plans.map((p) => {
        const f = data.findings.find((f) => f.id === p.findingId);
        return (
          <ResearchSection key={p.id} id={`plan-${p.id}`} title={p.title}>
            <p>{p.description}</p>
            <p>
              {p.status} ·{" "}
              <Link className="text-primary underline" href={`/dashboard/findings/${p.findingId}`}>
                {f?.title ?? "View finding"}
              </Link>
            </p>
            {["PLANNED", "IN_PROGRESS", "READY_FOR_RETEST"].includes(p.status) ? (
              <ResearchActionForm
                action={changeRemediationAction}
                hidden={{ planId: p.id, expectedStatus: p.status }}
                submitLabel="Update progress"
                fields={[
                  {
                    name: "status",
                    label: "Remediation progress",
                    options: ["PLANNED", "IN_PROGRESS", "READY_FOR_RETEST"].map((value) => ({
                      value,
                      label: value.replaceAll("_", " "),
                    })),
                    defaultValue: p.status,
                  },
                  rationale,
                ]}
              />
            ) : null}
            {reviewer && p.status === "READY_FOR_RETEST" ? (
              <ResearchActionForm
                action={requestRetestAction}
                hidden={{ planId: p.id }}
                submitLabel="Document manual retest request"
                fields={[
                  { name: "assetId", label: "Engagement asset", required: true, options: assets },
                  {
                    name: "scopeVersionId",
                    label: "Exact authorization scope",
                    required: true,
                    options: scopes,
                  },
                  {
                    name: "activity",
                    label: "Permitted manual activity",
                    options: [
                      { value: "ACTIVE_TEST", label: "Manual active test" },
                      { value: "PASSIVE_FETCH", label: "Manual passive fetch" },
                    ],
                  },
                  rationale,
                ]}
              />
            ) : null}
            {p.retests.map((r) => (
              <div className="mt-4 rounded-lg border border-border p-4" key={r.id}>
                <p>
                  Manual retest · {r.requestedAt.toISOString().slice(0, 10)} ·{" "}
                  {r.conclusion ?? "Awaiting supplied results"}
                </p>
                <p className="text-sm">{r.requestRationale}</p>
                {r.suppliedResults ? (
                  <p className="whitespace-pre-wrap">{r.suppliedResults}</p>
                ) : null}
                {r.reviewRationale ? <p>{r.reviewRationale}</p> : null}
                {reviewer && !r.reviewedAt && p.status !== "CLOSED" ? (
                  <ResearchActionForm
                    action={reviewRetestAction}
                    hidden={{ retestId: r.id }}
                    submitLabel="Review supplied results"
                    fields={[
                      {
                        name: "suppliedResults",
                        label: "Supplied retest results",
                        type: "textarea",
                        required: true,
                        maxLength: 50000,
                      },
                      {
                        name: "evidenceIds",
                        label: "Approved evidence IDs",
                        required: true,
                        help: "Copy evidence IDs from this finding's investigation and separate them with commas.",
                      },
                      {
                        name: "conclusion",
                        label: "Human conclusion",
                        options: ["INCONCLUSIVE", "PERSISTS", "RESOLVED"].map((value) => ({
                          value,
                          label: value,
                        })),
                      },
                      rationale,
                    ]}
                  />
                ) : null}
              </div>
            ))}
            {reviewer && p.status === "VERIFIED" && f ? (
              <ResearchActionForm
                action={closeRemediationAction}
                hidden={{ planId: p.id, expectedUpdatedAt: f.updatedAt.toISOString() }}
                submitLabel="Approve finding closure"
                fields={[rationale]}
              />
            ) : null}
          </ResearchSection>
        );
      })}
      <ResearchSection id="record-outcome" title="Record an external outcome">
        <ResearchActionForm
          action={recordOutcomeAction}
          submitLabel="Record manual outcome"
          fields={[
            {
              name: "findingId",
              label: "Finding (optional with report)",
              options: [
                { value: "", label: "Select a finding" },
                ...data.findings
                  .filter((f) => ["CONFIRMED", "REPORTABLE", "CLOSED"].includes(f.status))
                  .map((f) => ({ value: f.id, label: f.title })),
              ],
            },
            {
              name: "reportId",
              label: "Approved report (optional with finding)",
              options: [
                { value: "", label: "Select a report" },
                ...data.reports
                  .filter((r) => ["APPROVED", "EXPORTED"].includes(r.status))
                  .map((r) => ({ value: r.id, label: r.title })),
              ],
            },
            {
              name: "outcome",
              label: "External outcome",
              options: [
                "SUBMITTED",
                "ACCEPTED",
                "DUPLICATE",
                "INFORMATIONAL",
                "REJECTED",
                "WITHDRAWN",
              ].map((value) => ({ value, label: value })),
            },
            { name: "destination", label: "Destination", required: true, maxLength: 300 },
            { name: "externalReference", label: "External reference", maxLength: 500 },
            {
              name: "occurredAt",
              label: "Actual event date and time",
              type: "datetime-local",
              required: true,
            },
            rationale,
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Use these records to note what you submitted or heard back outside Sentinel. The app keeps
          the history; you handle the submission.
        </p>
      </ResearchSection>
      <ResearchSection id="outcome-history" title="Outcome history">
        {data.submissions.length ? (
          <ul>
            {data.submissions.map((e) => (
              <li key={e.id} className="border-b border-border py-3">
                <p>
                  {e.outcome} · {e.destination} · {e.occurredAt.toISOString().slice(0, 10)}
                </p>
                <p>{e.externalReference}</p>
                <p>{e.rationale}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No submission outcomes yet. Record one above when you&apos;ve submitted the work or
            heard back.
          </p>
        )}
      </ResearchSection>
    </>
  );
}
