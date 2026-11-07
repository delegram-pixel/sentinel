import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaEngagementStore } from "@/modules/engagements/infrastructure/prisma-engagement-store";
export const metadata = { title: "Engagements" };
export default function EngagementsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Engagements"
        description="Research objectives, associated assets and scope history."
        actions={
          <Button asChild>
            <Link href="/dashboard/engagements/new">New engagement</Link>
          </Button>
        }
      />
      <Suspense fallback={<p>Loading engagements…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  const session = await getSessionContext();
  const rows = await new PrismaEngagementStore(getDb()).list(session.workspace.id);
  return (
    <ResearchSection id="engagements" title="Engagement records">
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li className="py-4" key={row.id}>
              <Link
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={`/dashboard/engagements/${row.id}`}
              >
                {row.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {row.project.name} · {row.status} · {row._count.assets} assets ·{" "}
                {row._count.investigations} investigations
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No engagements yet. Create one for an existing project and associate its targets.</p>
      )}
    </ResearchSection>
  );
}
