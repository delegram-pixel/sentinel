import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EvidenceUploadForm } from "@/components/research/evidence-upload-form";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getInvestigation } from "@/modules/research/application/investigation-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Upload evidence",
};

export const instant = false;

type UploadEvidencePageProps = {
  searchParams: Promise<{ investigationId?: string }>;
};

export default function UploadEvidencePage({ searchParams }: UploadEvidencePageProps) {
  return (
    <Suspense fallback={<FormSkeleton label="Loading research form" />}>
      <UploadEvidenceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UploadEvidenceContent({ searchParams }: UploadEvidencePageProps) {
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
      title="Upload evidence"
      description={`Add a screenshot, log, or other supporting file to ${investigation.title}, and note where it came from. It stays quarantined until a human reviewer resolves redaction.`}
      backHref={`/dashboard/investigations/${investigation.id}`}
      backLabel="Back to investigation"
    >
      <EvidenceUploadForm
        investigationId={investigation.id}
        investigationTitle={investigation.title}
      />
    </FormPage>
  );
}
