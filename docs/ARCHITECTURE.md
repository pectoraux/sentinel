# Sentinel — Architecture

> AI-native Community Intelligence & Digital Twin platform for detecting illegal
> mining and environmental crimes across Africa.
>
> **Milestone 1 — Platform Foundation.** This document describes the production
> foundation: the domain kernel, the event-driven backbone, the bounded
> contexts shipped in M1, and the seams future milestones plug into.

---

## 1. Overview

Sentinel is a single deployable Next.js 16 application built on a
Domain-Driven Design (DDD) + Event-Driven Architecture (EDA) core. The
foundation milestone delivers everything needed before domain features land:

- A typed DDD kernel (Entity, AggregateRoot, ValueObject, DomainEvent, Result,
  Repository).
- A transactional outbox + event bus for reliable cross-context integration.
- Identity & Access Management (IAM) with RBAC, NextAuth v4 authentication.
- An audit log (append-only, tamper-evident).
- A feature-flag service with deterministic rollout strategies.
- Provider-agnostic ports for object storage, job queue, and event bus.
- Observability (OpenTelemetry traces/metrics, structured logging).
- Health checks (liveness vs readiness) + API versioning.
- A configuration system that validates all env at startup and redacts secrets.

### Milestone goals (M1)

| Goal | Status |
|------|--------|
| Domain kernel + Result/Repository primitives | ✅ |
| Event bus + transactional outbox | ✅ |
| IAM (User/Role/Permission) + RBAC resolver | ✅ |
| Audit log bounded context | ✅ |
| Feature flags (boolean/percentage/segment/environment) | ✅ |
| Object storage port (local + S3/MinIO) | ✅ |
| Background job queue (in-memory + BullMQ interface) | ✅ |
| Observability (OTel + structured logger + metrics) | ✅ |
| Health checks + API v1 | ✅ |
| Docker + CI/CD + tests + this document | ✅ |

### Upcoming milestones

| Milestone | Bounded contexts |
|-----------|------------------|
| M2 — Intelligence Engine | `intelligence` (satellite ingest, AI detectors, incidents) |
| M3 — Digital Twin | `digital-twin` (3D environmental simulation, NDVI rasters) |
| M4 — Community Reporting | `community` (citizen reports, verification workflow) |

---

## 2. Repository layout

```
src/
├── app/                      # Next.js App Router (UI + API routes)
│   ├── api/v1/               # Versioned REST API (health, readiness, roles,
│   │                         #   feature-flags, audit-logs, metrics, system, info)
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Platform Foundation Dashboard
├── core/                     # DDD kernel — no dependencies on anything else
│   └── shared/
│       ├── entity.ts         # identity-based equality
│       ├── aggregate-root.ts # consistency boundary + domain events
│       ├── value-object.ts   # structural equality, immutable
│       ├── unique-id.ts      # typed identity (branded UserId, RoleId, …)
│       ├── domain-event.ts   # immutable fact about a state change
│       ├── result.ts         # ok / err / unwrap / combine (no thrown control flow)
│       └── repository.ts     # persistence port interface
├── modules/                  # Bounded contexts (one folder each)
│   ├── iam/                  # Identity & Access Management
│   │   ├── domain/           #   entities (User, Role, Permission), events, repos
│   │   ├── application/      #   services (IAM service)
│   │   └── infrastructure/   #   RBAC resolver, Prisma repositories
│   ├── audit/                # Audit log context
│   └── feature-flags/        # Feature flag context
├── infrastructure/           # Technical concerns (ports + adapters)
│   ├── event-bus/            # InMemory + Redis/NATS interfaces
│   ├── storage/              # Local + S3 object storage
│   ├── jobs/                 # In-memory + BullMQ job queue + outbox relay
│   ├── observability/        # OTel, structured logger, metrics
│   └── health/               # Health checks + HealthService
├── auth/                     # NextAuth v4 options, session, RBAC context
├── config/                   # Zod-validated env config + secret redaction
├── lib/                      # Prisma client, API helpers, runtime, utils
├── components/               # UI (shadcn/ui primitives + sentinel panels)
├── hooks/                    # React hooks
└── middleware.ts             # API versioning + security headers + request id
```

The dependency rule: `core` ← `modules` ← `infrastructure` ← `app`. The domain
never imports infrastructure; infrastructure implements domain ports.

---

## 3. DDD building blocks

All primitives live in `src/core/shared/` and are re-exported from `@/core/shared`.

