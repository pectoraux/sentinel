/**
 * Sentinel — Vitest global setup
 * =============================================================================
 * Runs in every worker BEFORE any test module is imported. Ensures the
 * Zod-validated config module can load (it reads process.env at first access)
 * without requiring a real database or a long NEXTAUTH_SECRET.
 *
 * Tests are pure / unit-level and MUST NOT touch a running database.
 * =============================================================================
 */

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "file:./db/test.db";
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || "sqlite";
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-secret-at-least-32-chars-long-value";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
