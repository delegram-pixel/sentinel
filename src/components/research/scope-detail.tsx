import Link from "next/link";

import { ScopeStatusBadge } from "@/components/research/project-badges";
import { ActivateScopeForm, RevokeScopeForm } from "@/components/research/scope-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { StatusLabel } from "@/components/shared/status-label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScopeRow, TargetDetail } from "@/modules/research/application/ports";
import {
  SCOPE_ACTIVITY_EFFECT_LABELS,
  SCOPE_ASSET_EFFECT_LABELS,
  SCOPE_ASSET_MATCH_LABELS,
} from "@/modules/research/domain/scope";
import { ASSET_TYPE_LABELS } from "@/modules/research/domain/target";
import { CAPABILITY_LABELS } from "@/modules/security/domain/capability";

export function ScopeDetailView({
  target,
  scope,
  canEdit,
}: {
  target: TargetDetail;
  scope: ScopeRow;
  canEdit: boolean;
}) {
  const targetPath = "/dashboard/projects/" + target.project.id + "/targets/" + target.id;
  return (
    <div className="page-stack">
      <PageHeader
        title={"Scope version " + scope.version}
        description={
          <>
            <Link href={targetPath} className="record-link">
              {target.name}
            </Link>
            <p className="record-metadata mt-2">{target.assetIdentifier}</p>
          </>
        }
        metadata={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <ScopeStatusBadge status={scope.status} />
            <EvidenceReference id={scope.id} label="Scope" />
          </div>
        }
        actions={
          canEdit && scope.status === "ACTIVE" ? (
            <RevokeScopeForm
              projectId={target.project.id}
              targetId={target.id}
              scopeId={scope.id}
            />
          ) : undefined
        }
      />
      {scope.status === "DRAFT" ? (
        <Alert variant="warning" role="note">
          <AlertDescription>
            This draft does not authorize target actions. Activate it with your authorization
            attestation to make it effective.
          </AlertDescription>
        </Alert>
      ) : null}
      {scope.status === "ACTIVE" ? (
        <Alert role="note">
          <AlertDescription>
            Self-attested authorization is recorded for this scope. Its effective dates and
            exclusions define the recorded boundaries.
          </AlertDescription>
        </Alert>
      ) : null}
      {scope.status === "REVOKED" || scope.status === "EXPIRED" ? (
        <Alert variant={scope.status === "REVOKED" ? "destructive" : "warning"} role="note">
          <AlertDescription>
            {scope.status === "REVOKED"
              ? "This scope has been revoked and no longer authorizes target actions."
              : "This scope has expired and no longer authorizes target actions."}
          </AlertDescription>
        </Alert>
      ) : null}
      {!canEdit ? (
        <Alert role="note">
          <AlertDescription>
            This project is archived. Its scope records cannot be activated or revoked.
          </AlertDescription>
        </Alert>
      ) : null}
      <ResearchSection id="scope-window" title="Effective window">
        <MetadataList
          className="grid-cols-2 lg:grid-cols-4"
          items={[
            { label: "Effective from", value: <ResearchTime date={scope.effectiveFrom} /> },
            { label: "Effective until", value: <ResearchTime date={scope.effectiveUntil} /> },
            { label: "Attested", value: <ResearchTime date={scope.approvedAt} precision="time" /> },
            { label: "Authorization artifacts", value: scope.artifactCount },
          ]}
        />
      </ResearchSection>
      <ResearchSection
        id="scope-assets"
        title="Asset boundaries"
        description="Allowed assets define the boundary. Exclusions take precedence."
      >
        {scope.assets.length === 0 ? (
          <EmptyState
            title="No assets recorded"
            description="Asset rules will appear after they are recorded in this scope."
          />
        ) : (
          <RecordTable caption={"Assets in scope version " + scope.version} minWidth="43rem">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Effect</th>
                <th scope="col">Type</th>
                <th scope="col">Match</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {scope.assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="max-w-72">
                    <span className="record-metadata">{asset.assetIdentifier}</span>
                  </td>
                  <td>
                    <StatusLabel tone={asset.effect === "EXCLUDED" ? "warning" : "neutral"}>
                      {SCOPE_ASSET_EFFECT_LABELS[asset.effect]}
                    </StatusLabel>
                  </td>
                  <td className="text-xs text-text-secondary">
                    {ASSET_TYPE_LABELS[asset.assetType]}
                  </td>
                  <td className="text-xs text-text-secondary">
                    {SCOPE_ASSET_MATCH_LABELS[asset.matchType]}
                  </td>
                  <td className="max-w-64 text-xs text-text-secondary">
                    {asset.notes ?? "No notes"}
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        )}
      </ResearchSection>
      <ResearchSection
        id="scope-activities"
        title="Recorded activities"
        description="These are the declared scope rules. Each action still requires its permitted capability."
      >
        {scope.activities.length === 0 ? (
          <EmptyState
            title="No activities recorded"
            description="Permitted and prohibited activities will appear here when recorded."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {scope.activities.map((activity) => (
              <li
                key={activity.activity}
                className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0"
              >
                <span className="text-sm">{CAPABILITY_LABELS[activity.activity]}</span>
                <StatusLabel tone={activity.effect === "PERMITTED" ? "neutral" : "warning"}>
                  {SCOPE_ACTIVITY_EFFECT_LABELS[activity.effect]}
                </StatusLabel>
              </li>
            ))}
          </ul>
        )}
      </ResearchSection>
      {scope.attestationNotes ? (
        <ResearchSection id="attestation-notes" title="Attestation notes">
          <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">
            {scope.attestationNotes}
          </p>
        </ResearchSection>
      ) : null}
      {canEdit && scope.status === "DRAFT" ? (
        <ResearchSection
          id="scope-activation"
          title="Activate this scope"
          description="Confirm the source and date of your permission. Activation supersedes the previous active version."
        >
          <div className="max-w-2xl">
            <ActivateScopeForm
              projectId={target.project.id}
              targetId={target.id}
              scopeId={scope.id}
            />
          </div>
        </ResearchSection>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="link" size="sm">
          <Link href={targetPath}>Back to target</Link>
        </Button>
        <p className="text-xs text-text-secondary">
          Created <ResearchTime date={scope.createdAt} precision="time" />
        </p>
      </div>
    </div>
  );
}
export function ScopeDetailSkeleton() {
  return (
    <div className="page-stack" role="status">
      <span className="sr-only">Loading scope…</span>
      <Skeleton className="h-12 w-1/2" aria-hidden />
      <RecordListSkeleton label="Loading scope rules" />
    </div>
  );
}
