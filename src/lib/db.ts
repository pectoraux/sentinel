/**
 * Sentinel — database barrel
 * Re-exports the Prisma singleton + transaction helper.
 */
export { db, withTransaction } from "@/lib/prisma";
export type { PrismaClient } from "@/lib/prisma";
