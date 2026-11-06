import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FindingDetailView } from "@/components/research/finding-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  getFinding,
  listApprovedEvidenceForFinding,
  listDuplicateCandidates,
} from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";

export const metadata: Metadata = {
  title: "Finding",
};

export const instant = false;

type FindingPageProps = {
  params: Promise<{ findingId: string }>;
};

export default function FindingPage({ params }: FindingPageProps) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <FindingContent params={params} />
    </Suspense>
  );
}

async function FindingContent({ params }: FindingPageProps) {
  const { findingId } = await params;
  const session = await getSessionContext();
  const store = new PrismaFindingStore(getDb());
  const finding = await getFinding(store, session.workspace.id, findingId);

  if (!finding) {
    notFound();
  }

  const [approvedEvidence, duplicateCandidates] = await Promise.all([
    listApprovedEvidenceForFinding(store, session.workspace.id, finding.id),
    listDuplicateCandidates(store, session.workspace.id, finding.id),
  ]);

  return (
    <FindingDetailView
      finding={finding}
      investigationTitle={finding.investigationTitle}
      approvedEvidence={approvedEvidence}
      duplicateCandidates={duplicateCandidates}
      isReviewer={
        session.role === "OWNER" || session.role === "ADMIN" || session.role === "REVIEWER"
      }
    />
  );
}
