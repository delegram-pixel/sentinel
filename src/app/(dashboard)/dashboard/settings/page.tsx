import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsDetails, SettingsDetailsSkeleton } from "@/components/settings/settings-details";
import { AuditHistory, AuditHistorySkeleton } from "@/components/shared/audit-history";
import { PageHeader } from "@/components/shared/page-header";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaAuditHistoryStore } from "@/modules/audit";
import type { SessionContext } from "@/modules/auth/application/ports";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Settings"
        description="Your account, workspace membership, and recorded activity."
      />
      <Suspense
        fallback={
          <>
            <SettingsDetailsSkeleton />
            <AuditHistorySkeleton />
          </>
        }
      >
        <WorkspaceSettings />
      </Suspense>
    </div>
  );
}

async function WorkspaceSettings() {
  const session = await getSessionContext();

  return (
    <>
      <SettingsDetails session={session} />
      <Suspense fallback={<AuditHistorySkeleton />}>
        <WorkspaceAuditHistory session={session} />
      </Suspense>
    </>
  );
}

async function WorkspaceAuditHistory({ session }: { session: SessionContext }) {
  const store = new PrismaAuditHistoryStore(getDb());
  const entries = await store.listWorkspaceHistory({
    userId: session.user.id,
    workspaceId: session.workspace.id,
  });

  return <AuditHistory entries={entries} />;
}
