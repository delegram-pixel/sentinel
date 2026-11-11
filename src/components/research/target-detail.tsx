import Link from "next/link";

import { ScopeStatusBadge, TargetAuthorizationBadge } from "@/components/research/project-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { MetadataList } from "@/components/shared/metadata-list";
import { PageHeader } from "@/components/shared/page-header";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TargetDetail } from "@/modules/research/application/ports";
import { ASSET_TYPE_LABELS, ENVIRONMENT_TYPE_LABELS } from "@/modules/research/domain/target";

export function TargetDetailView({
  target,
  canEdit,
  justRegistered = false,
}: {
  target: TargetDetail;
  canEdit: boolean;
  justRegistered?: boolean;
}) {
  const base = "/dashboard/projects/" + target.project.id + "/targets/" + target.id;
  return (
    <div className="page-stack">
      <PageHeader
        title={target.name}
        description={
          <>
            <p>
              Check this asset&apos;s details and your source of permission. Review its scope
              history below, or draft a new version when the testing boundaries change.
            </p>
            <p className="record-metadata mt-2">{target.assetIdentifier}</p>
            {target.description ? <p className="mt-3">{target.description}</p> : null}
          </>
        }
        metadata={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <TargetAuthorizationBadge status={target.authorizationStatus} />
            <span className="text-xs text-text-secondary">
              {ASSET_TYPE_LABELS[target.assetType]}
            </span>
            <EvidenceReference id={target.id} label="Target" />
          </div>
        }
        actions={
          canEdit ? (
            <>
              <Button asChild>
                <Link href={base + "/scopes/new"}>Draft scope version</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={base + "/edit"}>Edit target</Link>
              </Button>
            </>
          ) : undefined
        }
      />
      {justRegistered ? (
        <Alert variant="success">
          <AlertTitle>Target registered successfully</AlertTitle>
          <AlertDescription>
            <p>
              Your asset has been added to this workspace. The next step is to define and approve
              its research scope.
            </p>
            <p className="mt-2">
              Registering this target did not activate a scope. The scope lifecycle stays separate:
            </p>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
              <li>Target registration records the asset and your authorization context.</li>
              <li>Drafting a scope defines the permitted assets, activities and dates.</li>
              <li>
                Reviewing and activating a draft records your approval and makes those boundaries
                active.
              </li>
            </ol>
            <div className="mt-4">
              <Button asChild size="sm">
                <Link href={base + "/scopes/new"}>Create scope</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {!canEdit ? (
        <Alert role="note">
          <AlertDescription>
            This target&apos;s project is archived. You can still read the history; editing is
            closed.
          </AlertDescription>
        </Alert>
      ) : null}
      <MetadataList
        className="grid-cols-2 gap-x-8 lg:grid-cols-4"
        label="Target context"
        items={[
          {
            label: "Project",
            value: (
              <Link href={"/dashboard/projects/" + target.project.id} className="record-link">
                {target.project.name}
              </Link>
            ),
          },
          { label: "Environment", value: ENVIRONMENT_TYPE_LABELS[target.environmentType] },
          {
            label: "Active scope",
            value:
              target.activeScopeVersion === null ? (
                "No active scope"
              ) : (
                <span className="font-mono text-xs">{"v" + target.activeScopeVersion}</span>
              ),
          },
          {
            label: "Authorization until",
            value: <ResearchTime date={target.authorizationExpiresAt} />,
          },
        ]}
      />
      <ResearchSection
        id="authorization-context"
        title="Authorization context"
        description="Here's where you've recorded your permission to research this asset. Sentinel relies on your attestation, so check that the source and scope are current."
      >
        <MetadataList
          className="sm:grid-cols-2"
          items={[
            {
              label: "Program or agreement",
              value: (
                <>
                  {target.programName ?? "Not recorded"}
                  {target.programUrl ? (
                    <a
                      href={target.programUrl}
                      className="ml-3 text-xs text-primary underline underline-offset-4"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Open reference<span className="sr-only"> in a new tab</span>
                    </a>
                  ) : null}
                </>
              ),
            },
            { label: "Authorization source", value: target.authorizationSource ?? "Not recorded" },
            {
              label: "Authorization date",
              value: <ResearchTime date={target.authorizationDate} />,
            },
            {
              label: "Permission notes",
              value: (
                <p className="whitespace-pre-wrap text-text-secondary">
                  {target.authorizationNotes ?? "No notes recorded."}
                </p>
              ),
            },
          ]}
        />
      </ResearchSection>
      <ResearchSection
        id="target-scopes"
        title="Scope versions"
        action={
          canEdit ? (
            <Button asChild variant="link" size="sm">
              <Link href={base + "/scopes/new"}>Draft scope version</Link>
            </Button>
          ) : undefined
        }
      >
        {target.scopes.length === 0 ? (
          <EmptyState
            title="No scope versions yet"
            description="Draft a scope to spell out what's allowed, what's excluded, and when permission applies. Activate it with an attestation before testing."
          />
        ) : (
          <RecordTable caption={"Scope versions for " + target.name} minWidth="43rem">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">State</th>
                <th scope="col">Effective window</th>
                <th scope="col">Recorded rules</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {target.scopes.map((scope) => (
                <tr key={scope.id}>
                  <td>
                    <Link
                      href={base + "/scopes/" + scope.id}
                      className="record-link font-mono text-xs"
                    >
                      {"v" + scope.version}
                    </Link>
                  </td>
                  <td>
                    <ScopeStatusBadge status={scope.status} />
                  </td>
                  <td>
                    <ResearchTime date={scope.effectiveFrom} />
                    <span className="block text-xs text-text-secondary">until</span>
                    <ResearchTime date={scope.effectiveUntil} />
                  </td>
                  <td className="text-xs text-text-secondary">
                    <p>
                      {scope.assets.filter((asset) => asset.effect === "ALLOWED").length} allowed
                      assets
                    </p>
                    <p className="mt-1">
                      {scope.assets.filter((asset) => asset.effect === "EXCLUDED").length} excluded
                      assets
                    </p>
                    <p className="mt-1">{scope.activities.length} activities</p>
                  </td>
                  <td>
                    <ResearchTime date={scope.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        )}
      </ResearchSection>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="link" size="sm">
          <Link href={"/dashboard/projects/" + target.project.id + "/targets"}>
            All targets in this project
          </Link>
        </Button>
        <p className="text-xs text-text-secondary">
          Updated <ResearchTime date={target.updatedAt} precision="time" />
        </p>
      </div>
    </div>
  );
}
export function TargetDetailSkeleton() {
  return (
    <div className="page-stack" role="status">
      <span className="sr-only">Loading target…</span>
      <Skeleton className="h-12 w-2/3" aria-hidden />
      <Skeleton className="h-5 w-1/2" aria-hidden />
      <RecordListSkeleton label="Loading target records" />
    </div>
  );
}
