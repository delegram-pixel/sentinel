import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProjectStatusBadge } from "@/components/research/project-badges";
import { TargetList, TargetListSkeleton } from "@/components/research/target-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { listTargets } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Project targets",
};

export const instant = false;

type ProjectTargetsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectTargetsPage({ params }: ProjectTargetsPageProps) {
  const { projectId } = await params;

  return (
    <Suspense fallback={<TargetListSkeleton />}>
      <ProjectTargetsContent projectId={projectId} />
    </Suspense>
  );
}

async function ProjectTargetsContent({ projectId }: { projectId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const project = await getProjectLookup(store, session.workspace.id, projectId);

  if (!project) {
    notFound();
  }

  const targets = (await listTargets(store, session.workspace.id)).filter(
    (target) => target.projectId === projectId,
  );

  return (
    <div className="page-stack">
      <Link
        href={`/dashboard/projects/${project.id}`}
        className="record-link w-fit text-sm text-text-secondary"
      >
        Back to project
      </Link>
      <PageHeader
        title="Targets"
        description={`Assets registered for ${project.name}. Each target has its own authorization context and scope history.`}
        metadata={<ProjectStatusBadge status={project.status} />}
        actions={
          project.status !== "ARCHIVED" ? (
            <Button asChild>
              <Link href={`/dashboard/projects/${project.id}/targets/new`}>Register target</Link>
            </Button>
          ) : null
        }
      />
      <TargetList
        targets={targets}
        projectId={project.id}
        projectName={project.name}
        canCreate={project.status !== "ARCHIVED"}
      />
    </div>
  );
}
