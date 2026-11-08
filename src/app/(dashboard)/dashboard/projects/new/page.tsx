import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectForm } from "@/components/research/project-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getSessionContext } from "@/lib/session";

export const metadata: Metadata = {
  title: "New project",
};

export default function NewProjectPage() {
  return (
    <FormPage
      title="New project"
      description="Give your research a name and a purpose. Create the project first, then add targets, define their scope, and start exploring your questions."
      backHref="/dashboard/projects"
      backLabel="All projects"
    >
      <Suspense fallback={<ProjectFormSkeleton />}>
        <NewProjectContent />
      </Suspense>
    </FormPage>
  );
}

async function NewProjectContent() {
  await getSessionContext();

  return <ProjectForm mode="create" />;
}

function ProjectFormSkeleton() {
  return <FormSkeleton label="Loading research form" fields={4} />;
}
