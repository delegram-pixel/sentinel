import Link from "next/link";

import { ProjectStatusBadge, ProjectTypeBadge } from "@/components/research/project-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchTime } from "@/components/shared/research-time";
import { Button } from "@/components/ui/button";
import type { ProjectListRow } from "@/modules/research/application/ports";

export function ProjectList({ projects }: { projects: ProjectListRow[] }) {
  if (projects.length === 0)
    return (
      <EmptyState
        headingLevel={2}
        title="No projects yet"
        description="Create a project to group the targets, scope, and investigations for one piece of research."
        action={
          <Button asChild>
            <Link href="/dashboard/projects/new">Create the first project</Link>
          </Button>
        }
      />
    );

  return (
    <div className="min-w-0">
      <p className="mb-4 text-xs text-text-secondary">
        {projects.length} projects, including archived records
      </p>
      <RecordTable caption="Projects" minWidth="48rem">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Lifecycle</th>
            <th scope="col">Type</th>
            <th scope="col">Targets</th>
            <th scope="col">Investigations</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="max-w-80">
                <Link href={"/dashboard/projects/" + project.id} className="record-link">
                  {project.name}
                </Link>
                <p className="mt-2 line-clamp-2 max-w-sm text-xs leading-relaxed text-text-secondary">
                  {project.description ?? "No description recorded."}
                </p>
              </td>
              <td>
                <ProjectStatusBadge status={project.status} />
              </td>
              <td>
                <ProjectTypeBadge projectType={project.projectType} />
              </td>
              <td>
                <span className="font-mono text-xs tabular-nums">{project.targetCount}</span>
                <p className="mt-1 text-xs text-text-secondary">
                  {project.authorizedTargetCount} authorized
                </p>
              </td>
              <td className="font-mono text-xs tabular-nums">{project.investigationCount}</td>
              <td>
                <ResearchTime date={project.updatedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </RecordTable>
    </div>
  );
}
export function ProjectListSkeleton() {
  return <RecordListSkeleton label="Loading projects" />;
}
