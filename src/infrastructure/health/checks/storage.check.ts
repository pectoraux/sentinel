import { getObjectStorage } from "@/infrastructure/storage";
import type { HealthCheck, HealthCheckResult } from "../health-check";

export class StorageHealthCheck implements HealthCheck {
  readonly name = "object-storage";
  readonly critical = true;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const healthy = await (await getObjectStorage()).isHealthy();
      return {
        name: this.name,
        status: healthy ? "healthy" : "unhealthy",
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        critical: this.critical,
        message: healthy ? undefined : "storage provider unreachable",
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
