import Link from "next/link";

import {
  DuplicateConfirmationForm,
  EvidenceLinkForm,
  FindingStatusForm,
  RemoveEvidenceLinkButton,
  SeverityAssessmentForm,
  VerificationReviewForm,
} from "@/components/research/finding-actions";
import {
  EvidenceTypeLabel,
  FindingStatusBadge,
  RedactionStatusBadge,
  SeverityBadge,
} from "@/components/research/phase6-badges";
import { Disclosure } from "@/components/shared/disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchPoints } from "@/components/shared/research-points";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { SourceLabel } from "@/components/shared/status-label";
import { Button } from "@/components/ui/button";
import type {
  ApprovedEvidenceRow,
  DuplicateCandidate,
  FindingDetail,
} from "@/modules/findings/application/ports";
import { FINDING_STATUS_LABELS, RESOLUTION_REASON_LABELS } from "@/modules/findings/domain/finding";
import { EVIDENCE_LINK_RELATIONSHIP_LABELS } from "@/modules/evidence/domain/evidence";
import { VERIFICATION_CONCLUSION_LABELS } from "@/modules/verification/domain/verification-conclusion";

type FindingDetailViewProps = {
  finding: FindingDetail;
  investigationTitle: string;
  approvedEvidence: ApprovedEvidenceRow[];
  duplicateCandidates: DuplicateCandidate[];
  isReviewer: boolean;
};

