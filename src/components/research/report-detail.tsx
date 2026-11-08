import Link from "next/link";

import { ReportStatusAction, ReportRevisionForm } from "@/components/research/report-actions";
import { ReportStatusBadge } from "@/components/research/report-badges";
import { FindingStatusBadge, EvidenceTypeLabel } from "@/components/research/phase6-badges";
import { Disclosure } from "@/components/shared/disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/modules/reports/domain/report";
import type { ReportDetail } from "@/modules/reports/application/ports";

const STATUS_GUIDANCE: Record<
  ReportStatus,
  { title: string; description: string; variant: "default" | "warning" | "success" }
> = {
  DRAFT: {
    title: "Draft report",
    description:
      "Build the draft from confirmed or reportable findings and approved evidence. Edit the Markdown, save a revision, then send it for human review when you're ready.",
    variant: "default",
  },
  UNDER_REVIEW: {
    title: "Report under review",
    description:
      "A human reviewer needs to check that this report is ready for approval. If it needs changes, return it to Draft before editing.",
    variant: "warning",
  },
  APPROVED: {
    title: "Report approved",
    description:
      "This report is approved and ready to export as Markdown. Exporting records the event while keeping every saved revision.",
    variant: "success",
  },
  EXPORTED: {
    title: "Report exported",
    description:
      "Your approved Markdown export is ready to download again whenever you need it. You can also archive the report.",
    variant: "success",
  },
  ARCHIVED: {
    title: "Report archived",
    description:
      "This report is archived. You can read its history, but editing and export are closed.",
    variant: "default",
  },
};

