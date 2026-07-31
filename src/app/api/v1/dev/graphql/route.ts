/** GET /api/v1/dev/graphql — GraphQL schema (SDL) */
/** POST /api/v1/dev/graphql — GraphQL query endpoint */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

// GET returns the GraphQL schema (SDL)
export const GET = withHandler(async () => {
  return { status: 200, body: getDeveloperService().getGraphqlSchema() };
});

// POST handles GraphQL queries
export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { query?: string; variables?: Record<string, unknown> } | null;
  if (!body?.query) {
    return errorJson({ code: "invalid_request", message: "GraphQL query required", status: 400 });
  }

  // Simple GraphQL resolver — handles basic queries
  const query = body.query;
  const result: Record<string, unknown> = {};

  // Health query
  if (query.includes("health")) {
    result.health = { status: "alive", uptime: process.uptime(), checks: [] };
  }

  // System info
  if (query.includes("systemInfo")) {
    result.systemInfo = { version: "0.1.0", apiVersion: "v1", environment: "development" };
  }

  // Twin entities
  if (query.includes("twinEntities")) {
    const entities = await db.twinEntity.findMany({ take: 20, select: { id: true, key: true, name: true, type: true, lat: true, lng: true, status: true, createdAt: true } });
    result.twinEntities = { nodes: entities, totalCount: entities.length };
  }

  // Evidence
  if (query.includes("evidenceItems")) {
    const evidence = await db.evidence.findMany({ take: 20, select: { id: true, key: true, title: true, type: true, checksum: true, verified: true, lat: true, lng: true, createdAt: true } });
    result.evidenceItems = { nodes: evidence, totalCount: evidence.length };
  }

  // Intelligence events
  if (query.includes("intelligenceEvents")) {
    const events = await db.intelligenceEvent.findMany({ take: 20, select: { id: true, key: true, title: true, type: true, status: true, severity: true, lat: true, lng: true, createdAt: true } });
    result.intelligenceEvents = { nodes: events, totalCount: events.length };
  }

  // Hotspots
  if (query.includes("hotspots")) {
    const hotspots = await db.hotspotPrediction.findMany({ take: 20, select: { id: true, type: true, locationName: true, probability: true, riskLevel: true, expansionDirection: true, expansionRadiusKm: true } });
    result.hotspots = hotspots;
  }

  // Investigations
  if (query.includes("investigations")) {
    const investigations = await db.investigation.findMany({ take: 20, select: { id: true, key: true, title: true, type: true, status: true, priority: true, region: true, agencyName: true } });
    result.investigations = investigations;
  }

  // Cases
  if (query.includes("cases")) {
    const cases = await db.case.findMany({ take: 20, select: { id: true, caseNumber: true, title: true, type: true, status: true, priority: true, estimatedDamagesGHS: true } });
    result.cases = cases;
  }

  // Missions
  if (query.includes("missions")) {
    const missions = await db.mission.findMany({ take: 20, select: { id: true, key: true, title: true, type: true, status: true, priority: true, baseReward: true } });
    result.missions = missions;
  }

  // Reward pools
  if (query.includes("rewardPools")) {
    const pools = await db.rewardPool.findMany({ take: 20, select: { id: true, name: true, type: true, totalFunds: true, availableFunds: true, distributedFunds: true } });
    result.rewardPools = pools;
  }

  // Fraud alerts
  if (query.includes("fraudAlerts")) {
    const alerts = await db.fraudAlert.findMany({ take: 20, select: { id: true, key: true, type: true, severity: true, status: true, title: true, confidence: true, riskScore: true } });
    result.fraudAlerts = alerts;
  }

  // Analytics summary
  if (query.includes("analyticsSummary")) {
    const [totalKpis, totalGood, totalWarning, totalCritical] = await Promise.all([
      db.hotspotPrediction.count(),
      db.investigation.count(),
      db.case.count(),
      db.fraudAlert.count(),
    ]);
    result.analyticsSummary = {
      totalCategories: 6,
      totalKpis: 52,
      totalGood,
      totalWarning: totalWarning,
      totalCritical: totalCritical,
      healthScore: totalKpis > 0 ? Math.round((totalGood / totalKpis) * 100) : 0,
    };
  }

  return { status: 200, body: { data: result } };
});
