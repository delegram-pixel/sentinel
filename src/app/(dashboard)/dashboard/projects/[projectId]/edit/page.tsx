import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ProjectForm } from "@/components/research/project-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProject } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Edit project",
};

// The workspace shell resolves the pathname on the client, so this
// authenticated, data-backed route is allowed to block its first navigation.
export const instant = false;

type EditProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { projectId } = await params;

  return (
    <FormPage
      title="Edit project"
      description={
        <> Update how this project is described. Targets and scope are managed separately. </>
      }
      backHref={`/dashboard/projects/${projectId}`}
      backLabel="Back to project"
    >
      <Suspense fallback={<ProjectFormSkeleton />}>
        <EditProjectContent projectId={projectId} />
      </Suspense>
    </FormPage>
  );
}

async function EditProjectContent({ projectId }: { projectId: string }) {
  const session = await getSessionContext();
  const project = await getProject(
    new PrismaResearchStore(getDb()),
    session.workspace.id,
    projectId,
  );

  if (!project) {
    notFound();
  }

  if (project.status === "ARCHIVED") {
    redirect(`/dashboard/projects/${projectId}`);
  }

  return (
    <ProjectForm
      mode="edit"
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        projectType: project.projectType,
      }}
    />
  );
}

function ProjectFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={4} />;
}
