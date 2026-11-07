import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaKnowledgeStore } from "@/modules/knowledge/infrastructure/prisma-knowledge-store";
export const metadata = { title: "Research knowledge" };
export default function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <div className="page-stack">
      <PageHeader
        title="Research knowledge"
        description="Curated references, lessons and source-backed research notes."
        actions={
          <Button asChild>
            <Link href="/dashboard/knowledge/new">Add knowledge</Link>
          </Button>
        }
      />
      <Suspense fallback={<p>Loading knowledge…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
async function Content({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  const q = typeof params.q === "string" ? params.q : "";
  const rows = await new PrismaKnowledgeStore(getDb()).list(session.workspace.id, q);
  return (
    <ResearchSection id="knowledge-records" title="Knowledge records">
      <form className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="knowledge-query">Search title or tag</Label>
          <Input id="knowledge-query" name="q" defaultValue={q} maxLength={200} />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li className="py-4" key={row.id}>
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={`/dashboard/knowledge/${row.id}`}
              >
                {row.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {row.source.origin} · {row.reviewStatus} · v{row.version} · {row.tags.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4">
          No knowledge records match. Add a research note or supplied reference.
        </p>
      )}
    </ResearchSection>
  );
}
