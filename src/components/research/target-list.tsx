import Link from "next/link";

import { TargetAuthorizationBadge } from "@/components/research/project-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchTime } from "@/components/shared/research-time";
import { Button } from "@/components/ui/button";
import type { TargetListRow } from "@/modules/research/application/ports";
import { ASSET_TYPE_LABELS, ENVIRONMENT_TYPE_LABELS } from "@/modules/research/domain/target";

type TargetListProps = {
  targets: TargetListRow[];
  projectId?: string;
  projectName?: string;
  canCreate?: boolean;
  emptyHeadingLevel?: 2 | 3;
};

export function TargetList({
  targets,
  projectId,
  projectName,
  canCreate = true,
  emptyHeadingLevel = 2,
}: TargetListProps) {
  if (targets.length === 0)
    return (
      <EmptyState
        headingLevel={emptyHeadingLevel}
        title={projectId ? "No targets in this project" : "No targets yet"}
        description={
          projectId
            ? "Register an asset to record its authorization and draft a scope version."
            : "Targets belong to projects. Open a project to register an asset and record its scope."
        }
        action={
          canCreate ? (
            <Button asChild variant="outline">
              <Link
                href={
                  projectId
                    ? "/dashboard/projects/" + projectId + "/targets/new"
                    : "/dashboard/projects"
                }
              >
                {projectId ? "Register target" : "Go to projects"}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  const showProject = !projectId;

  return (
    <RecordTable
      caption={
        projectId ? "Targets in " + (projectName ?? "this project") : "Targets across projects"
      }
      minWidth={showProject ? "52rem" : "43rem"}
    >
      <thead>
        <tr>
          <th scope="col">Target</th>
          <th scope="col">Authorization</th>
          {showProject ? <th scope="col">Project</th> : null}
          <th scope="col">Environment</th>
          <th scope="col">Active scope</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((target) => (
          <tr key={target.id}>
            <td className="max-w-72">
              <Link
                href={"/dashboard/projects/" + target.projectId + "/targets/" + target.id}
                className="record-link"
              >
                {target.name}
              </Link>
              <p className="record-metadata mt-1">{target.assetIdentifier}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {ASSET_TYPE_LABELS[target.assetType]}
              </p>
            </td>
            <td>
              <TargetAuthorizationBadge status={target.authorizationStatus} />
              {target.authorizationStatus === "AUTHORIZED" ? (
                <p className="mt-1 text-xs text-text-secondary">Self-attested</p>
              ) : null}
              {target.authorizationExpiresAt ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Until <ResearchTime date={target.authorizationExpiresAt} />
                </p>
              ) : null}
            </td>
            {showProject ? (
              <td className="max-w-44">
                <Link href={"/dashboard/projects/" + target.projectId} className="record-link">
                  {target.projectName}
                </Link>
              </td>
            ) : null}
            <td className="text-xs text-text-secondary">
              {ENVIRONMENT_TYPE_LABELS[target.environmentType]}
            </td>
            <td className="font-mono text-xs">
              {target.activeScopeVersion === null ? (
                <span className="font-sans text-text-secondary">No active scope</span>
              ) : (
                "v" + target.activeScopeVersion
              )}
            </td>
            <td>
              <ResearchTime date={target.updatedAt} />
            </td>
          </tr>
        ))}
      </tbody>
    </RecordTable>
  );
}
export function TargetListSkeleton() {
  return <RecordListSkeleton label="Loading targets" />;
}
