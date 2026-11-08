import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { canReviewResearch } from "@/modules/shared/application/actor";
import { PrismaKnowledgeStore } from "@/modules/knowledge/infrastructure/prisma-knowledge-store";
import { reviewKnowledgeAction, relateKnowledgeAction } from "../actions";
export const metadata = { title: "Knowledge document" };
export default function KnowledgeDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  return (
    <Suspense fallback={<p>Loading document…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
async function Content({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId: id } = await params;
  const s = await getSessionContext();
  const store = new PrismaKnowledgeStore(getDb());
  const row = await store.find(s.workspace.id, id);
  if (!row) notFound();
  const others = await store.list(s.workspace.id);
  return (
    <div className="page-stack">
      <PageHeader
        title={row.title}
        description="Read the saved material and check where it came from. A human reviewer can approve it for AI context; related documents below help connect the dots."
        metadata={
          <p className="text-xs text-text-secondary">
            {row.source.origin} · {row.reviewStatus} · Version {row.version}
          </p>
        }
      />
      <ResearchSection id="knowledge-provenance" title="Source details">
        <p>Recorded by {row.creator.displayName}</p>
        <p>
          Published: {row.source.publishedAt?.toLocaleDateString() ?? "Unknown"} · Retrieved:{" "}
          {row.source.retrievedAt?.toLocaleDateString() ?? "Unknown"}
        </p>
        {row.source.url ? (
          <a className="underline" href={row.source.url} target="_blank" rel="noreferrer">
            Original source
          </a>
        ) : null}
      </ResearchSection>
      <ResearchSection id="knowledge-content" title="Supplied content">
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{row.content}</p>
      </ResearchSection>
      {canReviewResearch(s.role) ? (
        <ResearchSection id="knowledge-review" title="Human review">
          <ResearchActionForm
            action={reviewKnowledgeAction}
            hidden={{ documentId: row.id, expectedStatus: row.reviewStatus }}
            submitLabel="Record review"
            fields={[
              {
                name: "status",
                label: "Review decision",
                options: [
                  { value: "REVIEWED", label: "Reviewed for use as a reference" },
                  { value: "WITHDRAWN", label: "Withdraw from future AI context" },
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
        </ResearchSection>
      ) : null}
      <ResearchSection id="knowledge-relationships" title="Related knowledge">
        <ResearchActionForm
          action={relateKnowledgeAction}
          hidden={{ fromId: row.id }}
          submitLabel="Record relationship"
          fields={[
            {
              name: "toId",
              label: "Related document",
              required: true,
              options: others
                .filter((o) => o.id !== row.id)
                .map((o) => ({ value: o.id, label: o.title })),
            },
            {
              name: "relationship",
              label: "Relationship",
              options: ["SUPPORTS", "CONTRADICTS", "CONTEXT", "SUPERSEDES"].map((r) => ({
                value: r,
                label: r,
              })),
            },
            {
              name: "rationale",
              label: "Rationale",
              type: "textarea",
              required: true,
              maxLength: 2000,
            },
          ]}
        />
      </ResearchSection>
    </div>
  );
}
