import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  InvestigationList,
  InvestigationListSkeleton,
} from "@/components/research/investigation-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listInvestigations } from "@/modules/research/application/investigation-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = { title: "Investigations" };

export default function InvestigationsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Investigations"
        description="The research trail: observations, hypotheses, and the context for your next session."
        actions={
          <Button asChild>
            <Link href="/dashboard/investigations/new">New investigation</Link>
          </Button>
        }
      />
      <Suspense fallback={<InvestigationListSkeleton />}>
        <InvestigationsContent />
      </Suspense>
    </div>
  );
}
async function InvestigationsContent() {
  const session = await getSessionContext();
  const investigations = await listInvestigations(
    new PrismaResearchStore(getDb()),
    session.workspace.id,
  );
  return <InvestigationList investigations={investigations} />;
}
