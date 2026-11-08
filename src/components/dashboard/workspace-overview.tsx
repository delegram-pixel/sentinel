import Link from "next/link";
import type { ReactNode } from "react";

import { InvestigationStatusBadge } from "@/components/research/investigation-badges";
import { WorkspaceMapEntry } from "@/components/onboarding/workspace-map-provider";
import { RedactionStatusBadge } from "@/components/research/phase6-badges";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { ResearchTime } from "@/components/shared/research-time";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { SessionContext } from "@/modules/auth/application/ports";
import type { EvidenceRow } from "@/modules/evidence/application/ports";
import type {
  InvestigationListRow,
  ProjectListRow,
  TargetListRow,
} from "@/modules/research/application/ports";
import { TARGET_AUTHORIZATION_LABELS } from "@/modules/research/domain/target";
import type { WorkspaceOverview } from "@/modules/workspaces";

type DashboardOverviewProps = {
  session: SessionContext;
  overview: WorkspaceOverview;
  projects: ProjectListRow[];
  investigations: InvestigationListRow[];
  targets: TargetListRow[];
  activity: ReactNode;
  nextActions: ReactNode;
  recentEvidence: EvidenceRow[];
};

export function DashboardOverview({
  session,
  overview,
  projects,
  investigations,
  targets,
  activity,
  nextActions,
  recentEvidence,
}: DashboardOverviewProps) {
  const openProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const openProjectIds = new Set(openProjects.map((project) => project.id));
  const hasSelectableTargets = targets.some((target) => openProjectIds.has(target.projectId));
  const firstOpenProject = openProjects[0];
  const primaryHref = hasSelectableTargets
    ? "/dashboard/investigations/new"
    : firstOpenProject
      ? `/dashboard/projects/${firstOpenProject.id}/targets/new`
      : "/dashboard/projects/new";
  const primaryLabel = hasSelectableTargets
    ? "New investigation"
    : openProjects.length
      ? "Register target"
      : "Create project";
  const attention = [
    ...openProjects
      .filter((project) => project.targetCount === 0)
      .map((project) => ({
        id: project.id,
        title: project.name,
        detail: "No targets registered",
        href: "/dashboard/projects/" + project.id + "/targets/new",
      })),
    ...targets
      .filter(
        (target) =>
          openProjectIds.has(target.projectId) && target.authorizationStatus !== "AUTHORIZED",
      )
      .map((target) => ({
        id: target.id,
        title: target.name,
        detail: TARGET_AUTHORIZATION_LABELS[target.authorizationStatus],
        href: "/dashboard/projects/" + target.projectId + "/targets/" + target.id,
      })),
  ].slice(0, 5);
  const recent = investigations.slice(0, 6);

  return (
    <div className="page-stack">
      <PageHeader
        title="Research overview"
        description="Welcome back. Pick up a recent investigation, check what needs attention, or start something new. Your saved next actions are here when you need a nudge."
        metadata={<p className="text-xs text-text-secondary">{session.workspace.name}</p>}
        actions={
          <>
            <Button asChild>
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            {hasSelectableTargets ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/projects/new">New project</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <WorkspaceMapEntry />
      <div className="grid min-w-0 gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <ResearchSection
          id="recent-investigations"
          title={
            <>
              Recent investigations{" "}
              <span className="ml-3 text-xs font-normal text-text-secondary">
                {overview.activeInvestigationCount} active
              </span>
            </>
          }
          action={
            <Button asChild variant="link" size="sm">
              <Link href="/dashboard/investigations">All investigations</Link>
            </Button>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              title="No investigations yet"
              description={
                projects.length === 0
                  ? "Start with a project, add a target, then open an investigation for your first question. Your notes and ideas will stay together here."
                  : "Open an investigation for a question you'd like to explore. Save observations, ideas, and next steps so you can pick it up later."
              }
              action={
                <Button asChild variant="outline">
                  <Link
                    href={
                      hasSelectableTargets ? "/dashboard/investigations/new" : "/dashboard/projects"
                    }
                  >
                    {hasSelectableTargets ? "Start an investigation" : "Browse projects"}
                  </Link>
                </Button>
              }
            />
          ) : (
            <RecordTable caption="Recent investigations" minWidth="31rem">
              <thead>
                <tr>
                  <th scope="col">Investigation</th>
                  <th scope="col">Lifecycle</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((investigation) => (
                  <tr key={investigation.id}>
                    <td className="max-w-80">
                      <Link
                        href={"/dashboard/investigations/" + investigation.id}
                        className="record-link"
                      >
                        {investigation.title}
                      </Link>
                      <p className="mt-1 text-xs text-text-secondary">{investigation.targetName}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {investigation.projectName}
                      </p>
                    </td>
                    <td>
                      <InvestigationStatusBadge status={investigation.status} />
                    </td>
                    <td>
                      <time
                        className="record-metadata"
                        dateTime={investigation.updatedAt.toISOString()}
                      >
                        {formatDate(investigation.updatedAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </RecordTable>
          )}
        </ResearchSection>
        <div className="flex min-w-0 flex-col gap-6">
          <ResearchSection
            id="requires-attention"
            title="Requires attention"
            action={
              <Button asChild variant="link" size="sm">
                <Link href="/dashboard/projects">Projects</Link>
              </Button>
            }
          >
            {attention.length === 0 ? (
              <EmptyState
                title="No setup or scope items"
                description="When a project needs a target or an asset's permission needs attention, you'll see it here."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {attention.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0">
                    <Link href={item.href} className="record-link">
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-warning">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-text-secondary">
              {overview.projectCount} projects in this workspace, including archived records.
            </p>
          </ResearchSection>
          <ResearchSection id="finding-review" title="Findings awaiting validation">
            <p className="text-sm">
              <span className="font-mono" data-count="validation">
                {overview.validationQueueCount}
              </span>{" "}
              awaiting validation
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Open the finding and check its evidence. A human reviewer needs to decide whether
              it&apos;s confirmed.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-text-secondary">
                <span data-count="confirmed">{overview.confirmedFindingCount}</span> confirmed or
                reportable
              </span>
              <Button asChild variant="link" size="sm">
                <Link href="/dashboard/findings">View findings</Link>
              </Button>
            </div>
          </ResearchSection>
        </div>
        {activity}
        {nextActions}
        <ResearchSection
          id="evidence-activity"
          title="Evidence activity"
          className="xl:col-span-2"
          action={
            <Button asChild variant="link" size="sm">
              <Link href="/dashboard/evidence">Evidence library</Link>
            </Button>
          }
        >
          {recentEvidence.length ? (
            <RecordTable caption="Recent evidence activity" minWidth="42rem">
              <thead>
                <tr>
                  <th scope="col">Evidence record</th>
                  <th scope="col">Investigation</th>
                  <th scope="col">Redaction</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {recentEvidence.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/dashboard/evidence/${item.id}`} className="record-link">
                        {item.title}
                      </Link>
                      <p className="record-metadata mt-1">{item.fileName}</p>
                      <div className="mt-1">
                        <EvidenceReference id={item.id} />
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/investigations/${item.investigationId}`}
                        className="text-sm hover:text-primary hover:underline"
                      >
                        {item.investigationTitle}
                      </Link>
                    </td>
                    <td>
                      <RedactionStatusBadge status={item.redactionStatus} />
                    </td>
                    <td>
                      <ResearchTime date={item.createdAt} precision="time" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </RecordTable>
          ) : (
            <EmptyState
              title="No evidence activity recorded"
              description="Upload evidence from an investigation. You'll see the files, source details, and redaction status here as the research grows."
            />
          )}
        </ResearchSection>
      </div>
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="page-stack" role="status" aria-busy="true">
      <span className="sr-only">Loading research overview…</span>
      <PageHeader
        title="Research overview"
        description="Welcome back. Pick up a recent investigation, check what needs attention, or start something new. Your saved next actions are here when you need a nudge."
      />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]" aria-hidden>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-3/4" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      </div>
    </div>
  );
}
