import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { ENGAGEMENT_STATUSES } from "@/modules/engagements/domain/engagement";
import { PrismaEngagementStore } from "@/modules/engagements/infrastructure/prisma-engagement-store";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";
import {
  addAssetAction,
  associateInvestigationAction,
  changeEngagementStatusAction,
  recordAuthorizationAction,
} from "../actions";
export const metadata = { title: "Engagement" };
export default function EngagementPage({ params }: { params: Promise<{ engagementId: string }> }) {
  return (
    <Suspense fallback={<p>Loading engagement…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
async function Content({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId: id } = await params;
  const session = await getSessionContext();
  const row = await new PrismaEngagementStore(getDb()).find(session.workspace.id, id);
  if (!row) notFound();
  const research = new PrismaResearchStore(getDb());
  const [targets, investigations, scopeLists] = await Promise.all([
    research.listTargets(session.workspace.id),
    research.listInvestigations(session.workspace.id, row.projectId),
    Promise.all(row.assets.map((a) => research.listScopes(session.workspace.id, a.targetId))),
  ]);
  const hidden = { engagementId: row.id };
  return (
    <div className="page-stack">
      <PageHeader
        title={row.name}
        description={
          <>
            <p>
              Keep this round of research on track. Connect targets and scope versions below, then
              update the engagement status as the work progresses.
            </p>
            {row.objective ? <p className="mt-3">{row.objective}</p> : null}
          </>
        }
      />
      <ResearchSection id="engagement-context" title="Research context">
        <p>
          {row.project.name} · {row.status}
        </p>
        <p className="text-sm text-muted-foreground">
          {row.startsAt?.toLocaleDateString() ?? "Start date unknown"} —{" "}
          {row.endsAt?.toLocaleDateString() ?? "End date unknown"}
        </p>
        {row.status !== "ARCHIVED" ? (
          <ResearchActionForm
            action={changeEngagementStatusAction}
            hidden={{ ...hidden, expectedStatus: row.status }}
            submitLabel="Update status"
            fields={[
              {
                name: "status",
                label: "Status",
                defaultValue: row.status,
                options: ENGAGEMENT_STATUSES.map((s) => ({ value: s, label: s })),
              },
            ]}
          />
        ) : null}
      </ResearchSection>
      <ResearchSection
        id="engagement-assets"
        title="Assets and scope versions"
        description="Check the approval and dates on each connected scope version. Marking this engagement active doesn't grant testing permission."
      >
        {row.assets.length ? (
          <ul>
            {row.assets.map((a) => (
              <li className="py-3" key={a.id}>
                <Link
                  className="underline"
                  href={`/dashboard/projects/${row.projectId}/targets/${a.targetId}`}
                >
                  {a.target.name}
                </Link>
                <p className="text-sm">{a.target.assetIdentifier}</p>
                {a.authorizations.map((auth) => (
                  <p className="text-sm text-muted-foreground" key={auth.id}>
                    Scope v{auth.scope.version} · {auth.scope.status} · {auth.source}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p>No assets associated.</p>
        )}
        {row.status !== "ARCHIVED" ? (
          <ResearchActionForm
            action={addAssetAction}
            hidden={hidden}
            submitLabel="Associate asset"
            fields={[
              {
                name: "targetId",
                label: "Target",
                required: true,
                options: targets
                  .filter(
                    (t) =>
                      t.projectId === row.projectId && !row.assets.some((a) => a.targetId === t.id),
                  )
                  .map((t) => ({ value: t.id, label: t.name })),
              },
            ]}
          />
        ) : null}
        {row.status !== "ARCHIVED"
          ? row.assets.map((a, i) => (
              <div className="mt-6" key={a.id}>
                <ResearchActionForm
                  action={recordAuthorizationAction}
                  hidden={{ ...hidden, assetId: a.id }}
                  submitLabel={`Associate scope for ${a.target.name}`}
                  fields={[
                    {
                      name: "scopeVersionId",
                      label: `Scope version for ${a.target.name}`,
                      required: true,
                      options: (scopeLists[i] ?? []).map((s) => ({
                        value: s.id,
                        label: `v${s.version} — ${s.status}`,
                      })),
                    },
                    {
                      name: "source",
                      label: "Association rationale / authorization reference",
                      type: "textarea",
                      required: true,
                      maxLength: 2000,
                    },
                  ]}
                />
              </div>
            ))
          : null}
      </ResearchSection>
      <ResearchSection id="engagement-investigations" title="Investigations">
        {row.investigations.map((inv) => (
          <p className="py-2" key={inv.id}>
            <Link className="underline" href={`/dashboard/investigations/${inv.id}`}>
              {inv.title}
            </Link>{" "}
            · {inv.phase}
          </p>
        ))}
        {row.status !== "ARCHIVED" ? (
          <ResearchActionForm
            action={associateInvestigationAction}
            hidden={hidden}
            submitLabel="Associate investigation"
            fields={[
              {
                name: "investigationId",
                label: "Investigation",
                required: true,
                options: investigations
                  .filter((inv) => !row.investigations.some((r) => r.id === inv.id))
                  .map((inv) => ({ value: inv.id, label: inv.title })),
              },
            ]}
          />
        ) : null}
      </ResearchSection>
    </div>
  );
}
