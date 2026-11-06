import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { TargetForm } from "@/components/research/target-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Register target",
};

export const instant = false;

type NewTargetPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function NewTargetPage({ params }: NewTargetPageProps) {
  const { projectId } = await params;

  return (
    <FormPage
      title="Register a target"
      description={
        <>
          {" "}
          Identify one asset you are authorized to research. Scope is drafted and activated after
          the target exists.{" "}
        </>
      }
      backHref={`/dashboard/projects/${projectId}/targets`}
      backLabel="All targets"
    >
      <Suspense fallback={<TargetFormSkeleton />}>
        <NewTargetContent projectId={projectId} />
      </Suspense>
    </FormPage>
  );
}

async function NewTargetContent({ projectId }: { projectId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const project = await getProjectLookup(store, session.workspace.id, projectId);

  if (!project) {
    notFound();
  }

  if (project.status === "ARCHIVED") {
    redirect(`/dashboard/projects/${projectId}/targets`);
  }

  return <TargetForm mode="create" project={{ id: project.id, name: project.name }} />;
}

function TargetFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={5} />;
}
