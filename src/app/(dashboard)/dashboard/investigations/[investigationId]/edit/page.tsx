import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { InvestigationForm } from "@/components/research/investigation-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getInvestigation } from "@/modules/research/application/investigation-service";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Edit investigation",
};

export const instant = false;

type EditInvestigationPageProps = {
  params: Promise<{ investigationId: string }>;
};

export default async function EditInvestigationPage({ params }: EditInvestigationPageProps) {
  const { investigationId } = await params;

  return (
    <FormPage
      title="Edit investigation"
      description="Sharpen the research question or tidy up the title, category, and description. This investigation stays linked to its original project and target."
      backHref={`/dashboard/investigations/${investigationId}`}
      backLabel="Back to investigation"
    >
      <Suspense fallback={<EditInvestigationFormSkeleton />}>
        <EditInvestigationContent investigationId={investigationId} />
      </Suspense>
    </FormPage>
  );
}

async function EditInvestigationContent({ investigationId }: { investigationId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const investigation = await getInvestigation(store, session.workspace.id, investigationId);

  if (!investigation) {
    notFound();
  }

  const project = await getProjectLookup(store, session.workspace.id, investigation.projectId);

  if (!project) {
    notFound();
  }

  if (project.status === "ARCHIVED" || investigation.status === "ARCHIVED") {
    redirect(`/dashboard/investigations/${investigationId}`);
  }

  return (
    <InvestigationForm
      mode="edit"
      investigation={{
        id: investigation.id,
        projectId: investigation.projectId,
        projectName: investigation.projectName,
        targetName: investigation.targetName,
        targetAssetIdentifier: investigation.targetAssetIdentifier,
        title: investigation.title,
        description: investigation.description,
        objective: investigation.objective,
        category: investigation.category,
      }}
    />
  );
}

function EditInvestigationFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={4} />;
}