| Block | Purpose | Key contract |
|-------|---------|--------------|
| **UniqueId** | Typed identity; prevents mixing a `UserId` with a `RoleId` at compile time. | `equals`, `from`, `toString`, `toJSON`; auto-generates a UUID if none given. |
| **Entity** | Identity-based equality. Two entities are equal iff their ids match. | `equals(other?)` checks `constructor` match + id equality. |
| **AggregateRoot** | Consistency boundary. The only place invariants are enforced and domain events are produced. | `addDomainEvent`, `clearDomainEvents`, `markPersisted` (optimistic-concurrency version). |
| **ValueObject** | Immutable, structural equality. | `equals` compares `JSON.stringify(props)`; props are `Object.freeze`d. |
| **DomainEvent** | Immutable fact (past tense). | `eventId`, `eventType`, `aggregateType`, `aggregateId`, `payload`, `metadata`. |
| **Result<T,E>** | Railway-oriented success/error. No thrown control flow for expected business violations. | `ok`, `err`, `isOk`, `isErr`, `unwrap`, `combine`. |
| **Repository<T>** | Persistence port. Implementations live in infrastructure. | `findById`, `save`, `delete`. |

### Why Result instead of throwing?

Business rule violations (e.g. "account already suspended") are expected
outcomes, not exceptions. Throwing for them conflates control flow with error
handling and hides intent. `Result<T>` makes the success/failure contract
explicit at the type level and forces callers to handle both paths.

---

## 4. Event-Driven Architecture + Transactional Outbox

### The problem

When an aggregate changes state, other contexts (audit, notifications,
read-model projectors) and external systems need to react. Publishing events
directly to a bus risks inconsistency: if the DB commit succeeds but the bus
publish fails, the event is lost; if the bus publish succeeds but the DB
commit fails, phantom events fire. Two-phase commit (2PC) avoids this but is
unavailable across heterogeneous systems (PostgreSQL + Redis/NATS).

### The solution — Transactional Outbox

1. The aggregate method mutates state AND appends a `DomainEvent` to its
   in-memory event list.
2. The application service persists the aggregate AND writes the events to the
   `OutboxEvent` table **in the same DB transaction**.
3. A background job (the outbox relay) polls `OutboxEvent` rows with
   `status = pending` and publishes them to the event bus.
4. On successful publish, the row is marked `published`; on failure it is
   retried with backoff, eventually moving to `dead_letter`.

This gives **at-least-once delivery** without 2PC. Handlers must therefore be
**idempotent** (tolerate redelivery) — typically by checking an event-id
deduplication table or using upserts.

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                       Application Service                 │
                    │  1. load aggregate  2. invoke method (adds domain event) │
                    └───────────────┬──────────────────────────────┬───────────┘
                                    │ DB transaction (atomic)       │ clear events
                                    ▼                               ▼
                    ┌──────────────────────────┐   ┌───────────────────────────┐
                    │   Aggregate state table  │   │     OutboxEvent table     │
                    │   (e.g. User, Role)      │   │  status=pending, payload  │
                    └──────────────────────────┘   └─────────────┬─────────────┘
                                                                 │ poll (background job)
                                                                 ▼
                                                   ┌───────────────────────────┐
                                                   │   Outbox Relay (worker)   │
                                                   │  publish → Event Bus      │
                                                   │  mark published / retry   │
                                                   └─────────────┬─────────────┘
                                                                 │ at-least-once
                            ┌────────────────────┬───────────────┼───────────────┐
                            ▼                    ▼               ▼               ▼
                   ┌─────────────────┐ ┌──────────────────┐ ┌──────────┐ ┌──────────────┐
                   │ Audit handler   │ │ Read-model       │ │ Notify   │ │ External     │
                   │ (append log)    │ │ projector        │ │ handler  │ │ integration  │
                   └─────────────────┘ └──────────────────┘ └──────────┘ └──────────────┘
