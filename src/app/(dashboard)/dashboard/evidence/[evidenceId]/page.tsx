import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EvidenceDetailView } from "@/components/research/evidence-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getEvidence } from "@/modules/evidence/application/evidence-service";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import { listFindings } from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";

export const metadata: Metadata = {
  title: "Evidence",
};

export const instant = false;

type EvidenceDetailPageProps = {
  params: Promise<{ evidenceId: string }>;
};

export default function EvidenceDetailPage({ params }: EvidenceDetailPageProps) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EvidenceDetailContent params={params} />
    </Suspense>
  );
}

async function EvidenceDetailContent({ params }: EvidenceDetailPageProps) {
  const { evidenceId } = await params;
  const session = await getSessionContext();
  const evidence = await getEvidence(
    new PrismaEvidenceStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    evidenceId,
  );

  if (!evidence) {
    notFound();
  }

  const findings = await listFindings(
    new PrismaFindingStore(getDb()),
    session.workspace.id,
    evidence.investigationId,
  );

  return (
    <EvidenceDetailView
      evidence={evidence}
      findings={findings
        .filter((finding) => finding.status !== "CLOSED")
        .map((finding) => ({
          id: finding.id,
          title: finding.title,
          status: finding.status,
        }))}
      isReviewer={
        session.role === "OWNER" || session.role === "ADMIN" || session.role === "REVIEWER"
      }
    />
  );
}
