import Link from "next/link";

import {
  DeleteEvidenceForm,
  EvidenceLinkToFindingForm,
  EvidenceMetadataForm,
  RedactionReviewForm,
  RemoveEvidenceFindingLinkButton,
} from "@/components/research/evidence-detail-actions";
import {
  EvidenceTypeLabel,
  FindingStatusBadge,
  RedactionStatusBadge,
} from "@/components/research/phase6-badges";
import { Disclosure } from "@/components/shared/disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { SourceLabel } from "@/components/shared/status-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import type { FindingStatus } from "@/modules/findings/domain/finding-status";
import type { EvidenceDetail } from "@/modules/evidence/application/ports";
import {
  EVIDENCE_LINK_RELATIONSHIP_LABELS,
  isApprovedEvidence,
} from "@/modules/evidence/domain/evidence";

function scanSummary(scanFindings: unknown): string {
  if (!scanFindings || typeof scanFindings !== "object") return "Not scanned (binary content).";
  const entries = Object.entries(scanFindings as Record<string, unknown>).filter(
    ([, value]) => typeof value === "number" && value > 0,
  );
  return entries.length
    ? entries.map(([category, value]) => `${category.replaceAll("_", " ")}: ${value}`).join(", ")
    : "No advisory matches recorded.";
}

