/**
 * Sentinel — Health Checks
 * =============================================================================
 * Aggregates liveness & readiness probes for the platform.
 *
 * - Liveness: is the process alive? (/api/v1/health → process uptime, always 200
 *   unless the process is shutting down).
 * - Readiness: are dependencies reachable? (/api/v1/readiness → db, storage,
 *   event bus, job queue). Returns 503 if any critical check is unhealthy.
 *
 * Each check is an isolated strategy with a timeout so a slow dependency cannot
 * stall the probe.
 * =============================================================================
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message?: string;
  checkedAt: string;
  critical: boolean;
}

export interface HealthCheck {
  readonly name: string;
  readonly critical: boolean;
  check(): Promise<HealthCheckResult>;
}

export interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  checks: HealthCheckResult[];
  timestamp: string;
}
