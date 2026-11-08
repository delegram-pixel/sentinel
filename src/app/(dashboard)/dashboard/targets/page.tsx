import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TargetList, TargetListSkeleton } from "@/components/research/target-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { listTargets } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = { title: "Targets" };

export default function TargetsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Targets"
        description="See which assets belong to your research and what you're allowed to test. Open a target to check its permission and scope, or browse projects to register a new one."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/projects">Browse projects</Link>
          </Button>
        }
      />
      <Suspense fallback={<TargetListSkeleton />}>
        <TargetsContent />
      </Suspense>
    </div>
  );
}
async function TargetsContent() {
  const session = await getSessionContext();
  const targets = await listTargets(new PrismaResearchStore(getDb()), session.workspace.id);
  return <TargetList targets={targets} />;
}
