import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AiProviderName } from "../domain/ai-config";
import { AiError } from "../domain/ai-errors";

const DAY_MS = 24 * 60 * 60 * 1000;
export type GroqLimits = { tokensPerMinute: number; tokensPerDay: number; requestsPerDay: number };
export const DEFAULT_GROQ_LIMITS: GroqLimits = {
  tokensPerMinute: 8000,
  tokensPerDay: 200000,
  requestsPerDay: 1000,
};

/** One platform key: these reservations deliberately span all workspaces. */
export class ProviderQuotaStore {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly limits: GroqLimits & { requestsPerMinute?: number } = DEFAULT_GROQ_LIMITS,
    private readonly now: () => Date = () => new Date(),
    private readonly provider: AiProviderName = "GROQ",
  ) {}

  async reserve(
    model: string,
    tokens: number,
  ): Promise<{ ready: false; availableAt: Date } | { ready: true; windowStartedAt: Date }> {
    if (tokens > this.limits.tokensPerMinute || tokens > this.limits.tokensPerDay)
      throw new AiError(
        "AI_CONTEXT_TOO_LARGE",
        "This request exceeds the configured provider allowance.",
      );
    return this.db.$transaction(async (tx) => {
      const now = this.now();
      await tx.aIProviderQuota.upsert({
        where: { provider_model: { provider: this.provider, model } },
        create: { provider: this.provider, model, nextRequestAt: now, windowStartedAt: now },
        update: {},
      });
      await tx.$queryRaw(
        Prisma.sql`SELECT model FROM "AIProviderQuota" WHERE provider::text = ${this.provider} AND model = ${model} FOR UPDATE`,
      );
      let quota = await tx.aIProviderQuota.findUniqueOrThrow({
        where: { provider_model: { provider: this.provider, model } },
      });
      if (now.getTime() - quota.windowStartedAt.getTime() >= DAY_MS)
        quota = await tx.aIProviderQuota.update({
          where: { provider_model: { provider: this.provider, model } },
          data: { windowStartedAt: now, tokens: 0, requests: 0 },
        });
      if (
        quota.tokens + tokens > this.limits.tokensPerDay ||
        quota.requests >= this.limits.requestsPerDay
      )
        return {
          ready: false as const,
          availableAt: new Date(quota.windowStartedAt.getTime() + DAY_MS),
        };
      if (quota.nextRequestAt > now)
        return { ready: false as const, availableAt: quota.nextRequestAt };
      await tx.aIProviderQuota.update({
        where: { provider_model: { provider: this.provider, model } },
        data: {
          tokens: { increment: tokens },
          requests: { increment: 1 },
          nextRequestAt: new Date(
            now.getTime() +
              (this.provider === "GROQ"
                ? 61000
                : Math.max(
                    1000,
                    Math.ceil(60000 / (this.limits.requestsPerMinute ?? 10)),
                    Math.ceil((60000 * tokens) / this.limits.tokensPerMinute),
                  )),
          ),
        },
      });
      return { ready: true as const, windowStartedAt: quota.windowStartedAt };
    });
  }

  async settle(
    workspaceId: string,
    attemptId: string,
    model: string,
    reserved: number,
    actual: number,
    windowStartedAt: Date,
  ) {
    // Old responses cannot refund a newer day's reservations.
    await this.db.$transaction(async (tx) => {
      const changed = await tx.aIExecutionAttempt.updateMany({
        where: {
          id: attemptId,
          workspaceId,
          quotaSettled: false,
          status: { in: ["RECEIVED", "FAILED"] },
        },
        data: { quotaSettled: true },
      });
      if (changed.count)
        await tx.aIProviderQuota.updateMany({
          where: { provider: this.provider, model, windowStartedAt },
          data: { tokens: { increment: actual - reserved } },
        });
    });
  }
}

/** Backward-compatible Groq entrypoint; quota policy now also supports other providers. */
export class GroqQuotaStore extends ProviderQuotaStore {}
