import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";

import { requireTestDatabaseUrl } from "./env";

export function createTestClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(requireTestDatabaseUrl()),
  });
}

class RollbackSignal extends Error {}

/**
 * Run a test body inside a transaction and always roll it back. This gives
 * each test a clean database without truncation or ordering dependencies.
 *
 * The returned value is whatever the body returns; database writes are still
 * discarded. Suites that must observe committed state (for example, a
 * cross-connection constraint race) should not use this helper.
 */
export async function withRollback<T>(
  client: PrismaClient,
  body: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let result: T | undefined;

  try {
    await client.$transaction(async (tx) => {
      result = await body(tx);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) {
      throw error;
    }
  }

  return result as T;
}
