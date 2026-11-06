import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReportList } from "@/components/research/report-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listReports } from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

export const metadata: Metadata = {
  title: "Reports",
};

export const instant = false;

type ReportsPageProps = {
  searchParams: Promise<{ investigationId?: string }>;
};

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({ searchParams }: ReportsPageProps) {
  const { investigationId } = await searchParams;
  const session = await getSessionContext();
  const reports = await listReports(
    new PrismaReportStore(getDb()),
    session.workspace.id,
    investigationId,
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Reports"
        description="Research documents assembled from confirmed findings and approved evidence. Reports keep an immutable revision history and require human approval before export."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/reports/templates">Templates</Link>
            </Button>
            <Button asChild>
              <Link
                href={
                  investigationId
                    ? `/dashboard/reports/new?investigationId=${investigationId}`
                    : "/dashboard/reports/new"
                }
              >
                New report
              </Link>
            </Button>
          </>
        }
      />
      <ReportList reports={reports} />
    </div>
  );
}

function ReportsSkeleton() {
  return <RecordListSkeleton label="Loading report records" />;
}
