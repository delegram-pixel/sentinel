import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { PostgresSocket } from "./postgres-socket";

/**
 * Build a Prisma client for an explicit connection string.
 *
 * The application singleton below uses the pooled `DATABASE_URL`. Integration
 * tests call this directly with `TEST_DATABASE_URL` so they never share a
 * connection or a transaction scope with application code.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      connectionTimeoutMillis: 15_000,
      stream: () => new PostgresSocket(),
    }),
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  sentinelPrisma?: PrismaClient;
};

/**
 * Lazily create the application client. Lazy creation keeps `next build` from
 * requiring a live database merely because a route module was imported.
 * Check only the runtime connection string so unrelated AI settings cannot
 * prevent authenticated workspace reads.
 */
export function getDb(): PrismaClient {
  if (globalForPrisma.sentinelPrisma) {
    return globalForPrisma.sentinelPrisma;
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. See .env.example.");
  }

  const client = createPrismaClient(connectionString);
  globalForPrisma.sentinelPrisma = client;

  return client;
}
