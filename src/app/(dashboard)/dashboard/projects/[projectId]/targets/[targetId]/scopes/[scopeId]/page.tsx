import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ScopeDetailSkeleton, ScopeDetailView } from "@/components/research/scope-detail";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { getTarget } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Scope version",
};

export const instant = false;

type ScopePageProps = {
  params: Promise<{ projectId: string; targetId: string; scopeId: string }>;
};

export default async function ScopePage({ params }: ScopePageProps) {
  const { projectId, targetId, scopeId } = await params;

  return (
    <Suspense fallback={<ScopeDetailSkeleton />}>
      <ScopeContent projectId={projectId} targetId={targetId} scopeId={scopeId} />
    </Suspense>
  );
}

async function ScopeContent({
  projectId,
  targetId,
  scopeId,
}: {
  projectId: string;
  targetId: string;
  scopeId: string;
}) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const [project, target] = await Promise.all([
    getProjectLookup(store, session.workspace.id, projectId),
    getTarget(store, session.workspace.id, targetId),
  ]);

  if (!project || !target || target.projectId !== project.id) {
    notFound();
  }

  const scope = target.scopes.find((entry) => entry.id === scopeId);

  if (!scope) {
    notFound();
  }

  return <ScopeDetailView target={target} scope={scope} canEdit={project.status !== "ARCHIVED"} />;
}
