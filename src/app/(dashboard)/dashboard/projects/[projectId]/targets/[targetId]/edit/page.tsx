import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { TargetForm } from "@/components/research/target-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { getTarget } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Edit target",
};

export const instant = false;

type EditTargetPageProps = {
  params: Promise<{ projectId: string; targetId: string }>;
};

export default async function EditTargetPage({ params }: EditTargetPageProps) {
  const { projectId, targetId } = await params;

  return (
    <FormPage
      title="Edit target"
      description="Keep this asset's details and source of permission up to date. If the testing boundaries have changed, draft a new scope version from the target page too."
      backHref={`/dashboard/projects/${projectId}/targets/${targetId}`}
      backLabel="Back to target"
    >
      <Suspense fallback={<TargetFormSkeleton />}>
        <EditTargetContent projectId={projectId} targetId={targetId} />
      </Suspense>
    </FormPage>
  );
}

async function EditTargetContent({ projectId, targetId }: { projectId: string; targetId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const [project, target] = await Promise.all([
    getProjectLookup(store, session.workspace.id, projectId),
    getTarget(store, session.workspace.id, targetId),
  ]);

  if (!project || !target || target.projectId !== project.id) {
    notFound();
  }

  if (project.status === "ARCHIVED") {
    redirect(`/dashboard/projects/${projectId}/targets/${targetId}`);
  }

  return (
    <TargetForm
      mode="edit"
      project={{ id: project.id, name: project.name }}
      target={{
        id: target.id,
        name: target.name,
        description: target.description,
        assetIdentifier: target.assetIdentifier,
        assetType: target.assetType,
        environmentType: target.environmentType,
        programName: target.programName,
        programUrl: target.programUrl,
        authorizationSource: target.authorizationSource,
        authorizationDate: target.authorizationDate,
        authorizationNotes: target.authorizationNotes,
      }}
    />
  );
}

function TargetFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={5} />;
}
