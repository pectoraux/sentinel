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
            // M4 — Digital Twin
            { path: "/api/v1/twin/summary", method: "GET", auth: false, description: "Twin aggregate metrics" },
            { path: "/api/v1/twin/entities", method: "GET", auth: false, description: "List twin entities" },
            { path: "/api/v1/twin/entities", method: "POST", auth: true, permission: "organizations:manage", description: "Create twin entity" },
            { path: "/api/v1/twin/entities/[id]", method: "GET", auth: false, description: "Entity detail + versions + events + relationships" },
            { path: "/api/v1/twin/entities/[id]", method: "PATCH", auth: true, permission: "organizations:manage", description: "Update entity (new version)" },
            { path: "/api/v1/twin/entities/[id]/versions", method: "GET", auth: false, description: "Entity version history" },
            { path: "/api/v1/twin/entities/[id]/versions", method: "POST", auth: true, permission: "organizations:manage", description: "Restore to version" },
            { path: "/api/v1/twin/entities/[id]/history", method: "GET", auth: false, description: "Entity event timeline" },
            { path: "/api/v1/twin/relationships", method: "GET", auth: false, description: "List relationships" },
            { path: "/api/v1/twin/relationships", method: "POST", auth: true, permission: "organizations:manage", description: "Create relationship" },
            { path: "/api/v1/twin/graph", method: "GET", auth: false, description: "Entity graph (nodes + edges)" },
            // M5 — Temporal Engine
            { path: "/api/v1/twin/temporal/summary", method: "GET", auth: false, description: "Temporal aggregate metrics" },
            { path: "/api/v1/twin/temporal/timeline", method: "GET", auth: false, description: "System-wide change timeline" },
            { path: "/api/v1/twin/temporal/replay", method: "GET", auth: false, description: "History replay (by day)" },
            { path: "/api/v1/twin/temporal/at-time", method: "GET", auth: false, description: "Point-in-time state query" },
            { path: "/api/v1/twin/entities/[id]/temporal", method: "GET", auth: false, description: "Entity state at time / timeline" },
            { path: "/api/v1/twin/entities/[id]/compare", method: "GET", auth: false, description: "Compare two versions" },
            // M6 — Knowledge Graph
            { path: "/api/v1/twin/kg/graph", method: "GET", auth: false, description: "Full graph (nodes + edges + stats)" },
            { path: "/api/v1/twin/kg/analytics", method: "GET", auth: false, description: "Graph analytics (components, centrality, matrix)" },
            { path: "/api/v1/twin/kg/neighbors", method: "GET", auth: false, description: "N-hop neighborhood" },
            { path: "/api/v1/twin/kg/path", method: "GET", auth: false, description: "Shortest path + all paths" },
            { path: "/api/v1/twin/kg/components", method: "GET", auth: false, description: "Connected components" },
            { path: "/api/v1/twin/kg/centrality", method: "GET", auth: false, description: "Degree centrality rankings" },
            { path: "/api/v1/twin/kg/templates", method: "GET", auth: false, description: "Relationship templates" },
            // M7 — Evidence Platform
            { path: "/api/v1/evidence/summary", method: "GET", auth: false, description: "Evidence aggregate metrics" },
            { path: "/api/v1/evidence", method: "GET", auth: false, description: "List evidence (filter by type)" },
            { path: "/api/v1/evidence", method: "POST", auth: true, permission: "identity:submit_verification", description: "Upload evidence" },
            { path: "/api/v1/evidence/[id]", method: "GET", auth: false, description: "Evidence detail + versions" },
            { path: "/api/v1/evidence/[id]/versions", method: "GET", auth: false, description: "Version history" },
            { path: "/api/v1/evidence/[id]/verify", method: "POST", auth: false, description: "Verify hash chain (tamper detection)" },
            // M9 — Corroboration Engine
            { path: "/api/v1/evidence/corroboration-summary", method: "GET", auth: false, description: "Corroboration aggregate metrics" },
            { path: "/api/v1/evidence/[id]/corroborate", method: "POST", auth: true, permission: "identity:submit_verification", description: "Support evidence" },
            { path: "/api/v1/evidence/[id]/corroborate", method: "DELETE", auth: true, permission: "identity:submit_verification", description: "Remove support" },
            { path: "/api/v1/evidence/[id]/dispute", method: "POST", auth: true, permission: "identity:submit_verification", description: "Dispute evidence" },
            { path: "/api/v1/evidence/[id]/dispute", method: "DELETE", auth: true, permission: "identity:submit_verification", description: "Remove dispute" },
            { path: "/api/v1/evidence/[id]/confidence", method: "GET", auth: false, description: "Corroboration details + weight" },
            { path: "/api/v1/evidence/duplicates", method: "GET", auth: false, description: "List duplicate groups" },
            { path: "/api/v1/evidence/duplicates", method: "POST", auth: true, permission: "organizations:manage", description: "Run duplicate detection" },
            // M8 — Community Intelligence
            { path: "/api/v1/intelligence/summary", method: "GET", auth: false, description: "Intelligence aggregate metrics" },
            { path: "/api/v1/intelligence/events", method: "GET", auth: false, description: "List intelligence events" },
            { path: "/api/v1/intelligence/events", method: "POST", auth: true, permission: "identity:submit_verification", description: "Create intelligence event" },
            { path: "/api/v1/intelligence/events/[id]", method: "GET", auth: false, description: "Event detail + comments + shares" },
            { path: "/api/v1/intelligence/events/[id]/comments", method: "GET", auth: false, description: "List comments" },
            { path: "/api/v1/intelligence/events/[id]/comments", method: "POST", auth: true, permission: "identity:submit_verification", description: "Add comment" },
            { path: "/api/v1/intelligence/events/[id]/subscribe", method: "POST", auth: true, permission: "identity:submit_verification", description: "Subscribe (watch/follow/mute)" },
            { path: "/api/v1/intelligence/events/[id]/share", method: "POST", auth: true, permission: "identity:submit_verification", description: "Share event" },
            { path: "/api/v1/intelligence/events/[id]/stream", method: "GET", auth: false, description: "Event stream (source of truth)" },
            { path: "/api/v1/intelligence/feed", method: "GET", auth: false, description: "Community feed" },
          ],
        },
      ],
    },
  };
});
