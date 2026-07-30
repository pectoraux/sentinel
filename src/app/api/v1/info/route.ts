/**
 * GET /api/v1/info — API versioning directory.
 * Lists available API versions and their endpoints (contract discovery).
 */

import { json, withHandler } from "@/lib/api";
import { config } from "@/config";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  return {
    status: 200,
    body: {
      name: "Sentinel API",
      currentVersion: config.NEXT_PUBLIC_API_VERSION,
      versions: [
        {
          version: "v1",
          status: "current",
          deprecationDate: null,
          endpoints: [
            { path: "/api/v1/health", method: "GET", auth: false, description: "Liveness probe" },
            { path: "/api/v1/readiness", method: "GET", auth: false, description: "Readiness probe (all checks)" },
            { path: "/api/v1/system", method: "GET", auth: false, description: "Platform architecture overview" },
            { path: "/api/v1/info", method: "GET", auth: false, description: "API versioning directory" },
            { path: "/api/v1/feature-flags", method: "GET", auth: false, description: "List feature flags" },
            { path: "/api/v1/feature-flags", method: "PATCH", auth: true, permission: "feature_flags:toggle", description: "Toggle a feature flag" },
            { path: "/api/v1/audit-logs", method: "GET", auth: true, permission: "audit:read", description: "List audit log entries" },
            { path: "/api/v1/roles", method: "GET", auth: true, permission: "roles:read", description: "List RBAC roles" },
            { path: "/api/v1/metrics", method: "GET", auth: true, permission: "system:view_metrics", description: "Observability metrics" },
          ],
        },
      ],
    },
  };
});
