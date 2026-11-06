import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProjectList, ProjectListSkeleton } from "@/components/research/project-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listProjects } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Projects"
        description="Organise targets and investigations around a research objective."
        actions={
          <Button asChild>
            <Link href="/dashboard/projects/new">New project</Link>
          </Button>
        }
      />
      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectsContent />
      </Suspense>
    </div>
  );
}
async function ProjectsContent() {
  const session = await getSessionContext();
  const projects = await listProjects(new PrismaResearchStore(getDb()), session.workspace.id);
  return <ProjectList projects={projects} />;
}
