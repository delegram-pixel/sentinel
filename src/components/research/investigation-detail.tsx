import Link from "next/link";

import { HypothesisForm } from "@/components/research/hypothesis-form";
import {
  HypothesisStatusBadge,
  InvestigationStatusBadge,
} from "@/components/research/investigation-badges";
import {
  InvestigationStatusForm,
  HypothesisStatusForm,
} from "@/components/research/investigation-status-actions";
import { ObservationForm } from "@/components/research/observation-form";
import { ResearchWorkbench } from "@/components/research/research-workbench";
import { SessionSummaryForm } from "@/components/research/session-summary-form";
import { Disclosure } from "@/components/shared/disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchPoints } from "@/components/shared/research-points";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { SourceLabel } from "@/components/shared/status-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FindingStatusBadge,
  RedactionStatusBadge,
  EvidenceTypeLabel,
  SeverityBadge,
} from "@/components/research/phase6-badges";
import type { EvidenceRow } from "@/modules/evidence/application/ports";
import type { FindingRow } from "@/modules/findings/application/ports";
import type { InvestigationDetail } from "@/modules/research/application/ports";
import {
  CONFIDENCE_LABEL_LABELS,
  HYPOTHESIS_OBSERVATION_RELATIONSHIP_LABELS,
  OBSERVATION_TYPE_LABELS,
} from "@/modules/research/domain/investigation";

function InvestigationContext({ investigation }: { investigation: InvestigationDetail }) {
  return (
    <div className="flex flex-col gap-7">
      <ResearchSection id="investigation-context" title="Context">
        <MetadataList
          items={[
            {
              label: "Project",
              value: (
                <Link
                  className="record-link"
                  href={`/dashboard/projects/${investigation.projectId}`}
                >
                  {investigation.projectName}
                </Link>
              ),
            },
            {
              label: "Target",
              value: (
                <>
                  <Link
                    className="record-link"
                    href={`/dashboard/projects/${investigation.projectId}/targets/${investigation.targetId}`}
                  >
                    {investigation.targetName}
                  </Link>
                  <p className="record-metadata mt-1">{investigation.targetAssetIdentifier}</p>
                </>
              ),
            },
            { label: "Investigation ID", value: investigation.id, technical: true },
            {
              label: "Started",
              value: (
                <ResearchTime date={investigation.startedAt} precision="time" empty="Not started" />
              ),
            },
            {
              label: "Completed",
              value: (
                <ResearchTime
                  date={investigation.completedAt}
                  precision="time"
                  empty="Not completed"
                />
              ),
            },
            {
              label: "Updated",
              value: <ResearchTime date={investigation.updatedAt} precision="time" />,
            },
          ]}
        />
      </ResearchSection>
      <nav aria-label="Research document" className="flex flex-col gap-1 text-sm">
        {[
          ["objective", "Objective", null],
          ["observations", "Observations", investigation.observationCount],
          ["hypotheses", "Hypotheses", investigation.hypothesisCount],
          ["evidence-references", "Evidence", null],
          ["session-summaries", "Session history", investigation.summaryCount],
        ].map(([id, label, count]) => (
          <a
            key={id}
            href={`#${id}`}
            className="flex min-h-10 items-center justify-between gap-3 text-text-secondary hover:text-primary"
          >
            {label}
            {count !== null ? <span className="font-mono text-xs">{count}</span> : null}
          </a>
        ))}
      </nav>
    </div>
  );
}

