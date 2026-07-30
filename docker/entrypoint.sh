#!/bin/sh
# =============================================================================
# Sentinel — Container entrypoint
# =============================================================================
# Runs once per container start, before the Next.js server.
#
# Sequence:
#   1. Wait for PostgreSQL to accept connections.
#   2. prisma db push — sync the PostgreSQL schema (schema.postgres.prisma).
#   3. Apply PostGIS SQL — geometry columns + spatial indexes + helper funcs.
#   4. Seed — permissions, roles, feature flags, bootstrap admin (idempotent).
#   5. exec CMD — hand off to `node server.js` (PID 1, signal-safe).
#
# `set -e` aborts on any failure so the container restarts (crash loop) rather
# than serving a half-initialized app.
# =============================================================================

set -e

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-sentinel}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sentinel}"
POSTGRES_DB="${POSTGRES_DB:-sentinel}"

# Ensure the runtime uses the PostgreSQL schema + connection.
export DATABASE_PROVIDER=postgresql
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# ---------------------------------------------------------------------------
# 1. Wait for PostgreSQL
# ---------------------------------------------------------------------------
echo "[entrypoint] Waiting for PostgreSQL at ${POSTGRES_HOST}..."
until pg_isready -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  echo "[entrypoint] PostgreSQL not ready, retrying in 2s..."
  sleep 2
done
echo "[entrypoint] PostgreSQL is ready."

# ---------------------------------------------------------------------------
# 2. Sync Prisma schema (PostgreSQL)
# ---------------------------------------------------------------------------
echo "[entrypoint] Running prisma db push (schema.postgres.prisma)..."
./node_modules/.bin/prisma db push \
  --schema=prisma/schema.postgres.prisma \
  --accept-data-loss

# ---------------------------------------------------------------------------
# 3. Apply PostGIS extension + spatial columns / indexes
# ---------------------------------------------------------------------------
echo "[entrypoint] Applying prisma/sql/postgis.sql..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -f /app/prisma/sql/postgis.sql

# ---------------------------------------------------------------------------
# 4. Seed — idempotent (permissions, roles, flags, bootstrap admin)
# ---------------------------------------------------------------------------
echo "[entrypoint] Running database seed..."
bun run prisma/seed.ts

# ---------------------------------------------------------------------------
# 5. Hand off to the main process (node server.js) as PID 1
# ---------------------------------------------------------------------------
echo "[entrypoint] Starting Sentinel web server..."
exec "$@"
