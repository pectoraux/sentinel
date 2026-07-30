# =============================================================================
# Sentinel — Production Dockerfile
# =============================================================================
# Multi-stage build for the Next.js 16 standalone output app.
#
# Stages:
#   1. deps    — install all dependencies (cached layer, oven/bun:1-alpine)
#   2. builder — prisma generate + next build → produces .next/standalone
#   3. runner  — minimal node:20-alpine runtime (non-root nextjs user)
#
# All stages use alpine (musl) so Prisma's native query-engine binaries
# generated in the builder are directly usable in the runner.
# =============================================================================

# ---------------------------------------------------------------------------
# 1. deps — install node_modules (respects bun.lock for reproducibility)
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy manifests first to maximize layer caching.
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install the full dependency tree (dev deps needed for the build step).
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2. builder — generate Prisma client + build the Next.js standalone bundle
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production
# Build-time env: NEXT_PUBLIC_* are inlined into the client bundle.
# Non-public values are read at runtime from the container env.
ENV NEXT_PUBLIC_APP_NAME=Sentinel
ENV NEXT_PUBLIC_APP_VERSION=0.1.0
ENV NEXT_PUBLIC_API_VERSION=v1
# Provide placeholder validated env so any config access during build succeeds.
# Real values are injected at runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DATABASE_PROVIDER=postgresql
ENV NEXTAUTH_SECRET="build-time-placeholder-secret-32chars-min"
ENV NEXTAUTH_URL="http://localhost:3000"

# Reuse installed node_modules from deps stage.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client for PostgreSQL (production target).
# The standalone trace bundles @prisma/client; the engines live in .prisma/client.
RUN bunx prisma generate --schema=prisma/schema.postgres.prisma

# Build Next.js (standalone output). Do NOT run `bun run build` here because that
# script also copies static assets — we do the copy explicitly below so the
# standalone dir is self-contained.
RUN bunx next build

# Replicate the project's build post-step: place static + public inside the
# standalone bundle so `node server.js` serves them correctly.
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public .next/standalone/

# ---------------------------------------------------------------------------
# 3. runner — minimal production image, non-root
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runtime system packages:
#   - postgresql-client → psql + pg_isready (entrypoint + health)
#   - wget               → container healthcheck probe
#   - bun                → entrypoint seed step (`bun run prisma/seed.ts`)
RUN apk add --no-cache postgresql-client wget && \
    npm install -g bun

# Non-root user (built into node:20-alpine base image).
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# --- Application bundle ----------------------------------------------------
# The standalone dir already contains: server.js, package.json, and a traced
# node_modules/. We overlay static + public (already copied inside standalone
# by the builder).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# --- Prisma client + engines + CLI -----------------------------------------
# The standalone trace may exclude Prisma's native engine binaries. We copy the
# full @prisma + .prisma trees so the runtime client can load the query engine.
# Placed in BOTH the root node_modules and the standalone node_modules to cover
# Node's resolution from either location.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
# Also ensure engines are resolvable from the standalone's traced @prisma/client.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./.next/standalone/node_modules/.prisma

# --- Prisma schema + SQL migrations + seed ---------------------------------
COPY --chown=nextjs:nodejs prisma ./prisma

# --- Entrypoint ------------------------------------------------------------
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

# Liveness probe: process is up and the HTTP server answers /api/v1/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --spider -q http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
