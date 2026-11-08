import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FindingForm } from "@/components/research/finding-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getInvestigation } from "@/modules/research/application/investigation-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "New finding",
};

export const instant = false;

type NewFindingPageProps = {
  searchParams: Promise<{ investigationId?: string }>;
};

export default function NewFindingPage({ searchParams }: NewFindingPageProps) {
  return (
    <Suspense fallback={<FormSkeleton label="Loading research form" />}>
      <NewFindingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewFindingContent({ searchParams }: NewFindingPageProps) {
  const { investigationId } = await searchParams;

  if (!investigationId) {
    notFound();
  }

  const session = await getSessionContext();
  const investigation = await getInvestigation(
    new PrismaResearchStore(getDb()),
    session.workspace.id,
    investigationId,
  );

  if (!investigation) {
    notFound();
  }

  return (
    <FormPage
      title="New finding"
      description={`Found a lead in ${investigation.title}? Describe the suspected issue, its impact, and the affected asset. You can link supporting evidence after saving.`}
      backHref={`/dashboard/investigations/${investigation.id}`}
      backLabel="Back to investigation"
    >
      <FindingForm
        mode="create"
        investigationId={investigation.id}
        investigationTitle={investigation.title}
        hypotheses={investigation.hypotheses.map((hypothesis) => ({
          id: hypothesis.id,
          title: hypothesis.title,
        }))}
      />
    </FormPage>
  );
}
