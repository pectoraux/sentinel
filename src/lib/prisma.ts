/**
 * Sentinel — Prisma Client singleton
 * =============================================================================
 * - Single instance per process (avoid connection exhaustion in dev hot reload).
 * - Exposes typed helpers commonly used across repositories.
 * - In production, connection pooling is configured via DATABASE_POOL_MAX.
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";
import { config } from "@/config";

const globalForPrisma = globalThis as unknown as {
  __sentinelPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  return new PrismaClient({
    log:
      config.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const db =
  globalForPrisma.__sentinelPrisma ??
  (globalForPrisma.__sentinelPrisma = createClient());

/**
 * Execute a callback within a transaction. Used by repositories to guarantee
 * atomic state changes + outbox writes (transactional outbox pattern).
 */
export async function withTransaction<T>(
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>,
): Promise<T> {
  return db.$transaction(fn);
}

export type { PrismaClient } from "@prisma/client";
