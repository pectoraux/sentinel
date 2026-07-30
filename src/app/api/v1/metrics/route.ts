/**
 * GET /api/v1/metrics — observability metrics snapshot (requires system:view_metrics).
 * Exposes in-process counters/gauges/histograms. In production, OTLP exporter
 * also pushes these to the observability stack.
 */

import { json, withAuth } from "@/lib/api";
import { metrics } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

export const GET = withAuth("system:view_metrics")(async () => {
  return {
    status: 200,
    body: {
      timestamp: new Date().toISOString(),
      metrics: metrics.snapshot(),
    },
  };
});
