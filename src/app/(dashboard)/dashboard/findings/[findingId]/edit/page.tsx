import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { FindingForm } from "@/components/research/finding-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getFinding } from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";
import { getInvestigation } from "@/modules/research/application/investigation-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Edit finding",
};

export const instant = false;

type EditFindingPageProps = {
  params: Promise<{ findingId: string }>;
};

export default function EditFindingPage({ params }: EditFindingPageProps) {
  return (
    <Suspense fallback={<FormSkeleton label="Loading research form" />}>
      <EditFindingContent params={params} />
    </Suspense>
  );
}

async function EditFindingContent({ params }: EditFindingPageProps) {
  const { findingId } = await params;
  const session = await getSessionContext();
  const finding = await getFinding(
    new PrismaFindingStore(getDb()),
    session.workspace.id,
    findingId,
  );

  if (!finding) {
    notFound();
  }

  if (finding.status !== "DRAFT" && finding.status !== "NEEDS_VALIDATION") {
    redirect(`/dashboard/findings/${finding.id}`);
  }

  const investigation = await getInvestigation(
    new PrismaResearchStore(getDb()),
    session.workspace.id,
    finding.investigationId,
  );

  if (!investigation) {
    notFound();
  }

  return (
    <FormPage
      title="Edit finding"
      description={`Refine this finding from ${investigation.title}. Keep the description, severity, and affected asset clear so a reviewer can follow your reasoning.`}
      backHref={`/dashboard/findings/${finding.id}`}
      backLabel="Back to finding"
    >
      <FindingForm
        mode="edit"
        finding={finding}
        hypotheses={investigation.hypotheses.map((hypothesis) => ({
          id: hypothesis.id,
          title: hypothesis.title,
        }))}
      />
    </FormPage>
  );
}
