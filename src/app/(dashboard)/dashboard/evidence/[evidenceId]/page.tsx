import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EvidenceDetailView } from "@/components/research/evidence-detail";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { ResearchSection } from "@/components/shared/research-section";
import { AgentResearchOutput } from "@/components/ai/agent-research-output";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";
import { PrismaResearchEvidenceStore } from "@/modules/evidence/infrastructure/prisma-research-evidence-store";
import {
  recordProvenanceAction,
  relateEvidenceResearchAction,
  reviewAssessmentAction,
  reviewReplacementAction,
} from "../research-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getEvidence } from "@/modules/evidence/application/evidence-service";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import { listFindings } from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";

export const metadata: Metadata = {
  title: "Evidence",
};

export const instant = false;

type EvidenceDetailPageProps = {
  params: Promise<{ evidenceId: string }>;
};

export default function EvidenceDetailPage({ params }: EvidenceDetailPageProps) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EvidenceDetailContent params={params} />
    </Suspense>
  );
}

async function EvidenceDetailContent({ params }: EvidenceDetailPageProps) {
  const { evidenceId } = await params;
  const session = await getSessionContext();
  const evidence = await getEvidence(
    new PrismaEvidenceStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    evidenceId,
  );

  if (!evidence) {
    notFound();
  }

  const findings = await listFindings(
    new PrismaFindingStore(getDb()),
    session.workspace.id,
    evidence.investigationId,
  );
  const [investigation, assessments, approvedVersions] = await Promise.all([
    new PrismaResearchStore(getDb()).findInvestigation(
      session.workspace.id,
      evidence.investigationId,
    ),
    new PrismaResearchEvidenceStore(getDb()).listAssessments(session.workspace.id, evidence.id),
    new PrismaEvidenceStore(getDb()).listApprovedEvidence(
      session.workspace.id,
      evidence.investigationId,
    ),
  ]);

  return (
    <div className="page-stack">
      <EvidenceDetailView
        evidence={evidence}
        findings={findings
          .filter((finding) => finding.status !== "CLOSED")
          .map((finding) => ({
            id: finding.id,
            title: finding.title,
            status: finding.status,
          }))}
        isReviewer={
          session.role === "OWNER" || session.role === "ADMIN" || session.role === "REVIEWER"
        }
      />
      <ResearchSection
        id="collection-provenance"
        title="Collection details"
        description="Note who collected this evidence, when, and how. These details help a reviewer trace it back to the original observation."
      >
        <p className="mb-4 text-sm">
          Collector: {evidence.collector ?? "Unknown"} · Collection date:{" "}
          {evidence.collectedAt?.toLocaleDateString() ?? "Unknown"}
        </p>
        {!evidence.collector && !evidence.deletedAt ? (
          <ResearchActionForm
            action={recordProvenanceAction}
            hidden={{ evidenceId: evidence.id }}
            submitLabel="Save collection details"
            fields={[
              { name: "collector", label: "Collector", required: true, maxLength: 300 },
              { name: "collectedAt", label: "Collection date, if known", type: "date" },
              {
                name: "source",
                label: "Collection source and method",
                type: "textarea",
                required: true,
                maxLength: 2000,
              },
            ]}
          />
        ) : null}
      </ResearchSection>
      {["OWNER", "ADMIN", "REVIEWER"].includes(session.role) &&
      evidence.storageKey &&
      !evidence.deletedAt &&
      !evidence.supersedesId ? (
        <ResearchSection id="review-replacement" title="Reviewed replacement">
          <ResearchActionForm
            action={reviewReplacementAction}
            hidden={{ evidenceId: evidence.id }}
            submitLabel="Record reviewed replacement"
            fields={[
              {
                name: "supersedesId",
                label: "Previous approved evidence version",
                required: true,
                options: approvedVersions
                  .filter((e) => e.id !== evidence.id)
                  .map((e) => ({ value: e.id, label: `${e.title} · v${e.version}` })),
              },
              {
                name: "rationale",
                label: "Replacement rationale",
                type: "textarea",
                required: true,
                maxLength: 8000,
              },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Review the new upload and wait for it to finish moving out of quarantine before
            recording it as a replacement. The earlier evidence and its existing links stay in the
            history.
          </p>
        </ResearchSection>
      ) : null}
      {investigation && !evidence.deletedAt ? (
        <ResearchSection
          id="evidence-research-relations"
          title="Research relationships"
          description="Connect this evidence to an observation or hypothesis, and explain whether it supports the idea, challenges it, or adds context."
        >
          <ResearchActionForm
            action={relateEvidenceResearchAction}
            hidden={{ evidenceId: evidence.id }}
            submitLabel="Link research record"
            fields={[
              {
                name: "subject",
                label: "Observation or hypothesis",
                required: true,
                options: [
                  ...investigation.observations.map((o) => ({
                    value: `OBSERVATION:${o.id}`,
                    label: o.title,
                  })),
                  ...investigation.hypotheses.map((h) => ({
                    value: `HYPOTHESIS:${h.id}`,
                    label: h.title,
                  })),
                ],
              },
              {
                name: "relationship",
                label: "Relationship",
                options: ["SUPPORTS", "CONTRADICTS", "CONTEXT"].map((r) => ({
                  value: r,
                  label: r,
                })),
              },
              {
                name: "rationale",
                label: "Relationship rationale",
                type: "textarea",
                required: true,
                maxLength: 2000,
              },
            ]}
          />
        </ResearchSection>
      ) : null}
      <ResearchSection
        id="evidence-assessments"
        title="Evidence quality assessments"
        description="Use these assessments to check the evidence's strengths and gaps. A human reviewer can record whether the assessment is useful; evidence approval is a separate review."
      >
        {assessments.length ? (
          assessments.map((a) => (
            <div className="border-b border-border py-4" key={a.id}>
              <p className="mb-3 text-sm">
                {a.assessorType} assessment · {a.reviewStatus}
              </p>
              <AgentResearchOutput
                output={{ assessments: [a.assessment], claims: [], uncertaintyNotes: [] }}
              />
              {["OWNER", "ADMIN", "REVIEWER"].includes(session.role) ? (
                <ResearchActionForm
                  action={reviewAssessmentAction}
                  hidden={{ assessmentId: a.id }}
                  submitLabel="Record assessment review"
                  fields={[
                    {
                      name: "status",
                      label: "Review",
                      options: [
                        { value: "REVIEWED", label: "Reviewed" },
                        { value: "WITHDRAWN", label: "Withdrawn" },
                      ],
                    },
                    {
                      name: "rationale",
                      label: "Review rationale",
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
          <p>
            No assessments yet. Queue an Evidence review from Background work to review the eligible
            evidence in this investigation.
          </p>
        )}
      </ResearchSection>
    </div>
  );
}
