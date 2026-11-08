import type { Metadata } from "next";
import { Suspense } from "react";

import { EvidenceList } from "@/components/research/evidence-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listEvidence } from "@/modules/evidence/application/evidence-service";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";

export const metadata: Metadata = {
  title: "Evidence",
};

export const instant = false;

type EvidencePageProps = {
  searchParams: Promise<{ investigationId?: string }>;
};

export default function EvidencePage({ searchParams }: EvidencePageProps) {
  return (
    <Suspense fallback={<EvidenceSkeleton />}>
      <EvidenceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EvidenceContent({ searchParams }: EvidencePageProps) {
  const { investigationId } = await searchParams;
  const session = await getSessionContext();
  const evidence = await listEvidence(
    new PrismaEvidenceStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    investigationId,
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Evidence"
        description="Keep the proof close to the research. Upload files from an investigation, then open them here to check their source and redaction review before linking them to a finding."
        actions={
          investigationId ? (
            <Button asChild>
              <Link href={`/dashboard/evidence/upload?investigationId=${investigationId}`}>
                Upload evidence
              </Link>
            </Button>
          ) : null
        }
      />
      <EvidenceList evidence={evidence} />
    </div>
  );
}

function EvidenceSkeleton() {
  return <RecordListSkeleton label="Loading evidence records" />;
}
