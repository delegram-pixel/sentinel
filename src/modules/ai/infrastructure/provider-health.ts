import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AiProviderName } from "../domain/ai-config";
import type { AiError } from "../domain/ai-errors";
export async function recordProviderHealth(
  db: Prisma.TransactionClient,
  provider: AiProviderName,
  model: string,
  error?: AiError,
) {
  const where = { provider_model: { provider, model } };
  if (!error) {
    await db.aIProviderQuota.upsert({
      where,
      create: { provider, model },
      update: { failures: 0, cooldownUntil: null, lastFailureCode: null },
    });
    return;
  }
  const state = await db.aIProviderQuota.upsert({
    where,
    create: { provider, model, failures: 1 },
    update: { failures: { increment: 1 } },
  });
  await db.aIProviderQuota.update({
    where,
    data: {
      lastFailureCode: error.code,
      disabled: error.code === "AI_NOT_CONFIGURED" ? true : undefined,
      cooldownUntil:
        error.code === "AI_RATE_LIMITED"
          ? new Date(Date.now() + (error.retryAfterMs ?? 61000))
          : state.failures >= 3
            ? new Date(Date.now() + 60000)
            : undefined,
    },
  });
}
