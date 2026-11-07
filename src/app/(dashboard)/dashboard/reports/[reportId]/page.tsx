import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReportDetailView } from "@/components/research/report-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getReport } from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";
import { PrismaAiReportStore } from "@/modules/reports/infrastructure/prisma-ai-report-store";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { ResearchSection } from "@/components/shared/research-section";
import { adoptAiReportAction } from "../adoption";

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
  const drafts =
    report.status === "DRAFT"
      ? await new PrismaAiReportStore(getDb()).listDraftTasks(
          session.workspace.id,
          report.investigationId,
        )
      : [];
  return (
    <>
      <ReportDetailView
        report={report}
        isReviewer={
          session.role === "OWNER" || session.role === "ADMIN" || session.role === "REVIEWER"
        }
      />
      {drafts.length ? (
        <ResearchSection id="adopt-report-draft" title="Adopt a Reporting Agent draft">
          <ResearchActionForm
            action={adoptAiReportAction}
            hidden={{ reportId: report.id, expectedRevision: String(report.latestRevisionVersion) }}
            submitLabel="Adopt draft revision"
            fields={[
              {
                name: "taskId",
                label: "Completed report analysis",
                options: drafts.map((t) => ({
                  value: t.id,
                  label: `${t.createdAt.toISOString().slice(0, 10)} · ${t.model} · ${t.id.slice(0, 8)}`,
                })),
              },
              {
                name: "rationale",
                label: "Adoption rationale",
                type: "textarea",
                required: true,
                maxLength: 8000,
              },
            ]}
          />
        </ResearchSection>
      ) : null}
    </>
  );
}
