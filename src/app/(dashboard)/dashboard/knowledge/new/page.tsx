import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { KNOWLEDGE_ORIGINS } from "@/modules/knowledge/domain/knowledge";
import { PrismaEngagementStore } from "@/modules/engagements/infrastructure/prisma-engagement-store";
import { createKnowledgeAction } from "../actions";
export const metadata = { title: "Add knowledge" };
export default function NewKnowledgePage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Add research knowledge"
        description="Found something worth keeping? Add the content and where it came from. Save it as a draft; a human reviewer must approve it before AI can use it as context."
      />
      <Suspense fallback={<p>Loading engagements…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  const s = await getSessionContext();
  const engagements = await new PrismaEngagementStore(getDb()).list(s.workspace.id);
  return (
    <ResearchSection id="knowledge-create" title="Source and content">
      <ResearchActionForm
        action={createKnowledgeAction}
        submitLabel="Save draft knowledge"
        fields={[
          { name: "title", label: "Title", required: true, maxLength: 200 },
          {
            name: "origin",
            label: "Source type",
            options: KNOWLEDGE_ORIGINS.map((o) => ({ value: o, label: o.replaceAll("_", " ") })),
          },
          {
            name: "content",
            label: "Supplied reference or research note",
            type: "textarea",
            required: true,
            maxLength: 100000,
          },
          { name: "url", label: "Original source URL", type: "url" },
          { name: "publishedAt", label: "Publication date, if known", type: "date" },
          { name: "retrievedAt", label: "Retrieval date, if known", type: "date" },
          { name: "tags", label: "Tags, separated by commas" },
          {
            name: "engagementId",
            label: "Knowledge context",
            options: [
              { value: "", label: "Workspace reference" },
              ...engagements
                .filter((e) => e.status !== "ARCHIVED")
                .map((e) => ({ value: e.id, label: e.name })),
            ],
          },
        ]}
      />
    </ResearchSection>
  );
}
