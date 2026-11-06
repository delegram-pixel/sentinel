import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReportDetailView } from "@/components/research/report-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getReport } from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

export const metadata: Metadata = {
  title: "Report",
};

export const instant = false;

type ReportPageProps = {
  params: Promise<{ reportId: string }>;
};

export default function ReportPage({ params }: ReportPageProps) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportContent params={params} />
    </Suspense>
  );
}

async function ReportContent({ params }: ReportPageProps) {
  const { reportId } = await params;
  const session = await getSessionContext();
  const report = await getReport(new PrismaReportStore(getDb()), session.workspace.id, reportId);

  if (!report) {
    notFound();
  }

  return (
    <ReportDetailView
      report={report}
      isReviewer={
        session.role === "OWNER" || session.role === "ADMIN" || session.role === "REVIEWER"
      }
    />
  );
}
