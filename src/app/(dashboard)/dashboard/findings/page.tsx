import type { Metadata } from "next";
import { Suspense } from "react";

import { FindingList } from "@/components/research/finding-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listFindings } from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";

export const metadata: Metadata = {
  title: "Findings",
};

export const instant = false;

type FindingsPageProps = {
  searchParams: Promise<{ investigationId?: string }>;
};

export default function FindingsPage({ searchParams }: FindingsPageProps) {
  return (
    <Suspense fallback={<FindingsSkeleton />}>
      <FindingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FindingsContent({ searchParams }: FindingsPageProps) {
  const { investigationId } = await searchParams;
  const session = await getSessionContext();
  const findings = await listFindings(
    new PrismaFindingStore(getDb()),
    session.workspace.id,
    investigationId,
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Findings"
        description="Candidate vulnerabilities, supporting evidence, and human verification decisions. Review the research before confirming a finding."
        actions={
          investigationId ? (
            <Button asChild>
              <Link href={`/dashboard/findings/new?investigationId=${investigationId}`}>
                New finding
              </Link>
            </Button>
          ) : null
        }
      />
      <FindingList findings={findings} />
    </div>
  );
}

function FindingsSkeleton() {
  return <RecordListSkeleton label="Loading findings records" />;
}
