import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from "@/modules/research/domain/project";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";
import { createEngagementAction } from "../actions";
export const metadata = { title: "New engagement" };
export default function NewEngagementPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="New engagement"
        description="Choose a project and describe what this round of research should achieve. Once it's created, you can connect targets and their existing scope versions."
      />
      <Suspense fallback={<p>Loading projects…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  const session = await getSessionContext();
  const projects = await new PrismaResearchStore(getDb()).listProjects(session.workspace.id);
  return (
    <ResearchSection id="new-engagement" title="Engagement details">
      <ResearchActionForm
        action={createEngagementAction}
        submitLabel="Create engagement"
        fields={[
          {
            name: "projectId",
            label: "Project",
            required: true,
            options: projects
              .filter((p) => p.status !== "ARCHIVED")
              .map((p) => ({ value: p.id, label: p.name })),
          },
          { name: "name", label: "Name", required: true, maxLength: 120 },
          { name: "objective", label: "Research objective", type: "textarea", maxLength: 4000 },
          {
            name: "engagementType",
            label: "Engagement type",
            options: PROJECT_TYPES.map((t) => ({ value: t, label: PROJECT_TYPE_LABELS[t] })),
          },
          { name: "startsAt", label: "Start date", type: "date" },
          { name: "endsAt", label: "End date", type: "date" },
        ]}
      />
    </ResearchSection>
  );
}
