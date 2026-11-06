import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ScopeDraftForm } from "@/components/research/scope-draft-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { getTarget } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "New scope version",
};

export const instant = false;

type NewScopePageProps = {
  params: Promise<{ projectId: string; targetId: string }>;
};

export default async function NewScopePage({ params }: NewScopePageProps) {
  const { projectId, targetId } = await params;

  return (
    <FormPage
      title="Draft a scope version"
      description={
        <>
          {" "}
          Record the assets, activities, and effective window for this target. A draft authorizes
          nothing until it is activated with an attestation.{" "}
        </>
      }
      backHref={`/dashboard/projects/${projectId}/targets/${targetId}`}
      backLabel="Back to target"
    >
      <Suspense fallback={<ScopeFormSkeleton />}>
        <NewScopeContent projectId={projectId} targetId={targetId} />
      </Suspense>
    </FormPage>
  );
}

async function NewScopeContent({ projectId, targetId }: { projectId: string; targetId: string }) {
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
    <ScopeDraftForm
      projectId={project.id}
      targetId={target.id}
      targetName={target.name}
      defaultAssetIdentifier={target.assetIdentifier}
      defaultAssetType={target.assetType}
    />
  );
}

function ScopeFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={5} />;
}
