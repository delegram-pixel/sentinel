import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  InvestigationDetailSkeleton,
  InvestigationDetailView,
} from "@/components/research/investigation-detail";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listEvidence } from "@/modules/evidence/application/evidence-service";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import { listFindings } from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";
import { getInvestigation } from "@/modules/research/application/investigation-service";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Investigation",
};

export const instant = false;

type InvestigationPageProps = {
  params: Promise<{ investigationId: string }>;
};

export default async function InvestigationPage({ params }: InvestigationPageProps) {
  const { investigationId } = await params;

  return (
    <Suspense fallback={<InvestigationDetailSkeleton />}>
      <InvestigationContent investigationId={investigationId} />
    </Suspense>
  );
}

async function InvestigationContent({ investigationId }: { investigationId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const investigation = await getInvestigation(store, session.workspace.id, investigationId);

  if (!investigation) {
    notFound();
  }

  const project = await getProjectLookup(store, session.workspace.id, investigation.projectId);

  if (!project) {
    notFound();
  }

  const [findings, evidence] = await Promise.all([
    listFindings(new PrismaFindingStore(getDb()), session.workspace.id, investigation.id),
    listEvidence(
      new PrismaEvidenceStore(getDb()),
      { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
      investigation.id,
    ),
  ]);

  return (
    <InvestigationDetailView
      investigation={investigation}
      canEdit={project.status !== "ARCHIVED"}
      findings={findings}
      evidence={evidence}
    />
  );
}
