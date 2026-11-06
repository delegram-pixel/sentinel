import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { TargetDetailSkeleton, TargetDetailView } from "@/components/research/target-detail";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getProjectLookup } from "@/modules/research/application/project-service";
import { getTarget } from "@/modules/research/application/target-service";
import { PrismaResearchStore } from "@/modules/research/infrastructure/prisma-research-store";

export const metadata: Metadata = {
  title: "Target",
};

export const instant = false;

type TargetPageProps = {
  params: Promise<{ projectId: string; targetId: string }>;
};

export default async function TargetPage({ params }: TargetPageProps) {
  const { projectId, targetId } = await params;

  return (
    <Suspense fallback={<TargetDetailSkeleton />}>
      <TargetContent projectId={projectId} targetId={targetId} />
    </Suspense>
  );
}

async function TargetContent({ projectId, targetId }: { projectId: string; targetId: string }) {
  const session = await getSessionContext();
  const store = new PrismaResearchStore(getDb());
  const [project, target] = await Promise.all([
    getProjectLookup(store, session.workspace.id, projectId),
    getTarget(store, session.workspace.id, targetId),
  ]);

  if (!project || !target || target.projectId !== project.id) {
    notFound();
  }

  return <TargetDetailView target={target} canEdit={project.status !== "ARCHIVED"} />;
}
