import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { getServerEnv } from "@/config/env.server";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Build a Prisma client for an explicit connection string.
 *
 * The application singleton below uses the pooled `DATABASE_URL`. Integration
 * tests call this directly with `TEST_DATABASE_URL` so they never share a
 * connection or a transaction scope with application code.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(connectionString) });
}

const globalForPrisma = globalThis as typeof globalThis & {
  sentinelPrisma?: PrismaClient;
};

/**
 * Lazily create the application client. Lazy creation keeps `next build` from
 * requiring a live database merely because a route module was imported.
 */
export function getDb(): PrismaClient {
  if (globalForPrisma.sentinelPrisma) {
    return globalForPrisma.sentinelPrisma;
  }

  const { DATABASE_URL } = getServerEnv();

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. See .env.example.");
  }

  const client = createPrismaClient(DATABASE_URL);
  globalForPrisma.sentinelPrisma = client;

  return client;
}
