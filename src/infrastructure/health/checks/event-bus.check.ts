import { getEventBus } from "@/infrastructure/event-bus";
import type { HealthCheck, HealthCheckResult } from "../health-check";

export class EventBusHealthCheck implements HealthCheck {
  readonly name = "event-bus";
  readonly critical = false;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const healthy = await getEventBus().isHealthy();
      return {
        name: this.name,
        status: healthy ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        critical: this.critical,
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
