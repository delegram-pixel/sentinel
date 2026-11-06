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
      description={
        <>
          {" "}
          A project is the container for one piece of research. You can register targets and draft
          scope after it exists.{" "}
        </>
      }
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
