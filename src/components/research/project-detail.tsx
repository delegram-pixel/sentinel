import Link from "next/link";

import { ArchiveProjectForm } from "@/components/research/archive-project-form";
import { InvestigationList } from "@/components/research/investigation-list";
import { ProjectStatusBadge, ProjectTypeBadge } from "@/components/research/project-badges";
import { TargetList } from "@/components/research/target-list";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { InvestigationListRow, ProjectDetail } from "@/modules/research/application/ports";

export function ProjectDetailView({
  project,
  investigations = [],
}: {
  project: ProjectDetail;
  investigations?: InvestigationListRow[];
}) {
  const canEdit = project.status !== "ARCHIVED";
  const base = "/dashboard/projects/" + project.id;
  return (
    <div className="page-stack">
      <PageHeader
        title={project.name}
        description={project.description ?? "No description recorded."}
        metadata={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <ProjectStatusBadge status={project.status} />
            <ProjectTypeBadge projectType={project.projectType} />
            <EvidenceReference id={project.id} label="Project" />
          </div>
        }
        actions={
          <>
            {canEdit ? (
              <>
                <Button asChild>
                  <Link
                    href={
                      project.targetCount > 0
                        ? "/dashboard/investigations/new?projectId=" + project.id
                        : base + "/targets/new"
                    }
                  >
                    {project.targetCount > 0 ? "New investigation" : "Register target"}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={base + "/edit"}>Edit project</Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {!canEdit ? (
        <Alert role="note">
          <AlertDescription>
            This project is archived. Its research history remains available, and its records cannot
            be changed.
          </AlertDescription>
        </Alert>
      ) : null}
      <MetadataList
        className="grid-cols-2 gap-x-8 sm:grid-cols-4"
        label="Project context"
        items={[
          { label: "Targets", value: project.targetCount },
          { label: "Authorized targets", value: project.authorizedTargetCount },
          { label: "Investigations", value: project.investigationCount },
          { label: "Created", value: <ResearchTime date={project.createdAt} /> },
        ]}
      />
      <ResearchSection
        id="project-targets"
        title="Targets"
        action={
          <>
            <Button asChild variant="link" size="sm">
              <Link href={base + "/targets"}>All targets</Link>
            </Button>
            {canEdit ? (
              <Button asChild variant="outline" size="sm">
                <Link href={base + "/targets/new"}>Register target</Link>
              </Button>
            ) : null}
          </>
        }
      >
        <TargetList
          targets={project.targets}
          projectId={project.id}
          projectName={project.name}
          canCreate={canEdit}
          emptyHeadingLevel={3}
        />
      </ResearchSection>
      <ResearchSection
        id="project-investigations"
        title="Investigations"
        action={
          <Button asChild variant="link" size="sm">
            <Link href={base + "/investigations"}>All investigations</Link>
          </Button>
        }
      >
        <InvestigationList
          investigations={investigations}
          projectId={project.id}
          projectName={project.name}
          canCreate={canEdit}
          emptyHeadingLevel={3}
        />
      </ResearchSection>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <Button asChild variant="link" size="sm">
          <Link href="/dashboard/projects">All projects</Link>
        </Button>
        {canEdit ? <ArchiveProjectForm projectId={project.id} /> : null}
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="page-stack" role="status">
      <span className="sr-only">Loading project…</span>
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <RecordListSkeleton label="Loading project records" />
    </div>
  );
}
export function ProjectNotFoundNote() {
  return (
    <EmptyState
      title="Project not found"
      description="This project is unavailable in your workspace."
      action={
        <Button asChild>
          <Link href="/dashboard/projects">Back to projects</Link>
        </Button>
      }
    />
  );
}
