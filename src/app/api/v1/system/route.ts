/**
 * GET /api/v1/system — system architecture & capability overview.
 * Public endpoint describing the platform foundation: installed subsystems,
 * providers, versions, and architecture metadata. Used by the foundation
 * dashboard and by ops tooling.
 */

import { json, withHandler } from "@/lib/api";
import { config } from "@/config";
import { getTelemetryState } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const telemetry = getTelemetryState();
  return {
    status: 200,
    body: {
      platform: "Sentinel",
      milestone: "M1 — Platform Foundation",
      version: config.NEXT_PUBLIC_APP_VERSION,
      apiVersion: config.NEXT_PUBLIC_API_VERSION,
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      subsystems: {
        database: {
          provider: config.DATABASE_PROVIDER,
          productionTarget: "PostgreSQL + PostGIS",
        },
        auth: {
          providers: config.AUTH_PROVIDERS,
          sessionStrategy: config.AUTH_SESSION_STRATEGY,
        },
        storage: {
          provider: config.STORAGE_PROVIDER,
          productionTargets: ["AWS S3", "MinIO", "Cloudflare R2"],
        },
        eventBus: {
          provider: config.EVENT_BUS_PROVIDER,
          productionTargets: ["Redis Pub/Sub", "NATS"],
        },
        jobs: {
          provider: config.JOB_QUEUE_PROVIDER,
          productionTargets: ["BullMQ (Redis)"],
        },
        featureFlags: {
          provider: config.FEATURE_FLAG_PROVIDER,
        },
        observability: {
          serviceName: telemetry.serviceName,
          tracesActive: telemetry.tracesActive,
          metricsActive: telemetry.metricsActive,
          exporter: config.OTEL_EXPORTER_OTLP_ENDPOINT ?? "disabled",
        },
      },
      architecture: {
        pattern: "Domain Driven Design + Event Driven Architecture",
        boundedContexts: ["iam", "audit", "feature-flags"],
        upcomingContexts: [
          "intelligence (M2)",
          "cases (M2)",
          "digital-twin (M3)",
          "community (M2)",
        ],
        patterns: [
          "Transactional Outbox",
          "CQRS (read models via service layer)",
          "Aggregate Roots with domain events",
          "Ports & Adapters (Hexagonal)",
          "RBAC with wildcard permissions",
        ],
      },
    },
  };
});