export function ReportDetailView({
  report,
  isReviewer,
}: {
  report: ReportDetail;
  isReviewer: boolean;
}) {
  const latestRevision = report.revisions[0] ?? null;
  const guidance = STATUS_GUIDANCE[report.status];

  return (
    <div className="page-stack">
      <Link href="/dashboard/reports" className="record-link w-fit text-sm text-text-secondary">
        All reports
      </Link>
      <PageHeader
        title={report.title}
        description={
          <>
            <p className="mb-3">
              Shape the write-up, check its findings and evidence, then save a revision. Send it for
              human review when it&apos;s ready; approval unlocks export.
            </p>
            <Link
              href={`/dashboard/investigations/${report.investigationId}`}
              className="record-link"
            >
              {report.investigationTitle}
            </Link>
          </>
        }
        metadata={
          <div className="flex flex-wrap items-center gap-4">
            <ReportStatusBadge status={report.status} />
            <span className="text-xs text-text-secondary">
              {report.findingCount} finding{report.findingCount === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-text-secondary">
              Latest revision v{report.latestRevisionVersion}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {report.status === "DRAFT" ? (
              <ReportStatusAction
                kind="submit"
                reportId={report.id}
                investigationId={report.investigationId}
              />
            ) : null}
            {report.status === "UNDER_REVIEW" && isReviewer ? (
              <ReportStatusAction
                kind="approve"
                reportId={report.id}
                investigationId={report.investigationId}
              />
            ) : null}
            {report.status === "UNDER_REVIEW" ? (
              <ReportStatusAction
                kind="reopen"
                reportId={report.id}
                investigationId={report.investigationId}
              />
            ) : null}
            {report.status === "APPROVED" ? (
              <>
                <ReportStatusAction
                  kind="export-markdown"
                  reportId={report.id}
                  investigationId={report.investigationId}
                />
                <ReportStatusAction
                  kind="export-pdf"
                  reportId={report.id}
                  investigationId={report.investigationId}
                />
              </>
            ) : null}
            {report.status === "EXPORTED" ? (
              <>
                <Button asChild size="sm">
                  <Link href={`/api/reports/${report.id}/export`}>Download Markdown</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/api/reports/${report.id}/export?format=pdf`}>Download PDF</Link>
                </Button>
              </>
            ) : null}
            {report.status !== "ARCHIVED" ? (
              <ReportStatusAction
                kind="archive"
                reportId={report.id}
                investigationId={report.investigationId}
              />
            ) : null}
          </div>
        }
      />

      <Alert variant={guidance.variant}>
        <AlertTitle>{guidance.title}</AlertTitle>
        <AlertDescription>{guidance.description}</AlertDescription>
      </Alert>

      <ResearchSection id="report-context" title="Report details">
        <MetadataList
          items={[
            {
              label: "Project",
              value: (
                <Link href={`/dashboard/projects/${report.projectId}`} className="record-link">
                  Open project
                </Link>
              ),
            },
            {
              label: "Investigation",
              value: (
                <Link
                  href={`/dashboard/investigations/${report.investigationId}`}
                  className="record-link"
                >
                  {report.investigationTitle}
                </Link>
              ),
            },
            {
              label: "Template",
              value: report.templateName
                ? `${report.templateName} (v${report.templateVersion ?? 1})`
                : "Built-in standard sections",
            },
            { label: "Canonical format", value: "Markdown" },
            { label: "Report ID", value: report.id, technical: true },
            { label: "Created", value: <ResearchTime date={report.createdAt} precision="time" /> },
            {
              label: "Approved",
              value: (
                <ResearchTime date={report.approvedAt} precision="time" empty="Not approved" />
              ),
            },
            {
              label: "Approved by",
              value: report.approvedBy ?? "Not approved",
              technical: Boolean(report.approvedBy),
            },
            {
              label: "Archived",
              value: (
                <ResearchTime date={report.archivedAt} precision="time" empty="Not archived" />
              ),
            },
          ]}
        />
      </ResearchSection>

      <ResearchSection
        id="report-content"
        title="Report content"
        description="Edit the write-up in Markdown. Each save creates a new revision, keeping earlier versions available in the history."
        action={
          latestRevision ? (
            <span className="text-xs text-text-secondary">
              v{latestRevision.version} ·{" "}
              {latestRevision.generatedByType === "HUMAN" ? "Human" : "AI-assisted"}
            </span>
          ) : null
        }
      >
        {report.status === "DRAFT" && latestRevision ? (
          <Disclosure title="Edit and save a new revision" className="mb-5">
            <ReportRevisionForm
              reportId={report.id}
              investigationId={report.investigationId}
              content={latestRevision.content}
              version={latestRevision.version}
            />
          </Disclosure>
        ) : null}
        {latestRevision ? (
          <pre className="max-h-[36rem] overflow-auto rounded-sm border border-control-border bg-surface-elevated p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {latestRevision.content}
          </pre>
        ) : (
          <EmptyState
            title="No revision saved"
            description="Save your first revision, then send the report for review when the write-up is ready."
          />
        )}
      </ResearchSection>

      <ResearchSection
        id="report-findings"
        title="Included findings"
        description="Include findings a human reviewer has confirmed or marked reportable. Other findings need verification first."
      >
        {report.findings.length ? (
          <RecordTable caption="Findings included in this report" minWidth="34rem">
            <thead>
              <tr>
                <th scope="col">Finding</th>
                <th scope="col">Status</th>
                <th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {report.findings.map((finding) => (
                <tr key={finding.findingId}>
                  <td>
                    <Link href={`/dashboard/findings/${finding.findingId}`} className="record-link">
                      {finding.title}
                    </Link>
                  </td>
                  <td>
                    <FindingStatusBadge status={finding.status} />
                  </td>
                  <td className="font-mono text-xs">{finding.position + 1}</td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        ) : (
          <EmptyState
            title="No findings selected"
            description="A report needs at least one confirmed or reportable finding. Verify a finding in the investigation first."
          />
        )}
      </ResearchSection>

      <ResearchSection
        id="report-evidence"
        title="Evidence references"
        description="The latest saved revision records these evidence versions and checksums, so you can see exactly which files support it."
      >
        {latestRevision?.evidenceSnapshot.length ? (
          <RecordTable caption="Evidence references in this report" minWidth="44rem">
            <thead>
              <tr>
                <th scope="col">Evidence</th>
                <th scope="col">Type</th>
                <th scope="col">Relationship</th>
                <th scope="col">Version</th>
                <th scope="col">Checksum</th>
              </tr>
            </thead>
            <tbody>
              {latestRevision.evidenceSnapshot.map((evidence) => (
                <tr key={evidence.evidenceId}>
                  <td className="max-w-72">
                    <Link
                      href={`/dashboard/evidence/${evidence.evidenceId}`}
                      className="record-link break-words"
                    >
                      {evidence.title}
                    </Link>
                    <div className="mt-2">
                      <EvidenceReference id={evidence.evidenceId} />
                    </div>
                  </td>
                  <td>
                    <EvidenceTypeLabel type={evidence.evidenceType} />
                  </td>
                  <td className="text-xs text-text-secondary">
                    {evidence.relationshipType.replaceAll("_", " ").toLowerCase()}
                  </td>
                  <td className="font-mono text-xs">v{evidence.version}</td>
                  <td className="record-metadata max-w-52 break-all">{evidence.checksum}</td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        ) : (
          <EmptyState
            title="No evidence references"
            description="This revision has no approved evidence references yet. Check the findings' evidence and save a new revision when it's ready."
          />
        )}
      </ResearchSection>

      <ResearchSection
        id="report-revisions"
        title="Revision history"
        description="Revisit any saved version here. Each revision keeps the write-up, findings, and evidence exactly as they were when you saved it."
      >
        {report.revisions.length ? (
          <div className="flex flex-col gap-3">
            {report.revisions.map((revision) => (
              <Disclosure
                key={revision.id}
                title={`Revision v${revision.version} · ${revision.generatedByType === "HUMAN" ? "Human" : "AI-assisted"} · ${revision.createdAt.toISOString()}`}
              >
                <div className="mb-4">
                  <MetadataList
                    items={[
                      { label: "Findings", value: String(revision.findingSnapshot.length) },
                      { label: "Evidence", value: String(revision.evidenceSnapshot.length) },
                      {
                        label: "Created",
                        value: <ResearchTime date={revision.createdAt} precision="time" />,
                      },
                      {
                        label: "Created by",
                        value: revision.createdBy ?? "Not recorded",
                        technical: Boolean(revision.createdBy),
                      },
                      { label: "Revision ID", value: revision.id, technical: true },
                    ]}
                  />
                </div>
                <pre className="max-h-96 overflow-auto rounded-sm border border-control-border bg-surface p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {revision.content}
                </pre>
              </Disclosure>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No revisions recorded"
            description="Save the first revision to start this report's history. Later saves will appear alongside it."
          />
        )}
      </ResearchSection>

      <p className="text-xs text-text-secondary">
        Current status: {REPORT_STATUS_LABELS[report.status]}. Approval is reserved for an owner,
        administrator, or reviewer.
      </p>
    </div>
  );
}
