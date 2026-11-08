import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  DashboardOverview,
  DashboardOverviewSkeleton,
} from "@/components/dashboard/workspace-overview";
import { AuditHistory, AuditHistorySkeleton } from "@/components/shared/audit-history";
import { EmptyState } from "@/components/shared/empty-state";
import { ResearchSection } from "@/components/shared/research-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaAuditHistoryStore } from "@/modules/audit";
import type { SessionContext } from "@/modules/auth/application/ports";
import { listEvidence } from "@/modules/evidence/application/evidence-service";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import {
  getInvestigation,
  listInvestigations,
} from "@/modules/research/application/investigation-service";
import { listProjects } from "@/modules/research/application/project-service";
import { listTargets } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";
import { PrismaWorkspaceOverviewStore } from "@/modules/workspaces";

export const metadata: Metadata = { title: "Research overview" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardOverviewSkeleton />}>
      <WorkspaceDashboard />
    </Suspense>
  );
}

async function WorkspaceDashboard() {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const [overview, projects, investigations, targets, evidence] = await Promise.all([
    new PrismaWorkspaceOverviewStore(getDb()).getOverview({
      userId: session.user.id,
      workspaceId: session.workspace.id,
    }),
    listProjects(store, session.workspace.id),
    listInvestigations(store, session.workspace.id),
    listTargets(store, session.workspace.id),
    listEvidence(new PrismaEvidenceStore(getDb()), {
      userId: session.user.id,
      workspaceId: session.workspace.id,
      role: session.role,
    }),
  ]);
  if (!overview) notFound();
  const continuation = investigations.find(
    (investigation) => investigation.summaryCount > 0 && investigation.status !== "ARCHIVED",
  );

  return (
    <DashboardOverview
      session={session}
      overview={overview}
      projects={projects}
      investigations={investigations}
      targets={targets}
      recentEvidence={evidence.slice(0, 5)}
      activity={
        <Suspense fallback={<AuditHistorySkeleton />}>
          <RecentWorkspaceActivity session={session} />
        </Suspense>
      }
      nextActions={
        <Suspense fallback={<NextActionsSkeleton />}>
          <SavedNextActions session={session} investigationId={continuation?.id} />
        </Suspense>
      }
    />
  );
}

async function RecentWorkspaceActivity({ session }: { session: SessionContext }) {
  const entries = await new PrismaAuditHistoryStore(getDb()).listWorkspaceHistory(
    { userId: session.user.id, workspaceId: session.workspace.id },
    5,
  );
  return (
    <AuditHistory
      entries={entries}
      title="Recent activity"
      action={
        <Button asChild variant="link" size="sm">
          <Link href="/dashboard/settings#audit-history">View history</Link>
        </Button>
      }
    />
  );
}

async function SavedNextActions({
  session,
  investigationId,
}: {
  session: SessionContext;
  investigationId?: string;
}) {
  const investigation = investigationId
    ? await getInvestigation(
        new PrismaResearchStore(getDb()),
        session.workspace.id,
        investigationId,
      )
    : null;
  const summary = investigation?.summaries[0];

  return (
    <ResearchSection id="next-actions" title="Next actions">
      {summary && summary.nextActions.length > 0 ? (
        <>
          <p className="mb-4 text-xs text-text-secondary">
            Saved in{" "}
            <Link
              href={"/dashboard/investigations/" + investigation!.id + "#session-summaries"}
              className="record-link"
            >
              {investigation!.title}
            </Link>
          </p>
          <ul className="flex flex-col gap-3">
            {summary.nextActions.map((action, index) => (
              <li key={index} className="border-l border-border pl-3 text-sm leading-relaxed">
                {action}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          title={
            investigationId && !investigation
              ? "Session notes unavailable"
              : "No saved next actions"
          }
          description="Leave your next steps in an investigation's session summary. They'll show up here to help you pick up where you left off."
          action={
            <Button asChild variant="link" size="sm">
              <Link href="/dashboard/investigations">Open investigations</Link>
            </Button>
          }
        />
      )}
    </ResearchSection>
  );
}

function NextActionsSkeleton() {
  return (
    <ResearchSection id="next-actions" title="Next actions">
      <div role="status">
        <span className="sr-only">Loading next actions…</span>
        <Skeleton className="h-16 w-full" aria-hidden />
      </div>
    </ResearchSection>
  );
}