function AssistanceContext({ investigation }: { investigation: InvestigationDetail }) {
  const latest = investigation.summaries[0];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="section-title">Assistance for this investigation</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Ask a contextual question or run a bounded analysis. AI output remains advisory and needs
          your review.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={`/dashboard/investigations/${investigation.id}/ai`}>Open AI workspace</Link>
        </Button>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="section-title">Current objective</h3>
        <p className="research-copy mt-2 text-sm text-text-secondary">
          {investigation.objective ??
            "No objective recorded. Add one to keep the research focused."}
        </p>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="section-title">Session continuity</h3>
        {latest ? (
          <div className="mt-3 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <SourceLabel source={latest.generatedByType === "AI" ? "ai" : "researcher"} />
              <ResearchTime date={latest.createdAt} precision="time" />
            </div>
            <p className="research-copy text-sm text-text-secondary">{latest.summary}</p>
            <ResearchPoints title="Unresolved questions" values={latest.unresolvedQuestions} />
            <ResearchPoints
              title="Saved next actions"
              values={latest.nextActions}
              emptyLabel="No next actions saved."
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            Save a session summary to keep open questions and next actions here.
          </p>
        )}
      </div>
    </div>
  );
}

export function InvestigationDetailView({
  investigation,
  canEdit,
  findings,
  evidence,
}: {
  investigation: InvestigationDetail;
  canEdit: boolean;
  findings: FindingRow[];
  evidence: EvidenceRow[];
}) {
  const editable = canEdit && investigation.status !== "ARCHIVED";
  const investigationId = investigation.id;
  const projectId = investigation.projectId;
  return (
    <div className="page-stack">
      <Link
        href={`/dashboard/projects/${projectId}/investigations`}
        className="record-link w-fit text-sm text-text-secondary"
      >
        Investigations in {investigation.projectName}
      </Link>
      <PageHeader
        title={investigation.title}
        description={investigation.description ?? "No investigation description recorded."}
        metadata={
          <div className="flex flex-wrap items-center gap-4">
            <InvestigationStatusBadge status={investigation.status} />
            {investigation.category ? (
              <span className="text-xs text-text-secondary">{investigation.category}</span>
            ) : null}
          </div>
        }
        actions={
          editable ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/investigations/${investigationId}/edit`}>
                Edit investigation
              </Link>
            </Button>
          ) : null
        }
      />
      {!editable ? (
        <Alert>
          <AlertTitle>Research record archived</AlertTitle>
          <AlertDescription>
            {investigation.status === "ARCHIVED"
              ? "This investigation’s history remains available. It cannot be changed."
              : "This investigation belongs to an archived project and cannot be changed."}
          </AlertDescription>
        </Alert>
      ) : null}
      <ResearchWorkbench
        context={<InvestigationContext investigation={investigation} />}
        assistant={<AssistanceContext investigation={investigation} />}
      >
        <ResearchSection id="objective" title="Research objective">
          <p className="research-copy text-base">
            {investigation.objective ??
              "No objective recorded yet. Define the question you want this investigation to answer."}
          </p>
          {editable ? (
            <Disclosure title="Change investigation status" className="mt-6">
              <InvestigationStatusForm
                investigationId={investigationId}
                projectId={projectId}
                currentStatus={investigation.status}
              />
            </Disclosure>
          ) : null}
        </ResearchSection>
        <ResearchSection
          id="observations"
          title="Observations"
          description="Record what you observed. Keep interpretations and suspected issues in hypotheses."
        >
          {editable ? (
            <Disclosure title="Add observation">
              <ObservationForm
                mode="create"
                investigationId={investigationId}
                projectId={projectId}
              />
            </Disclosure>
          ) : null}
          {investigation.observations.length === 0 ? (
            <EmptyState
              title="No observations recorded"
              description="Add the response, behaviour, or result you observed, together with its source."
            />
          ) : (
            investigation.observations.map((observation) => (
              <article
                key={observation.id}
                id={`observation-${observation.id}`}
                className="research-record scroll-mt-24"
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <SourceLabel source="researcher" />
                  <EvidenceReference id={observation.id} label="Observation" />
                  <ResearchTime date={observation.createdAt} precision="time" />
                </div>
                <h3 className="text-base font-medium break-words">{observation.title}</h3>
                <p className="research-copy mt-3 text-sm">{observation.description}</p>
                <MetadataList
                  className="mt-5 sm:grid-cols-2"
                  items={[
                    { label: "Type", value: OBSERVATION_TYPE_LABELS[observation.observationType] },
                    {
                      label: "Confidence",
                      value: CONFIDENCE_LABEL_LABELS[observation.confidenceLabel],
                    },
                    {
                      label: "Source",
                      value: observation.source ?? "No source recorded",
                      technical: Boolean(observation.source),
                    },
                  ]}
                />
                {editable ? (
                  <Disclosure title={`Edit observation: ${observation.title}`} className="mt-5">
                    <ObservationForm
                      mode="edit"
                      investigationId={investigationId}
                      projectId={projectId}
                      observation={observation}
                    />
                  </Disclosure>
                ) : null}
              </article>
            ))
          )}
        </ResearchSection>
        <ResearchSection
          id="hypotheses"
          title="Hypotheses"
          description="Track suspected issues, supporting observations, and the information still needed for verification."
        >
          {editable ? (
            <Disclosure title="Add hypothesis">
              <HypothesisForm
                mode="create"
                investigationId={investigationId}
                projectId={projectId}
                observations={investigation.observations}
              />
            </Disclosure>
          ) : null}
          {investigation.hypotheses.length === 0 ? (
            <EmptyState
              title="No hypotheses recorded"
              description="State a suspected issue and connect the observations that support or contradict it."
            />
          ) : (
            investigation.hypotheses.map((hypothesis) => (
              <article
                key={hypothesis.id}
                id={`hypothesis-${hypothesis.id}`}
                className="research-record scroll-mt-24"
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <HypothesisStatusBadge status={hypothesis.status} />
                  <SourceLabel source="researcher" />
                  <EvidenceReference id={hypothesis.id} label="Hypothesis" />
                </div>
                <h3 className="text-base font-medium break-words">{hypothesis.title}</h3>
                <p className="research-copy mt-3 text-sm">{hypothesis.description}</p>
                <MetadataList
                  className="mt-5 sm:grid-cols-2"
                  items={[
                    {
                      label: "Category",
                      value: hypothesis.vulnerabilityCategory ?? "Not recorded",
                    },
                    {
                      label: "Updated",
                      value: <ResearchTime date={hypothesis.updatedAt} precision="time" />,
                    },
                  ]}
                />
                <div className="mt-5">
                  <h4 className="mb-2 text-xs font-medium">Missing information</h4>
                  <p className="research-copy text-sm text-text-secondary">
                    {hypothesis.missingInformation ?? "No missing information recorded."}
                  </p>
                </div>
                <div className="mt-5">
                  <h4 className="mb-2 text-xs font-medium">Linked observations</h4>
                  {hypothesis.observationLinks.length ? (
                    <ul className="flex flex-col gap-3">
                      {hypothesis.observationLinks.map((link) => (
                        <li
                          key={link.observationId}
                          className="grid min-w-0 gap-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]"
                        >
                          <span className="text-xs text-text-secondary">
                            {HYPOTHESIS_OBSERVATION_RELATIONSHIP_LABELS[link.relationshipType]}
                          </span>
                          <div className="min-w-0">
                            <a
                              className="record-link break-words"
                              href={`#observation-${link.observationId}`}
                            >
                              {link.observation.title}
                            </a>
                            <div className="mt-1">
                              <EvidenceReference id={link.observationId} label="Observation" />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-secondary">No observations linked.</p>
                  )}
                </div>
                {editable ? (
                  <>
                    <Disclosure title={`Review status: ${hypothesis.title}`} className="mt-5">
                      <SourceLabel source="human-review" />
                      <div className="mt-3">
                        <HypothesisStatusForm
                          investigationId={investigationId}
                          projectId={projectId}
                          hypothesisId={hypothesis.id}
                          currentStatus={hypothesis.status}
                        />
                      </div>
                    </Disclosure>
                    <Disclosure title={`Edit hypothesis: ${hypothesis.title}`}>
                      <HypothesisForm
                        mode="edit"
                        investigationId={investigationId}
                        projectId={projectId}
                        hypothesis={hypothesis}
                      />
                    </Disclosure>
                  </>
                ) : null}
              </article>
            ))
          )}
        </ResearchSection>
        <ResearchSection
          id="findings"
          title="Findings"
          description="Candidate vulnerabilities recorded from this investigation. Only a human reviewer can confirm or mark a finding reportable."
          action={
            editable ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/findings/new?investigationId=${investigationId}`}>
                    New finding
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/reports/new?investigationId=${investigationId}`}>
                    New report
                  </Link>
                </Button>
              </div>
            ) : null
          }
        >
          {findings.length === 0 ? (
            <EmptyState
              title="No findings recorded"
              description="Create a finding when observations and evidence support a candidate vulnerability."
            />
          ) : (
            findings.map((finding) => (
              <article key={finding.id} className="research-record">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <FindingStatusBadge status={finding.status} />
                  <SeverityBadge severity={finding.severity} />
                  <span className="text-xs text-text-secondary">
                    {finding.evidenceLinkCount} evidence link(s)
                  </span>
                </div>
                <h3 className="text-base font-medium break-words">
                  <Link className="record-link" href={`/dashboard/findings/${finding.id}`}>
                    {finding.title}
                  </Link>
                </h3>
                <p className="research-copy mt-2 line-clamp-3 text-sm">{finding.description}</p>
              </article>
            ))
          )}
        </ResearchSection>
        <ResearchSection
          id="evidence-references"
          title="Evidence"
          description="Private evidence for this investigation. Files stay quarantined until a human reviewer resolves redaction."
          action={
            editable ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/evidence/upload?investigationId=${investigationId}`}>
                  Upload evidence
                </Link>
              </Button>
            ) : null
          }
        >
          {evidence.length === 0 ? (
            <EmptyState
              title="No evidence uploaded"
              description="Upload screenshots, request/response captures, logs, or documents to support findings."
            />
          ) : (
            evidence.map((item) => (
              <article key={item.id} className="research-record">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <RedactionStatusBadge status={item.redactionStatus} />
                  <EvidenceTypeLabel type={item.evidenceType} />
                  <span className="text-xs text-text-secondary">{item.fileName}</span>
                </div>
                <h3 className="text-base font-medium break-words">
                  <Link className="record-link" href={`/dashboard/evidence/${item.id}`}>
                    {item.title}
                  </Link>
                </h3>
                {item.description ? (
                  <p className="research-copy mt-2 line-clamp-3 text-sm">{item.description}</p>
                ) : null}
              </article>
            ))
          )}
        </ResearchSection>
        <ResearchSection
          id="session-summaries"
          title="Session history"
          description="Completed work, unresolved questions, and saved next actions for the next research session."
        >
          {editable ? (
            <Disclosure title="Record session summary">
              <SessionSummaryForm investigationId={investigationId} projectId={projectId} />
            </Disclosure>
          ) : null}
          {investigation.summaries.length === 0 ? (
            <EmptyState
              title="No session summaries recorded"
              description="Save what changed in this session and what still needs attention."
            />
          ) : (
            investigation.summaries.map((summary) => (
              <article key={summary.id} className="research-record">
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <SourceLabel source={summary.generatedByType === "AI" ? "ai" : "researcher"} />
                  <EvidenceReference id={summary.id} label="Session" />
                  <ResearchTime date={summary.createdAt} precision="time" />
                </div>
                {summary.model ? (
                  <p className="record-metadata mb-3">Model: {summary.model}</p>
                ) : null}
                <p className="research-copy text-sm">{summary.summary}</p>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  <ResearchPoints title="Completed work" values={summary.completedWork} />
                  <ResearchPoints title="Rejected hypotheses" values={summary.rejectedHypotheses} />
                  <ResearchPoints
                    title="Unresolved questions"
                    values={summary.unresolvedQuestions}
                  />
                  <ResearchPoints title="Next actions" values={summary.nextActions} />
                </div>
              </article>
            ))
          )}
        </ResearchSection>
      </ResearchWorkbench>
    </div>
  );
}

export function InvestigationDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading investigation">
      <span className="sr-only">Loading investigation…</span>
      <div className="page-stack" aria-hidden>
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-12 w-3/4" />
        <div className="research-workbench">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="flex flex-col gap-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
