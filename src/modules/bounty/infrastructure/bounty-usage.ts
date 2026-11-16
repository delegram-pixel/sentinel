import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Include recent actual usage and old requests with uncertain delivery. */
export async function bountyUsage(
  db: Prisma.TransactionClient,
  userId?: string,
  excludedJobId?: string,
) {
  const since = new Date(Date.now() - 86400000);
  const jobs = await db.backgroundJob.findMany({
    where: {
      kind: "BOUNTY_IMPORT",
      ...(userId ? { requestedBy: userId } : {}),
      ...(excludedJobId ? { id: { not: excludedJobId } } : {}),
      OR: [
        { updatedAt: { gte: since } },
        { status: { in: ["RUNNING", "QUEUED"] } },
        { result: { path: ["started"], equals: true } },
      ],
    },
    select: { result: true, updatedAt: true },
  });
  return jobs.reduce(
    (total, job) => {
      const state = job.result as {
        reservedTokens?: number;
        reservedCostUsd?: number;
        started?: boolean;
        draft?: unknown;
      } | null;
      if (job.updatedAt < since && (!state?.started || state.draft)) return total;
      return {
        tokens: total.tokens + (state?.reservedTokens ?? 0),
        costUsd: total.costUsd + (state?.reservedCostUsd ?? 0),
      };
    },
    { tokens: 0, costUsd: 0 },
  );
}
