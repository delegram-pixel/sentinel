import Link from "next/link";

import { InvestigationStatusBadge } from "@/components/research/investigation-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchTime } from "@/components/shared/research-time";
import { Button } from "@/components/ui/button";
import type { InvestigationListRow } from "@/modules/research/application/ports";

type InvestigationListProps = {
  investigations: InvestigationListRow[];
  projectId?: string;
  projectName?: string;
  canCreate?: boolean;
  emptyHeadingLevel?: 2 | 3;
};

export function InvestigationList({
  investigations,
  projectId,
  projectName,
  canCreate = true,
  emptyHeadingLevel = 2,
}: InvestigationListProps) {
  if (investigations.length === 0)
    return (
      <EmptyState
        headingLevel={emptyHeadingLevel}
        title={projectId ? "No investigations in this project" : "No investigations yet"}
        description="Start with a question you'd like to explore. An investigation keeps the clues, ideas, and session notes together so you can resume without retracing every step."
        action={
          canCreate ? (
            <Button asChild variant="outline">
              <Link
                href={
                  projectId
                    ? "/dashboard/investigations/new?projectId=" + projectId
                    : "/dashboard/investigations/new"
                }
              >
                New investigation
              </Link>
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <RecordTable
      caption={
        projectId
          ? "Investigations in " + (projectName ?? "this project")
          : "Investigations across projects"
      }
      minWidth="49rem"
    >
      <thead>
        <tr>
          <th scope="col">Investigation</th>
          <th scope="col">Lifecycle</th>
          <th scope="col">Target</th>
          <th scope="col">Research record</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        {investigations.map((investigation) => (
          <tr key={investigation.id}>
            <td className="max-w-72">
              <Link href={"/dashboard/investigations/" + investigation.id} className="record-link">
                {investigation.title}
              </Link>
              {!projectId ? (
                <p className="mt-1 text-xs text-text-secondary">
                  <Link
                    href={"/dashboard/projects/" + investigation.projectId}
                    className="hover:text-primary"
                  >
                    {investigation.projectName}
                  </Link>
                </p>
              ) : null}
              {investigation.category ? (
                <p className="mt-1 text-xs text-text-secondary">{investigation.category}</p>
              ) : null}
            </td>
            <td>
              <InvestigationStatusBadge status={investigation.status} />
            </td>
            <td className="max-w-60">
              <Link
                href={
                  "/dashboard/projects/" +
                  investigation.projectId +
                  "/targets/" +
                  investigation.targetId
                }
                className="record-link"
              >
                {investigation.targetName}
              </Link>
              <p className="record-metadata mt-1">{investigation.targetAssetIdentifier}</p>
            </td>
            <td>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs text-text-secondary">
                <dt className="order-2">observations</dt>
                <dd className="order-1 font-mono tabular-nums">{investigation.observationCount}</dd>
                <dt className="order-4">hypotheses</dt>
                <dd className="order-3 font-mono tabular-nums">{investigation.hypothesisCount}</dd>
                <dt className="order-6">summaries</dt>
                <dd className="order-5 font-mono tabular-nums">{investigation.summaryCount}</dd>
              </dl>
            </td>
            <td>
              <ResearchTime date={investigation.updatedAt} />
            </td>
          </tr>
        ))}
      </tbody>
    </RecordTable>
  );
}
export function InvestigationListSkeleton() {
  return <RecordListSkeleton label="Loading investigations" />;
}
