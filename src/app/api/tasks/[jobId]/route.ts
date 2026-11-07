import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PrismaJobStore } from "@/modules/tasks/infrastructure/prisma-job-store";
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSessionContext();
  const { jobId } = await params;
  if (!z.uuid().safeParse(jobId).success)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const job = await new PrismaJobStore(getDb()).find(session.workspace.id, jobId);
  if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(
    {
      id: job.id,
      kind: job.kind,
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
      failureCode: job.failureCode,
      result: job.result,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
