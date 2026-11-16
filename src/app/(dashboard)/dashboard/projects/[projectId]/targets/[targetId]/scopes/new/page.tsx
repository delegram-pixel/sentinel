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
      description="Set the boundaries: which assets and activities are allowed, what's excluded, and when permission applies. Save the draft, then activate it with an attestation before testing."
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
      defaultDraft={
        target.scopes[0]?.status === "DRAFT"
          ? {
              effectiveFrom: target.scopes[0].effectiveFrom?.toISOString().slice(0, 10) ?? "",
              effectiveUntil: target.scopes[0].effectiveUntil?.toISOString().slice(0, 10) ?? "",
              assets: target.scopes[0].assets.map((asset) => ({
                assetIdentifier: asset.assetIdentifier,
                assetType: asset.assetType,
                matchType: asset.matchType,
                effect: asset.effect,
                notes: asset.notes ?? "",
              })),
              permittedActivities: target.scopes[0].activities
                .filter((activity) => activity.effect === "PERMITTED")
                .map((activity) => activity.activity),
              attestationNotes: target.scopes[0].attestationNotes ?? "",
            }
          : undefined
      }
    />
  );
}

function ScopeFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={5} />;
}
