import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProjectDetailSkeleton, ProjectDetailView } from "@/components/research/project-detail";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listInvestigations } from "@/modules/research/application/investigation-service";
import { getProject } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Project",
};

// The workspace shell resolves the pathname on the client, so this
// authenticated, data-backed route is allowed to block its first navigation.
export const instant = false;

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      <ProjectContent projectId={projectId} />
    </Suspense>
  );
}

async function ProjectContent({ projectId }: { projectId: string }) {
  const session = await getSessionContext();
  const project = await getProject(
    new PrismaResearchStore(getDb()),
    session.workspace.id,
    projectId,
  );

  if (!project) {
    notFound();
  }

  const investigations = await listInvestigations(
    new PrismaResearchStore(getDb()),
    session.workspace.id,
    project.id,
  );
  return <ProjectDetailView project={project} investigations={investigations} />;
}
