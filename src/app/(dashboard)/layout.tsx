import { Suspense } from "react";

import { AccountMenu } from "@/components/auth/account-menu";
import { AppShell } from "@/components/layout/app-shell";
import { ClerkSetupNotice } from "@/components/auth/clerk-setup-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { isClerkConfigured } from "@/config/clerk";
import { getSessionContext } from "@/lib/session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) return <ClerkSetupNotice />;

  return (
    <AppShell
      workspaceName={
        <Suspense fallback={<Skeleton className="h-4 w-28" />}>
          <WorkspaceName />
        </Suspense>
      }
      accountMenu={<AccountMenu />}
    >
      {children}
    </AppShell>
  );
}

async function WorkspaceName() {
  const session = await getSessionContext();
  return <span>{session.workspace.name}</span>;
}
