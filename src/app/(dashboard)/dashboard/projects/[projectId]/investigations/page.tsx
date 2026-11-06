import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  InvestigationList,
  InvestigationListSkeleton,
} from "@/components/research/investigation-list";
import { ProjectStatusBadge } from "@/components/research/project-badges";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listInvestigations } from "@/modules/research/application/investigation-service";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Project investigations",
};

export const instant = false;

type ProjectInvestigationsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectInvestigationsPage({
  params,
}: ProjectInvestigationsPageProps) {
  const { projectId } = await params;

  return (
    <Suspense fallback={<InvestigationListSkeleton />}>
      <ProjectInvestigationsContent projectId={projectId} />
    </Suspense>
  );
}

async function ProjectInvestigationsContent({ projectId }: { projectId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const project = await getProjectLookup(store, session.workspace.id, projectId);

  if (!project) {
    notFound();
  }

  const investigations = await listInvestigations(store, session.workspace.id, project.id);

  return (
    <div className="page-stack">
      <Link
        href={`/dashboard/projects/${project.id}`}
        className="record-link w-fit text-sm text-text-secondary"
      >
        Back to project
      </Link>
      <PageHeader
        title="Investigations"
        description={`Research records for ${project.name}. Keep observations, hypotheses, and session history connected to their target.`}
        metadata={<ProjectStatusBadge status={project.status} />}
        actions={
          project.status !== "ARCHIVED" ? (
            <Button asChild>
              <Link href={`/dashboard/investigations/new?projectId=${project.id}`}>
                New investigation
              </Link>
            </Button>
          ) : null
        }
      />
      <InvestigationList
        investigations={investigations}
        projectId={project.id}
        projectName={project.name}
        canCreate={project.status !== "ARCHIVED"}
      />
    </div>
  );
}
