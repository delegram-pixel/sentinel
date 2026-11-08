import Link from "next/link";

import { ReportStatusBadge } from "@/components/research/report-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchTime } from "@/components/shared/research-time";
import { Button } from "@/components/ui/button";
import type { ReportRow } from "@/modules/reports/application/ports";

export function ReportList({ reports }: { reports: ReportRow[] }) {
  if (!reports.length) {
    return (
      <EmptyState
        headingLevel={2}
        title="No reports recorded"
        description="Open an investigation with confirmed or reportable findings to start a report. Save revisions as you refine it, then get human approval before exporting."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/reports/new">Create a report</Link>
          </Button>
        }
      />
    );
  }

  return (
    <RecordTable caption="Report records" minWidth="52rem">
      <thead>
        <tr>
          <th scope="col">Report</th>
          <th scope="col">Status</th>
          <th scope="col">Findings</th>
          <th scope="col">Latest revision</th>
          <th scope="col">Approved</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => (
          <tr key={report.id}>
            <td className="max-w-80">
              <Link href={`/dashboard/reports/${report.id}`} className="record-link break-words">
                {report.title}
              </Link>
              <p className="mt-1 text-xs text-text-secondary">{report.investigationTitle}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {report.templateName
                  ? `${report.templateName} (v${report.templateVersion ?? 1})`
                  : "Built-in sections"}
              </p>
            </td>
            <td>
              <ReportStatusBadge status={report.status} />
            </td>
            <td className="font-mono text-xs">{report.findingCount}</td>
            <td className="font-mono text-xs">v{report.latestRevisionVersion}</td>
            <td>
              <ResearchTime date={report.approvedAt} precision="time" empty="Not approved" />
            </td>
            <td>
              <ResearchTime date={report.updatedAt} />
            </td>
          </tr>
        ))}
      </tbody>
    </RecordTable>
  );
}
