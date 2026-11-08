import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { InvestigationForm } from "@/components/research/investigation-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listProjects } from "@/modules/research/application/project-service";
import { listTargets } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "New investigation",
};

export const instant = false;

type NewInvestigationPageProps = {
  searchParams: Promise<{ projectId?: string }>;
};

export default async function NewInvestigationPage({ searchParams }: NewInvestigationPageProps) {
  const { projectId } = await searchParams;

  return (
    <FormPage
      title="New investigation"
      description="Choose a project and target, then write the question you want to explore. You can start taking notes now; testing the target needs an active scope."
      backHref="/dashboard/investigations"
      backLabel="All investigations"
    >
      <Suspense fallback={<InvestigationFormSkeleton />}>
        <NewInvestigationContent defaultProjectId={projectId} />
      </Suspense>
    </FormPage>
  );
}

async function NewInvestigationContent({ defaultProjectId }: { defaultProjectId?: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const [projects, targets] = await Promise.all([
    listProjects(store, session.workspace.id),
    listTargets(store, session.workspace.id),
  ]);

  const activeProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const selectableTargets = targets.filter((target) => activeProjectIds.has(target.projectId));

  if (activeProjects.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        title="Create a project to begin"
        description="Create a project first, then register the asset you want to research. Once both are ready, you can start an investigation for your question."
        action={
          <Button asChild>
            <Link href="/dashboard/projects/new">Create project</Link>
          </Button>
        }
      />
    );
  }

  return (
    <InvestigationForm
      mode="create"
      projects={activeProjects.map((project) => ({ id: project.id, name: project.name }))}
      targets={selectableTargets.map((target) => ({
        id: target.id,
        projectId: target.projectId,
        name: target.name,
        assetIdentifier: target.assetIdentifier,
      }))}
      defaultProjectId={
        defaultProjectId && activeProjectIds.has(defaultProjectId) ? defaultProjectId : undefined
      }
    />
  );
}

function InvestigationFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={4} />;
}