```

### Event bus port

```ts
interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): EventBusSubscription;
  subscribeAll(handler: EventHandler): EventBusSubscription;   // "*" wildcard
  isHealthy(): Promise<boolean>;
}
```

- **InMemoryEventBus** — dev/test, in-process pub/sub.
- **RedisEventBus** — production single-region (interface ready, BullMQ/MQ
  adapter to be wired when scaling out).
- **NATSEventBus** — production multi-region (interface ready).

### Outbox relay job

`src/infrastructure/jobs/handlers/outbox-relay.ts` is registered with the job
queue and started at boot. It batches pending rows, publishes them, and updates
their status. Future milestones add schedulers for domain-specific jobs
(satellite-tile ingest, detector runs, twin simulations) through the same
`JobQueue` port.

---

## 5. Bounded Contexts

### IAM (Identity & Access Management) — `src/modules/iam/`

- **User** aggregate — email, status lifecycle (`active | suspended | locked |
  pending`), failed-login lockout, domain events (`user.created`,
  `user.logged_in`, `user.suspended`, `user.role_assigned`).
- **Role** aggregate — groups permission keys; system roles are immutable
  (`isSystem`).
- **Permission** — `resource:action` convention; `Permission.keyFor(resource,
  action)` builds keys.
- **RbacResolver** — resolves a user's permission set (via roles), supports
  wildcards (`*`, `resource:*`), caches per-user with a 60s TTL.

### Audit — `src/modules/audit/`

- Append-only, tamper-evident log (`hash`/`prevHash` chaining).
- Subscribes to `*` on the event bus; every domain event becomes an audit row.
- `AuditService` writes entries with actor, action, resource, outcome, IP, and
  correlation `requestId`.

### Feature Flags — `src/modules/feature-flags/`

- Strategies: `boolean`, `percentage` (deterministic FNV-1a bucketing),
  `segment` (role/user/env rules), `environment`.
- In-memory cache (15s TTL); `invalidateAll()` on changes.
- `DEFAULT_FLAGS` seeds the foundation flag (`platform.foundation`) plus
  placeholders for M2 (`intelligence.engine`), M3 (`digital_twin.viewer`),
  and M4 (`community.reporting`).

### Upcoming contexts

| Context | Milestone | Notable events |
|---------|-----------|----------------|
| `intelligence` | M2 | `incident.detected`, `report.verified`, `satellite_tile.ingested` |
| `digital-twin` | M3 | `twin.simulated`, `layer.updated` |
| `community` | M4 | `report.submitted`, `report.verified`, `report.rejected` |

Each future context follows the same shape: `domain/` (entities + events +
repository interfaces), `application/` (services), `infrastructure/` (Prisma
repositories + adapters), and an `index.ts` barrel.

---

## 6. RBAC model

### Permission keys

`resource:action` (e.g. `cases:read`, `feature_flags:toggle`, `system:admin`).
The `PERMISSION_CATALOGUE` in `src/modules/iam/infrastructure/rbac.ts` is the
canonical list, seeded into the `Permission` table.

### Roles

`ROLE_CATALOGUE` seeds six system roles:

| Role | Permissions |
|------|-------------|
| `super_admin` | `*` (wildcard — unrestricted) |
| `admin` | users, roles, feature_flags, audit, system health/metrics |
| `analyst` | users:read, audit:read, system health |
| `field_agent` | users:read, system health |
| `citizen_reporter` | system health |
| `auditor` | audit:read/export, users/roles:read, system health/metrics |

### Wildcard resolution

`RbacResolver.can(userId, key)`:
1. If the user's permission set contains `*` → allow.
2. If it contains the exact `resource:action` → allow.
3. If it contains `resource:*` → allow.
4. Otherwise deny.

### System roles

Marked `isSystem = true`; their permission grants cannot be revoked through the
`Role` domain API (defence against accidental lockout).

---

## 7. Authentication architecture

**NextAuth.js v4** (`src/auth/`).

- **Session strategy**: JWT (stateless, horizontally scalable). The
  `AUTH_SESSION_STRATEGY` env can switch to `database` for revocable sessions.
- **Credentials provider** (email/password) is the M1 default. Passwords are
  hashed with bcrypt (lazy-loaded; 12 rounds).
- **OAuth readiness**: Google, GitHub, Azure AD providers are conditionally
  appended when their client IDs are present in config + `AUTH_PROVIDERS`.
  The `auth.oauth_providers` feature flag gates the UI surface.
- **JWT callback** injects `uid`, `roles`, and `permissions` into the token so
  the server can authorize without a DB hit on every request.
- **Session callback** surfaces those claims on `session.user`.

### Authorization flow

```
Request → middleware (request id, security headers, versioning)
       → API route handler
       → withAuth("cases:read") wrapper
       → requirePermission("cases:read")
            ├─ getSession() → JWT → userId
            └─ getRbac().can(userId, "cases:read") → allow | deny
