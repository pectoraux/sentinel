/**
 * GET /api/v1/health — Liveness probe.
 * Returns 200 as long as the process is up and able to respond.
 */

import { json, withHandler } from "@/lib/api";
import { getTelemetryState } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const telemetry = getTelemetryState();
  return {
    status: 200,
    body: {
      status: "alive",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: telemetry.serviceName,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    },
  };
});
