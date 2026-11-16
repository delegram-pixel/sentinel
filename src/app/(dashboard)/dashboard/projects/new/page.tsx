import type { Metadata } from "next";
import { Suspense } from "react";

import { NewProjectForm } from "@/components/research/new-project-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getSessionContext } from "@/lib/session";

export const metadata: Metadata = {
  title: "New project",
};

export default function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  return (
    <FormPage
      title="New project"
      description="Import a bug bounty program with AI, or create a project yourself. Review its targets and scope before starting your research."
      backHref="/dashboard/projects"
      backLabel="All projects"
    >
      <Suspense fallback={<ProjectFormSkeleton />}>
        <NewProjectContent searchParams={searchParams} />
      </Suspense>
    </FormPage>
  );
}

async function NewProjectContent({ searchParams }: { searchParams: Promise<{ import?: string }> }) {
  await getSessionContext();
  const query = await searchParams;
  return <NewProjectForm initialJobId={query.import} />;
}

function ProjectFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={4} />;
}