```

---

## 8. Object Storage port

`src/infrastructure/storage/object-storage.ts` defines a provider-agnostic
interface for binary blobs (evidence media, satellite imagery, model
artifacts).

```ts
interface ObjectStorage {
  put(params: PutObjectParams): Promise<StoredObjectInfo>;
  get(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSec?: number): Promise<string>;
  delete(key: string): Promise<void>;
  stat(key: string): Promise<StoredObjectInfo | null>;
  isHealthy(): Promise<boolean>;
  readonly provider: string;
  readonly bucket: string;
}
```

- **LocalObjectStorage** — filesystem (dev).
- **S3ObjectStorage** — AWS S3 / MinIO / any S3-compatible store (prod).

Every upload records metadata (checksum, content-type, owner) in the
`StoredObject` table so the domain never depends on a specific provider. The
factory `getObjectStorage()` selects the implementation from
`STORAGE_PROVIDER` (`local | s3 | minio`).

---

## 9. Background Jobs

`src/infrastructure/jobs/job-queue.ts` defines the port:

```ts
interface JobQueue {
  register(name: string, handler: JobHandler): void;
  enqueue(job: JobPayload): Promise<string>;
  start(): Promise<void>;
  stop(): Promise<void>;
  depth(): number;
  isHealthy(): Promise<boolean>;
}
```

- **InMemoryJobQueue** — dev; runs jobs in-process.
- **BullMQ interface** — production target (Redis-backed, multi-worker,
  retries with backoff). The interface is ready; the BullMQ adapter ships when
  the first durable job lands (M2 ingest pipeline).

Jobs are **durable**: a `JobRecord` row is persisted before enqueue so the
system survives process restarts (the relay picks up `queued` jobs on boot).
Handlers are registered by name via a registry; `registerAllJobHandlers()`
wires the outbox relay + audit handler at boot.

---

## 10. Observability

### OpenTelemetry

`src/instrumentation.ts` is Next.js's instrumentation hook — runs once per
process before requests. `initTelemetry()` configures the OTel SDK from env
(`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_ENABLED`,
`OTEL_METRICS_ENABLED`). Spans cover the full request lifecycle and are
correlated with logs via `traceId`/`spanId`.

### Structured logging

`src/infrastructure/observability/logger.ts` — JSON lines in production, pretty
output in dev. Each record carries `ts`, `level`, `msg`, `service`, `env`,
optional `ctx`, and the active span context. `logger.child(ctx)` produces a
scoped logger. The logger is intentionally decoupled from the OTel SDK so it
works even when exporters are disabled.

### Metrics

`src/infrastructure/observability/metrics.ts` — Counter / Gauge / Histogram
primitives (`httpRequestsTotal`, etc.). Exposed at `/api/v1/metrics`.

---

## 11. Health checks

Two probes, two endpoints:

| Probe | Endpoint | Meaning | Status code |
|-------|----------|---------|-------------|
| **Liveness** | `/api/v1/health` | Is the process alive and the HTTP server answering? | 200 always (unless shutting down) |
| **Readiness** | `/api/v1/readiness` | Are dependencies (DB, storage, event bus, job queue) reachable? | 200 if all healthy, 503 if any critical check fails |

Each check is an isolated strategy with a timeout
(`HEALTH_CHECK_TIMEOUT_MS`) so a slow dependency cannot stall the probe.
`HealthService` aggregates results; recent snapshots are persisted to
`HealthCheckResult` for trend analysis.

The Docker `HEALTHCHECK` probes `/api/v1/health` (liveness) via `wget`.

---

## 12. API versioning strategy

- All API routes live under `/api/v{N}/` (current: `v1`).
- `NEXT_PUBLIC_API_VERSION` is the active version, inlined into the client
  bundle at build time.
- The middleware sends `X-API-Version` on every response and a `Deprecation` +
  `Sunset` + `Link: successor-version` header set for routes hitting a
  non-current version.
- Versioned route folders (`/api/v1/`, future `/api/v2/`) allow old and new
  contracts to coexist during migrations.

---

## 13. Configuration & secrets management

`src/config/index.ts` validates **all** environment variables through a Zod
schema at first access (lazy proxy). Invalid config fails fast — no silent
`undefined` in production.

- `.env` is for **local development only**.
- In production, secrets are injected at runtime from a secrets manager
  (HashiCorp Vault / AWS Secrets Manager / GCP Secret Manager) via the
  container environment. **No secret is ever baked into the image.**
- `isSecret(key)` flags sensitive keys; `redact(key, value)` masks them;
  `safeConfigSnapshot()` returns a log-safe copy with every secret replaced by
  `[REDACTED]`.
- `reloadConfig()` re-runs validation (used by tests).

See `.env.example` for the full variable catalogue.

---

## 14. Database strategy

Two structurally identical Prisma schemas target two engines:

| Environment | Schema file | Engine | PostGIS |
|-------------|-------------|--------|---------|
| Dev / sandbox | `prisma/schema.prisma` | SQLite | N/A |
| Production | `prisma/schema.postgres.prisma` | PostgreSQL 16 | ✅ via raw SQL |

### Why two schemas?

The sandbox has no database server (SQLite keeps the platform bootable with
zero infra). Production uses PostgreSQL 16 + PostGIS 3.4 for geospatial
queries (proximity, containment) required by the intelligence and digital-twin
contexts.

### PostGIS handling

Prisma has no native geometry type, so PostGIS columns + spatial indexes are
managed via raw SQL in `prisma/sql/postgis.sql` (idempotent). Repositories
access them through typed raw-query helpers. The relational models stay
portable across both databases.

### Production bootstrap (Docker entrypoint)

1. `postgres/init.sql` — `CREATE EXTENSION IF NOT EXISTS postgis` (runs once
   on first DB init).
2. `prisma db push --schema=prisma/schema.postgres.prisma` — syncs relational
   models.
3. `psql … -f prisma/sql/postgis.sql` — adds geometry columns + GIST indexes
   + helper functions.
4. `bun run prisma/seed.ts` — idempotent: permissions, roles, feature flags,
   bootstrap admin.

---

## 15. Running Sentinel

### Local development (SQLite, no Docker)

```bash
bun install
cp .env.example .env          # fill in NEXTAUTH_SECRET (openssl rand -base64 32)
bunx prisma generate
bunx prisma db push           # creates SQLite tables
bun run db:seed               # permissions, roles, flags, bootstrap admin
bun run dev                   # http://localhost:3000
```

### Production (Docker Compose)

```bash
cp .env.example .env          # set all secrets (NEXTAUTH_SECRET, POSTGRES_PASSWORD, …)
docker compose -f docker/docker-compose.yml up -d --build
# The app container's entrypoint runs prisma db push + postgis.sql + seed, then starts node server.js
# Health: curl http://localhost:3000/api/v1/health
# Readiness: curl http://localhost:3000/api/v1/readiness
```

Services brought up: `postgres` (PostGIS), `redis` (event bus + jobs),
`minio` (S3 storage), `app` (Sentinel web).

### Tests

```bash
bun run test                  # vitest run (pure/unit-level, no DB needed)
bun run test:watch            # vitest in watch mode
bunx vitest run --coverage    # with coverage report
```

All tests are pure / unit-level and run identically in local dev and CI. No
test requires a running database.

### Lint & type-check

```bash
bun run lint                  # eslint
bunx tsc --noEmit --pretty    # type-check
```

---

## 16. How future milestones plug in

### Adding a new bounded context (e.g. `intelligence`)

1. Create `src/modules/intelligence/` with `domain/` (entities extending
   `AggregateRoot`, events via `createDomainEvent`, repository interfaces
   extending `Repository<T>`), `application/` (services returning `Result<T>`),
   `infrastructure/` (Prisma repositories), and an `index.ts` barrel.
2. Add Prisma models to **both** `schema.prisma` and `schema.postgres.prisma`.
   Add PostGIS columns to `prisma/sql/postgis.sql` if geospatial.
3. Seed catalogue entries (permissions, roles, flags) in the relevant
   catalogues + `prisma/seed.ts`.
4. Add API routes under `src/app/api/v1/intelligence/` using `withAuth(...)`
   for permission gating.
5. Add a feature flag to `DEFAULT_FLAGS` to gate rollout.

### Registering a new job handler

```ts
import { getJobQueue } from "@/infrastructure/jobs";

getJobQueue().register("ingest.satellite-tile", async (payload, ctx) => {
  // … idempotent work …
});
```

Register it in `src/infrastructure/jobs/handlers/index.ts` so it's wired at
boot. Enqueue with `getJobQueue().enqueue({ name, payload, queue: "ingest" })`.

### Subscribing to domain events

```ts
import { getEventBus } from "@/infrastructure/event-bus";

getEventBus().subscribe("incident.detected", async (event) => {
  // idempotent handler — tolerate redelivery
});
```

Or `subscribeAll(handler)` for a global projector (the audit context does
this). Handlers run after the outbox relay publishes the event — guaranteed
at-least-once.

---

## 17. Cross-cutting conventions

- **No thrown control flow for expected business outcomes** — use `Result<T>`.
- **Aggregates are the only mutation entry point** — invariants enforced in
  their methods.
- **Events are past-tense and immutable** — `UserCreated`, not `CreateUser`.
- **Handlers are idempotent** — outbox delivers at-least-once.
- **Ports in the domain, adapters in infrastructure** — never leak Prisma/SQL
  types into `domain/`.
- **Secrets never logged** — `safeConfigSnapshot()` + `redact()` enforce this.
- **Fail fast on bad config** — Zod validation at startup.