export function EvidenceDetailView({
  evidence,
  findings,
  isReviewer,
}: {
  evidence: EvidenceDetail;
  findings: { id: string; title: string; status: FindingStatus }[];
  isReviewer: boolean;
}) {
  const approved = isApprovedEvidence(evidence.redactionStatus);
  const pendingReview = Boolean(evidence.quarantineKey) && !evidence.storageKey;
  return (
    <div className="page-stack">
      <Link href="/dashboard/evidence" className="record-link w-fit text-sm text-text-secondary">
        All evidence
      </Link>
      <PageHeader
        title={evidence.title}
        description={
          <>
            <p className="mb-3">
              Inspect the file and check its source details. A human reviewer must resolve redaction
              before this evidence can support a finding or enter AI context.
            </p>
            <Link
              href={`/dashboard/investigations/${evidence.investigationId}`}
              className="record-link"
            >
              {evidence.investigationTitle}
            </Link>
          </>
        }
        metadata={
          <div className="flex flex-wrap items-center gap-4">
            <SourceLabel source="evidence" />
            <RedactionStatusBadge status={evidence.redactionStatus} />
            <EvidenceTypeLabel type={evidence.evidenceType} />
            <EvidenceReference id={evidence.id} />
          </div>
        }
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/evidence/${evidence.id}/download`}>
              {pendingReview ? "Inspect file" : "Download evidence"}
            </a>
          </Button>
        }
      />
      <ResearchSection id="evidence-record" title="File record">
        <MetadataList
          className="sm:grid-cols-2 lg:grid-cols-3"
          items={[
            { label: "File name", value: evidence.fileName, technical: true },
            { label: "Media type", value: evidence.mimeType, technical: true },
            { label: "Size", value: formatFileSize(evidence.fileSize), technical: true },
            {
              label: "Source",
              value: evidence.source ?? "Not recorded",
              technical: Boolean(evidence.source),
            },
            {
              label: "Recorded",
              value: <ResearchTime date={evidence.createdAt} precision="time" />,
            },
            {
              label: "Activated",
              value: (
                <ResearchTime date={evidence.activatedAt} precision="time" empty="Not activated" />
              ),
            },
            {
              label: "Redaction reviewer",
              value: evidence.redactionReviewedBy ?? "Not reviewed",
              technical: Boolean(evidence.redactionReviewedBy),
            },
            {
              label: "Reviewed",
              value: (
                <ResearchTime
                  date={evidence.redactionReviewedAt}
                  precision="time"
                  empty="Not reviewed"
                />
              ),
            },
            { label: "Version", value: evidence.version, technical: true },
            { label: "SHA-256", value: evidence.checksum, technical: true },
            ...(evidence.supersedesId
              ? [
                  {
                    label: "Supersedes",
                    value: (
                      <EvidenceReference
                        id={evidence.supersedesId}
                        href={`/dashboard/evidence/${evidence.supersedesId}`}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
        {evidence.description ? (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-medium">Description</h3>
            <p className="research-copy text-sm">{evidence.description}</p>
          </div>
        ) : null}
      </ResearchSection>
      <Alert role="note">
        <AlertTitle>Advisory sensitive-data scan</AlertTitle>
        <AlertDescription>
          <p>{scanSummary(evidence.scanFindings)}</p>
          <p className="mt-2 text-xs">
            Use the scan results to help check the file. A human reviewer decides whether redaction
            is complete and the evidence can be activated.
          </p>
        </AlertDescription>
      </Alert>
      {pendingReview ? (
        <ResearchSection
          id="evidence-redaction"
          title="Redaction review"
          description="Inspect the original file before approving it. While it's quarantined, it can't support a finding or be used in AI context."
        >
          <div className="max-w-3xl">
            <RedactionReviewForm
              evidenceId={evidence.id}
              investigationId={evidence.investigationId}
              isReviewer={isReviewer}
            />
          </div>
        </ResearchSection>
      ) : null}
      <ResearchSection
        id="evidence-metadata"
        title="Record metadata"
        description="Update the description or source here to make the file easier to understand. To change the file itself, use the replacement workflow."
      >
        <Disclosure title="Edit metadata">
          <div className="max-w-3xl">
            <EvidenceMetadataForm
              evidenceId={evidence.id}
              investigationId={evidence.investigationId}
              title={evidence.title}
              description={evidence.description}
              evidenceType={evidence.evidenceType}
              source={evidence.source}
            />
          </div>
        </Disclosure>
      </ResearchSection>
      <ResearchSection
        id="evidence-findings"
        title="Linked findings"
        description={
          approved
            ? "Connect this evidence to the finding it supports, challenges, explains, or helps reproduce."
            : "Complete the redaction review before connecting this evidence to a finding."
        }
      >
        {evidence.findingLinks.length ? (
          <RecordTable caption="Findings linked to this evidence" minWidth="38rem">
            <thead>
              <tr>
                <th scope="col">Finding</th>
                <th scope="col">Verification</th>
                <th scope="col">Relationship</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {evidence.findingLinks.map((link) => (
                <tr key={link.id}>
                  <td>
                    <Link href={`/dashboard/findings/${link.findingId}`} className="record-link">
                      {link.findingTitle}
                    </Link>
                    <div className="mt-2">
                      <EvidenceReference id={link.findingId} label="Finding" />
                    </div>
                  </td>
                  <td>
                    <FindingStatusBadge status={link.findingStatus} />
                  </td>
                  <td className="text-xs text-text-secondary">
                    {EVIDENCE_LINK_RELATIONSHIP_LABELS[link.relationshipType]}
                  </td>
                  <td>
                    <RemoveEvidenceFindingLinkButton
                      linkId={link.id}
                      evidenceId={evidence.id}
                      investigationId={evidence.investigationId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        ) : (
          <EmptyState
            title="No linked findings"
            description={
              approved
                ? "Link this record to a finding and say how it helps: support, contradiction, or useful context."
                : "Finish the redaction review first, then you can link this file to a finding."
            }
          />
        )}
        {approved && findings.length > 0 ? (
          <Disclosure title="Link to a finding" className="mt-5">
            <EvidenceLinkToFindingForm
              evidenceId={evidence.id}
              investigationId={evidence.investigationId}
              findings={findings}
            />
          </Disclosure>
        ) : null}
      </ResearchSection>
      <ResearchSection id="evidence-danger" title="Evidence retention">
        <p className="mb-5 max-w-2xl text-sm text-text-secondary">
          Deleting removes the stored file and marks this record as deleted. Remove any finding
          links first, and check that you&apos;re ready to lose the file.
        </p>
        <DeleteEvidenceForm evidenceId={evidence.id} investigationId={evidence.investigationId} />
      </ResearchSection>
    </div>
  );
}
