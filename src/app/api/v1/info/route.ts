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
            // M2 — Identity & Trust
            { path: "/api/v1/identity-summary", method: "GET", auth: false, description: "Identity platform aggregate metrics" },
            { path: "/api/v1/organizations", method: "GET", auth: true, permission: "organizations:read", description: "List organizations" },
            { path: "/api/v1/organizations", method: "POST", auth: true, permission: "organizations:manage", description: "Create organization" },
            { path: "/api/v1/organizations/[id]", method: "GET", auth: false, description: "Organization detail + members" },
            { path: "/api/v1/organizations/[id]", method: "PATCH", auth: true, permission: "organizations:verify", description: "Verify organization" },
            { path: "/api/v1/devices", method: "GET", auth: true, permission: "devices:read", description: "List user devices" },
            { path: "/api/v1/devices", method: "POST", auth: true, permission: "devices:read", description: "Register device" },
            { path: "/api/v1/devices/[id]", method: "PATCH", auth: true, permission: "devices:manage", description: "Trust/revoke device" },
            { path: "/api/v1/verifications", method: "GET", auth: true, permission: "identity:review_verifications", description: "List verifications" },
            { path: "/api/v1/verifications", method: "POST", auth: true, permission: "identity:submit_verification", description: "Submit verification" },
            { path: "/api/v1/verifications/[id]", method: "PATCH", auth: true, permission: "identity:review_verifications", description: "Approve/reject verification" },
            { path: "/api/v1/trust", method: "GET", auth: true, permission: "identity:view_trust", description: "Trust leaderboard" },
            { path: "/api/v1/trust", method: "POST", auth: true, permission: "identity:manage_trust", description: "Recalculate trust" },
            { path: "/api/v1/sessions", method: "GET", auth: true, permission: "sessions:manage", description: "List sessions" },
            { path: "/api/v1/sessions", method: "DELETE", auth: true, permission: "sessions:manage", description: "Revoke all sessions" },
            { path: "/api/v1/role-switch", method: "GET", auth: true, permission: "identity:switch_role", description: "Active role + history" },
            { path: "/api/v1/role-switch", method: "POST", auth: true, permission: "identity:switch_role", description: "Switch active role" },
            // M3 — Geospatial
            { path: "/api/v1/geo/summary", method: "GET", auth: false, description: "GIS engine aggregate metrics" },
            { path: "/api/v1/geo/pois", method: "GET", auth: false, description: "List points of interest (bbox filter)" },
            { path: "/api/v1/geo/pois", method: "POST", auth: true, permission: "organizations:manage", description: "Create a POI" },
            { path: "/api/v1/geo/regions", method: "GET", auth: false, description: "List spatial regions (polygons)" },
            { path: "/api/v1/geo/nearest", method: "GET", auth: false, description: "Nearest N POIs (distance query)" },
            { path: "/api/v1/geo/within-radius", method: "GET", auth: false, description: "POIs within radius (meters)" },
            { path: "/api/v1/geo/within-polygon", method: "POST", auth: false, description: "POIs within polygon" },
            { path: "/api/v1/geo/layers", method: "GET", auth: false, description: "List map layers" },
            { path: "/api/v1/geo/tiles", method: "GET", auth: false, description: "Tile coordinate info" },
            { path: "/api/v1/geo/export", method: "GET", auth: false, description: "Export as GeoJSON" },
          ],
        },
      ],
    },
  };
});
