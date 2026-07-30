import { getJobQueue } from "@/infrastructure/jobs";
import type { HealthCheck, HealthCheckResult } from "../health-check";

export class JobQueueHealthCheck implements HealthCheck {
  readonly name = "job-queue";
  readonly critical = false;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const healthy = await getJobQueue().isHealthy();
      return {
        name: this.name,
        status: healthy ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        critical: this.critical,
        message: healthy ? undefined : "job queue not running",
      };
    } catch (error) {
      return {
        name: this.name,
        status: "unhealthy",
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
        critical: this.critical,
      };
    }
  }
}
