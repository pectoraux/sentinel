/**
 * GET /api/v1/readiness — Readiness probe.
 * Aggregates all health checks. Returns 503 if any CRITICAL check is unhealthy,
 * 200 with `degraded` status if only non-critical checks are failing.
 */

import { NextResponse } from "next/server";
import { getHealthService } from "@/infrastructure/health";
import { json } from "@/lib/api";
import { config } from "@/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthService().runAll();
  const criticalUnhealthy = health.checks.some(
    (c) => c.critical && c.status === "unhealthy",
  );
  const status = criticalUnhealthy ? 503 : 200;
  return NextResponse.json(
    {
      status: health.status,
      uptime: health.uptime,
      timestamp: health.timestamp,
      apiVersion: config.NEXT_PUBLIC_API_VERSION,
      checks: health.checks,
    },
    { status },
  );
}
