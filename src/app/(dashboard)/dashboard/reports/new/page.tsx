import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReportCreateForm } from "@/components/research/report-create-form";
import { EmptyState } from "@/components/shared/empty-state";
import { FormPage, FormSkeleton } from "@/components/shared/form-page";
import { RecordTable } from "@/components/shared/record-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  getReportInvestigation,
  listEligibleReportFindings,
  listReportableInvestigations,
  listReportTemplates,
} from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

export const metadata: Metadata = {
  title: "New report",
};

export const instant = false;

type NewReportPageProps = {
  searchParams: Promise<{ investigationId?: string; findingId?: string }>;
};

export default function NewReportPage({ searchParams }: NewReportPageProps) {
  return (
    <Suspense fallback={<FormSkeleton label="Loading report builder" />}>
      <NewReportContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewReportContent({ searchParams }: NewReportPageProps) {
  const { investigationId, findingId } = await searchParams;
  const session = await getSessionContext();
  const store = new PrismaReportStore(getDb());

  if (!investigationId) {
    const investigations = await listReportableInvestigations(store, session.workspace.id);

    return (
      <FormPage
        title="New report"
        description="Start with an investigation below that has a confirmed or reportable finding. You'll choose what to include and create a draft you can review before sharing."
        backHref="/dashboard/reports"
        backLabel="Back to reports"
      >
        {investigations.length ? (
          <RecordTable caption="Investigations with reportable findings" minWidth="34rem">
            <thead>
              <tr>
                <th scope="col">Investigation</th>
                <th scope="col">Project</th>
                <th scope="col">Eligible findings</th>
              </tr>
            </thead>
            <tbody>
              {investigations.map((investigation) => (
                <tr key={investigation.id}>
                  <td>
                    <Link
                      href={`/dashboard/reports/new?investigationId=${investigation.id}`}
                      className="record-link"
                    >
                      {investigation.title}
                    </Link>
                  </td>
                  <td className="text-xs text-text-secondary">{investigation.projectName}</td>
                  <td className="font-mono text-xs">{investigation.eligibleFindingCount}</td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        ) : (
          <EmptyState
            title="No reportable investigations"
            description="Ask a human reviewer to verify a finding first. Once it's confirmed or reportable, you can create a report from the investigation."
            action={
              <Link href="/dashboard/investigations" className="record-link">
                Open investigations
              </Link>
            }
          />
        )}
      </FormPage>
    );
  }

  const [investigation, findings, templates] = await Promise.all([
    getReportInvestigation(store, session.workspace.id, investigationId),
    listEligibleReportFindings(store, session.workspace.id, investigationId),
    listReportTemplates(store, session.workspace.id, { activeOnly: true }),
  ]);

  if (!investigation) {
    notFound();
  }

  const isArchived =
    investigation.projectStatus === "ARCHIVED" || investigation.investigationStatus === "ARCHIVED";

  return (
    <FormPage
      title="New report"
      description={`Build a write-up for ${investigation.investigationTitle}. Choose the confirmed findings and a template, then create a draft to edit and send for review.`}
      backHref={`/dashboard/investigations/${investigation.id}`}
      backLabel="Back to investigation"
    >
      {isArchived ? (
        <Alert variant="warning">
          <AlertTitle>Research record archived</AlertTitle>
          <AlertDescription>
            Reports cannot be created from an archived project or investigation.
          </AlertDescription>
        </Alert>
      ) : findings.length ? (
        <ReportCreateForm
          investigationId={investigation.id}
          investigationTitle={investigation.investigationTitle}
          findings={findings}
          templates={templates}
          initialFindingId={findingId}
        />
      ) : (
        <EmptyState
          title="No eligible findings"
          description="Have a human reviewer confirm or mark a finding reportable first, then include it in the report."
          action={
            <Link href={`/dashboard/investigations/${investigation.id}`} className="record-link">
              Review investigation findings
            </Link>
          }
        />
      )}
    </FormPage>
  );
}
