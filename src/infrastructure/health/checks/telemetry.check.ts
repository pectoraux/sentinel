import { getTelemetryState } from "@/infrastructure/observability";
import type { HealthCheck, HealthCheckResult } from "../health-check";

export class TelemetryHealthCheck implements HealthCheck {
  readonly name = "telemetry";
  readonly critical = false;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    const state = getTelemetryState();
    return {
      name: this.name,
      status: state.enabled ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
      critical: this.critical,
      message: state.enabled
        ? `traces=${state.tracesActive} metrics=${state.metricsActive}`
        : "otel disabled (set OTEL_TRACES_ENABLED=true)",
    };
  }
}