export function FindingDetailView({
  finding,
  investigationTitle,
  approvedEvidence,
  duplicateCandidates,
  isReviewer,
}: FindingDetailViewProps) {
  return (
    <div className="page-stack">
      <Link href="/dashboard/findings" className="record-link w-fit text-sm text-text-secondary">
        All findings
      </Link>
      <PageHeader
        title={finding.title}
        description={
          <Link
            href={`/dashboard/investigations/${finding.investigationId}`}
            className="record-link"
          >
            {investigationTitle}
          </Link>
        }
        metadata={
          <div className="flex flex-wrap items-center gap-4">
            <FindingStatusBadge status={finding.status} />
            <SeverityBadge severity={finding.severity} />
            <EvidenceReference id={finding.id} label="Finding" />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {finding.status === "CONFIRMED" || finding.status === "REPORTABLE" ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/reports/new?investigationId=${finding.investigationId}&findingId=${finding.id}`}
                >
                  Create report
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={`/dashboard/findings/${finding.id}/edit`}>Edit finding</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <ResearchSection id="finding-summary" title="Research record">
          <SourceLabel source="researcher" />
          <p className="research-copy mt-4 text-sm">{finding.description}</p>
          <div className="mt-6 flex flex-col gap-6">
            <div>
              <h3 className="mb-2 text-xs font-medium">Impact</h3>
              <p className="research-copy text-sm text-text-secondary">
                {finding.impact ?? "No impact assessment recorded."}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium">Remediation</h3>
              <p className="research-copy text-sm text-text-secondary">
                {finding.remediation ?? "No remediation recorded."}
              </p>
            </div>
          </div>
        </ResearchSection>
        <ResearchSection id="finding-context" title="Record context">
          <MetadataList
            items={[
              {
                label: "Affected asset",
                value: finding.affectedAsset ?? "Not recorded",
                technical: Boolean(finding.affectedAsset),
              },
              {
                label: "Asset type",
                value:
                  finding.affectedAssetType?.replaceAll("_", " ").toLowerCase() ?? "Not recorded",
              },
              { label: "Category", value: finding.vulnerabilityCategory ?? "Not recorded" },
              {
                label: "Linked hypothesis",
                value: finding.hypothesisId ? (
                  <Link
                    className="record-link"
                    href={`/dashboard/investigations/${finding.investigationId}#hypothesis-${finding.hypothesisId}`}
                  >
                    {finding.hypothesisTitle ?? "Open hypothesis"}
                  </Link>
                ) : (
                  "Not linked"
                ),
              },
              { label: "Confidence", value: "Not recorded" },
              {
                label: "Created",
                value: <ResearchTime date={finding.createdAt} precision="time" />,
              },
              {
                label: "Human approval",
                value: (
                  <ResearchTime date={finding.approvedAt} precision="time" empty="Not approved" />
                ),
              },
              {
                label: "Verified",
                value: (
                  <ResearchTime date={finding.verifiedAt} precision="time" empty="Not verified" />
                ),
              },
              {
                label: "Resolution",
                value: finding.resolutionReason
                  ? RESOLUTION_REASON_LABELS[finding.resolutionReason]
                  : "No resolution recorded",
              },
            ]}
          />
        </ResearchSection>
      </div>
      <ResearchSection
        id="finding-assessment"
        title="Assessment and verification"
        description="Severity, affected asset, and supporting evidence are required before a human reviewer can confirm a finding."
      >
        <p className="research-copy mb-5 text-sm text-text-secondary">
          {finding.severityRationale ?? "No severity rationale recorded."}
        </p>
        <div className="grid gap-8 lg:grid-cols-2">
          <Disclosure title="Edit severity and affected asset">
            <SeverityAssessmentForm
              findingId={finding.id}
              investigationId={finding.investigationId}
              severity={finding.severity}
              severityRationale={finding.severityRationale}
              affectedAsset={finding.affectedAsset}
              affectedAssetType={finding.affectedAssetType}
            />
          </Disclosure>
          <Disclosure title="Change finding status">
            <FindingStatusForm
              findingId={finding.id}
              investigationId={finding.investigationId}
              currentStatus={finding.status}
              isReviewer={isReviewer}
            />
          </Disclosure>
        </div>
      </ResearchSection>
      <ResearchSection
        id="finding-evidence"
        title="Evidence"
        description="Only evidence approved after redaction review can be linked to a finding."
      >
        {finding.evidenceLinks.length ? (
          <RecordTable caption="Evidence linked to this finding" minWidth="42rem">
            <thead>
              <tr>
                <th scope="col">Evidence</th>
                <th scope="col">Relationship</th>
                <th scope="col">Type</th>
                <th scope="col">Redaction</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {finding.evidenceLinks.map((link) => (
                <tr key={link.id}>
                  <td>
                    <Link href={`/dashboard/evidence/${link.evidenceId}`} className="record-link">
                      {link.evidenceTitle}
                    </Link>
                    <div className="mt-2">
                      <EvidenceReference id={link.evidenceId} />
                    </div>
                  </td>
                  <td className="text-xs text-text-secondary">
                    {EVIDENCE_LINK_RELATIONSHIP_LABELS[link.relationshipType]}
                  </td>
                  <td>
                    <EvidenceTypeLabel type={link.evidenceType} />
                  </td>
                  <td>
                    <RedactionStatusBadge status={link.redactionStatus} />
                  </td>
                  <td>
                    <RemoveEvidenceLinkButton
                      linkId={link.id}
                      findingId={finding.id}
                      investigationId={finding.investigationId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        ) : (
          <EmptyState
            title="No linked evidence"
            description="Link supporting evidence before requesting confirmation. Relationships can also identify contradicting information or context."
          />
        )}
        <Disclosure title="Link approved evidence" className="mt-5">
          <EvidenceLinkForm
            findingId={finding.id}
            investigationId={finding.investigationId}
            evidence={approvedEvidence}
          />
        </Disclosure>
      </ResearchSection>
      <ResearchSection
        id="finding-reviews"
        title="Review history"
        description="AI recommendations remain advisory. Human reviews record verification decisions."
      >
        {isReviewer && finding.status === "UNDER_REVIEW" ? (
          <Disclosure title="Record human verification review" className="mb-5">
            <SourceLabel source="human-review" />
            <div className="mt-4">
              <VerificationReviewForm
                findingId={finding.id}
                investigationId={finding.investigationId}
              />
            </div>
          </Disclosure>
        ) : null}
        {finding.verificationReviews.length ? (
          finding.verificationReviews.map((review) => (
            <article key={review.id} className="research-record">
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <SourceLabel source={review.reviewerType === "AI" ? "ai" : "human-review"} />
                <EvidenceReference id={review.id} label="Review" />
                <ResearchTime date={review.createdAt} precision="time" />
              </div>
              <h3 className="text-sm font-medium">
                {VERIFICATION_CONCLUSION_LABELS[review.conclusion] ?? review.conclusion}
              </h3>
              {review.reviewerType === "AI" ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Advisory recommendation; a human decision is still required.
                </p>
              ) : null}
              {review.reviewerUserId ? (
                <p className="record-metadata mt-2">Reviewer: {review.reviewerUserId}</p>
              ) : null}
              {review.taskId ? (
                <div className="mt-2">
                  <EvidenceReference id={review.taskId} label="AI task" />
                </div>
              ) : null}
              {review.reasoningSummary ? (
                <p className="research-copy mt-4 text-sm">{review.reasoningSummary}</p>
              ) : null}
              {review.impactAssessment ? (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-medium">Impact assessment</h4>
                  <p className="research-copy text-sm text-text-secondary">
                    {review.impactAssessment}
                  </p>
                </div>
              ) : null}
              <div className="mt-5 grid gap-6 sm:grid-cols-3">
                <ResearchPoints title="Supporting information" values={review.supportingEvidence} />
                <ResearchPoints
                  title="Contradicting information"
                  values={review.contradictingEvidence}
                />
                <ResearchPoints title="Missing evidence" values={review.missingEvidence} />
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="No verification reviews recorded"
            description="A human reviewer can record a decision when this finding is under review. AI suggestions never count as confirmation."
          />
        )}
      </ResearchSection>
      {isReviewer && finding.status === "UNDER_REVIEW" ? (
        <ResearchSection
          id="finding-duplicate"
          title="Duplicate review"
          description="Similarity is advisory. A human duplicate decision records the canonical finding and rejects this record as a duplicate."
        >
          <DuplicateConfirmationForm
            findingId={finding.id}
            investigationId={finding.investigationId}
            candidates={duplicateCandidates}
          />
        </ResearchSection>
      ) : null}
      {finding.duplicateOfId ? (
        <ResearchSection id="finding-duplicate-link" title="Recorded duplicate">
          <p className="text-sm text-text-secondary">
            This finding is recorded as a duplicate of{" "}
            <Link
              href={`/dashboard/findings/${finding.duplicateOfId}`}
              className="record-link text-primary"
            >
              the canonical finding
            </Link>
            . Its current status is {FINDING_STATUS_LABELS[finding.status]}.
          </p>
        </ResearchSection>
      ) : null}
    </div>
  );
}
