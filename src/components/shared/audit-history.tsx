import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ResearchSection } from "@/components/shared/research-section";
import { Skeleton } from "@/components/ui/skeleton";
import { auditActionLabel, type AuditHistoryEntry } from "@/modules/audit";

const auditDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function AuditHistory({
  entries,
  title = "Audit history",
  action,
}: {
  entries: AuditHistoryEntry[];
  title?: string;
  action?: ReactNode;
}) {
  return (
    <ResearchSection id="audit-history" title={title} action={action}>
      {entries.length === 0 ? (
        <EmptyState
          title="No activity recorded yet"
          description="As you set up the workspace and save research or scope changes, you'll see the activity here."
        />
      ) : (
        <ol className="flex flex-col divide-y divide-border" aria-label="Recent audit events">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="grid min-w-0 gap-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{auditActionLabel(entry.action)}</p>
                <p className="mt-1 text-xs break-words text-text-secondary">
                  {entry.actorName ?? "Actor not recorded"}
                </p>
              </div>
              <time dateTime={entry.createdAt.toISOString()} className="record-metadata">
                {auditDateFormatter.format(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </ResearchSection>
  );
}

export function AuditHistorySkeleton() {
  return (
    <ResearchSection id="audit-history" title="Recent activity">
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading audit history…</span>
        <div className="flex flex-col gap-5" aria-hidden>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>
    </ResearchSection>
  );
}
