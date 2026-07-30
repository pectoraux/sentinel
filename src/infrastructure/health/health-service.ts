import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import type {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  SystemHealth,
} from "./health-check";

/**
 * HealthService — aggregates all registered checks into a system health view.
 * Used by /api/v1/health and /api/v1/readiness.
 */
export class HealthService {
  private checks: HealthCheck[] = [];

  register(check: HealthCheck): void {
    this.checks.push(check);
  }

  registerAll(checks: HealthCheck[]): void {
    for (const c of checks) this.register(c);
  }

  async runAll(): Promise<SystemHealth> {
    const timeoutMs = config.HEALTH_CHECK_TIMEOUT_MS;
    const results = await Promise.all(
      this.checks.map(async (c): Promise<HealthCheckResult> => {
        try {
          return await Promise.race([
            c.check(),
            timeout(timeoutMs).then(() => ({
              name: c.name,
              status: "unhealthy" as HealthStatus,
              latencyMs: timeoutMs,
              message: `timed out after ${timeoutMs}ms`,
              checkedAt: new Date().toISOString(),
              critical: c.critical,
            })),
          ]);
        } catch (error) {
          return {
            name: c.name,
            status: "unhealthy",
            latencyMs: timeoutMs,
            message: error instanceof Error ? error.message : String(error),
            checkedAt: new Date().toISOString(),
            critical: c.critical,
          };
        }
      }),
    );
    const status = aggregate(results);
    logger.debug("health.run", { status, checks: results.length });
    return {
      status,
      uptime: process.uptime(),
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
}

function timeout(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function aggregate(results: HealthCheckResult[]): HealthStatus {
  const hasUnhealthyCritical = results.some(
    (r) => r.critical && r.status === "unhealthy",
  );
  if (hasUnhealthyCritical) return "unhealthy";
  const hasUnhealthy = results.some((r) => r.status === "unhealthy");
  const hasDegraded = results.some((r) => r.status === "degraded");
  if (hasUnhealthy) return "unhealthy";
  if (hasDegraded) return "degraded";
  return "healthy";
}

// ---------------------------------------------------------------------------
// Singleton wired with default checks
// ---------------------------------------------------------------------------

import { DatabaseHealthCheck } from "./checks/database.check";
import { StorageHealthCheck } from "./checks/storage.check";
import { EventBusHealthCheck } from "./checks/event-bus.check";
import { JobQueueHealthCheck } from "./checks/job-queue.check";
import { TelemetryHealthCheck } from "./checks/telemetry.check";

let instance: HealthService | null = null;

export function getHealthService(): HealthService {
  if (!instance) {
    instance = new HealthService();
    instance.registerAll([
      new DatabaseHealthCheck(),
      new StorageHealthCheck(),
      new EventBusHealthCheck(),
      new JobQueueHealthCheck(),
      new TelemetryHealthCheck(),
    ]);
  }
  return instance;
}
