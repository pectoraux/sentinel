import { db } from "@/lib/db";
import type { HealthCheck, HealthCheckResult } from "../health-check";

export class DatabaseHealthCheck implements HealthCheck {
  readonly name = "database";
  readonly critical = true;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        name: this.name,
        status: "healthy",
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
