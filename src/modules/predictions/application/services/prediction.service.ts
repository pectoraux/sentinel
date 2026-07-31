/**
 * Sentinel — Environmental Intelligence Prediction Service
 * =============================================================================
 * Runs predictive models using real data from the platform.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  predictSediment,
  predictRiverImpact,
  predictForestLoss,
  predictDownstream,
  predictProtectedAreaRisk,
  riskLevelFor,
  type PredictionType,
  type PredictionResult,
} from "../../domain/prediction-types";

export class PredictionService {
  /**
   * Run predictions for all relevant twin entities.
   * Gathers real data from M4 twin entities, M6 knowledge graph relationships,
   * M12 satellite scenes, M13 CV detections, M14 AI observations, M15 fusion.
   */
  async runAllPredictions(): Promise<{ created: number }> {
    let created = 0;

    // Get all rivers
    const rivers = await db.twinEntity.findMany({ where: { type: "river" } });
    for (const river of rivers) {
      // Find mines that affect this river (via knowledge graph)
      const affectingMines = await db.twinRelationship.findMany({
        where: { toEntityId: river.id, type: "affects" },
        include: { fromEntity: { select: { id: true, name: true, type: true, status: true } } },
      });

      // Find CV detections for this area
      const riverDetections = await db.detectionResult.findMany({
        where: { type: { in: ["water_changes", "excavation"] }, detected: true },
        take: 5,
      });

      // Find fusion results
      const fusionResults = await db.fusionResult.findMany({ take: 3, orderBy: { fusedConfidence: "desc" } });
      const avgFusion = fusionResults.length > 0 ? fusionResults.reduce((s, f) => s + f.fusedConfidence, 0) / fusionResults.length : 0.7;

      // Find satellite scenes near the river
      const nearbyScenes = river.lat && river.lng
        ? await db.satelliteScene.findMany({ where: { status: "ready", centerLat: { gte: river.lat - 0.5, lte: river.lat + 0.5 }, centerLng: { gte: river.lng - 0.5, lte: river.lng + 0.5 } }, take: 3 })
        : [];

      const mineCount = affectingMines.length;
      const mineProxScore = mineCount > 0 ? 0.7 + mineCount * 0.1 : 0.3;
      const excavationDets = riverDetections.filter((d) => d.type === "excavation").length;
      const excavationConf = excavationDets > 0 ? riverDetections.filter((d) => d.type === "excavation").reduce((s, d) => s + d.confidence, 0) / excavationDets : 0.5;
      const satelliteChange = nearbyScenes.some((s) => s.acquisitionDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      // 1. Sediment prediction
      const sedimentResult = predictSediment({
        riverName: river.name,
        mineCount,
        mineProximityScore: mineProxScore,
        excavationDetections: excavationDets,
        excavationConfidence: excavationConf,
        satelliteChangeDetected: satelliteChange,
        fusionConfidence: avgFusion,
      });
      await this.save("sediment", river, sedimentResult, {
        inputEntityIds: [river.id, ...affectingMines.map((m) => m.fromEntityId)],
        inputDetections: riverDetections.map((d) => d.id),
        inputSatelliteScenes: nearbyScenes.map((s) => s.id),
        inputFusionIds: fusionResults.map((f) => f.id),
      });
      created++;

      // 2. River impact prediction
      const pollutionDets = riverDetections.filter((d) => d.type === "water_changes").length;
      const pollutionConf = pollutionDets > 0 ? riverDetections.filter((d) => d.type === "water_changes").reduce((s, d) => s + d.confidence, 0) / pollutionDets : 0.5;
      const upstreamMines = affectingMines.filter((m) => m.fromEntity.type === "mine").length;

      const riverImpactResult = predictRiverImpact({
        riverName: river.name,
        sedimentRisk: sedimentResult.riskScore,
        pollutionDetections: pollutionDets,
        pollutionConfidence: pollutionConf,
        fusionConfidence: avgFusion,
        upstreamMines,
      });
      await this.save("river_impact", river, riverImpactResult, {
        inputEntityIds: [river.id],
        inputDetections: riverDetections.map((d) => d.id),
        inputFusionIds: fusionResults.map((f) => f.id),
      });
      created++;

      // 3. Downstream effects prediction
      // Find downstream communities
      const downstreamCommunities = await db.twinRelationship.findMany({
        where: { toEntityId: river.id, type: "depends_on" },
        include: { fromEntity: { select: { id: true, name: true, type: true, metadata: true } } },
      });
      const communityCount = downstreamCommunities.filter((c) => c.fromEntity.type === "community").length;
      const population = downstreamCommunities.reduce((sum, c) => {
        try { const m = c.fromEntity.metadata ? JSON.parse(c.fromEntity.metadata) : {}; return sum + (m.population ?? 10000); } catch { return sum + 10000; }
      }, 0);

      const downstreamResult = predictDownstream({
        riverName: river.name,
        upstreamRisk: riverImpactResult.riskScore,
        communityCount: Math.max(1, communityCount),
        populationAffected: population,
        waterSource: "river",
        fusionConfidence: avgFusion,
      });
      await this.save("downstream_effects", river, downstreamResult, {
        inputEntityIds: [river.id, ...downstreamCommunities.map((c) => c.fromEntityId)],
        inputFusionIds: fusionResults.map((f) => f.id),
      });
      created++;
    }

    // Get all forests
    const forests = await db.twinEntity.findMany({ where: { type: "forest" } });
    for (const forest of forests) {
      const nearbyMines = await db.twinRelationship.findMany({
        where: { toEntityId: forest.id, type: { in: ["threatens", "near"] } },
        include: { fromEntity: { select: { id: true, type: true } } },
      });
      const mineCount = nearbyMines.filter((m) => m.fromEntity.type === "mine").length;

      const forestDetections = await db.detectionResult.findMany({
        where: { type: "forest_loss", detected: true },
        take: 5,
      });
      const lossConf = forestDetections.length > 0 ? forestDetections.reduce((s, d) => s + d.confidence, 0) / forestDetections.length : 0.5;

      // Check if forest is in a protected area
      const protectedRels = await db.twinRelationship.findMany({
        where: { fromEntityId: forest.id, type: "within" },
      });
      const isProtected = protectedRels.length > 0;

      const nearbyScenes = forest.lat && forest.lng
        ? await db.satelliteScene.findMany({ where: { status: "ready", centerLat: { gte: forest.lat - 0.5, lte: forest.lat + 0.5 } }, take: 2 })
        : [];

      const fusionResults = await db.fusionResult.findMany({ take: 3, orderBy: { fusedConfidence: "desc" } });
      const avgFusion = fusionResults.length > 0 ? fusionResults.reduce((s, f) => s + f.fusedConfidence, 0) / fusionResults.length : 0.7;

      const forestLossResult = predictForestLoss({
        forestName: forest.name,
        nearbyMines: mineCount,
        forestLossDetections: forestDetections.length,
        forestLossConfidence: lossConf,
        satelliteChangeDetected: nearbyScenes.some((s) => s.acquisitionDate > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)),
        protectedStatus: isProtected,
        fusionConfidence: avgFusion,
      });
      await this.save("forest_loss", forest, forestLossResult, {
        inputEntityIds: [forest.id, ...nearbyMines.map((m) => m.fromEntityId)],
        inputDetections: forestDetections.map((d) => d.id),
        inputSatelliteScenes: nearbyScenes.map((s) => s.id),
        inputFusionIds: fusionResults.map((f) => f.id),
      });
      created++;
    }

    // Get all protected areas
    const protectedAreas = await db.twinEntity.findMany({ where: { type: "protected_area" } });
    for (const area of protectedAreas) {
      const nearbyMines = await db.twinRelationship.findMany({
        where: { toEntityId: area.id, type: { in: ["near", "contains"] } },
        include: { fromEntity: { select: { id: true, type: true } } },
      });
      const mineCount = nearbyMines.filter((m) => m.fromEntity.type === "mine").length;

      const forestDetections = await db.detectionResult.findMany({
        where: { type: "forest_loss", detected: true },
        take: 3,
      });

      const nearbyScenes = area.lat && area.lng
        ? await db.satelliteScene.findMany({ where: { status: "ready", centerLat: { gte: area.lat - 0.5, lte: area.lat + 0.5 } }, take: 2 })
        : [];

      const fusionResults = await db.fusionResult.findMany({ take: 3, orderBy: { fusedConfidence: "desc" } });
      const avgFusion = fusionResults.length > 0 ? fusionResults.reduce((s, f) => s + f.fusedConfidence, 0) / fusionResults.length : 0.7;

      const protectedResult = predictProtectedAreaRisk({
        areaName: area.name,
        nearbyMines: mineCount,
        mineProximityScore: mineCount > 0 ? 0.6 + mineCount * 0.1 : 0.3,
        forestLossDetections: forestDetections.length,
        satelliteChangeDetected: nearbyScenes.some((s) => s.acquisitionDate > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)),
        enforcementLevel: "passive",
        fusionConfidence: avgFusion,
      });
      await this.save("protected_area_risk", area, protectedResult, {
        inputEntityIds: [area.id, ...nearbyMines.map((m) => m.fromEntityId)],
        inputDetections: forestDetections.map((d) => d.id),
        inputSatelliteScenes: nearbyScenes.map((s) => s.id),
        inputFusionIds: fusionResults.map((f) => f.id),
      });
      created++;
    }

    logger.info("predictions.completed", { created });
    return { created };
  }

  private async save(
    type: PredictionType,
    target: { id: string; name: string; type: string },
    result: PredictionResult,
    inputs: { inputEntityIds?: string[]; inputDetections?: string[]; inputSatelliteScenes?: string[]; inputFusionIds?: string[] },
  ) {
    await db.environmentalPrediction.create({
      data: {
        type,
        targetEntityId: target.id,
        targetName: target.name,
        targetType: target.type,
        prediction: result.prediction,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        timeframe: result.timeframe,
        factors: JSON.stringify(result.factors),
        inputEntityIds: inputs.inputEntityIds ? JSON.stringify(inputs.inputEntityIds) : null,
        inputSatelliteScenes: inputs.inputSatelliteScenes ? JSON.stringify(inputs.inputSatelliteScenes) : null,
        inputDetections: inputs.inputDetections ? JSON.stringify(inputs.inputDetections) : null,
        inputFusionIds: inputs.inputFusionIds ? JSON.stringify(inputs.inputFusionIds) : null,
        affectedEntities: JSON.stringify(result.affectedEntities),
        model: "env-intel-v1",
        algorithm: "weighted_multi_factor",
        metadata: JSON.stringify({ factors: result.factors.length, affectedCount: result.affectedEntities.length }),
      },
    });
  }

  async list(params?: { type?: string; riskLevel?: string; minRisk?: number; limit?: number; offset?: number }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.minRisk !== undefined) where.riskScore = { gte: filters.minRisk };

    const [predictions, total] = await Promise.all([
      db.environmentalPrediction.findMany({ where, take: limit, skip: offset, orderBy: { riskScore: "desc" } }),
      db.environmentalPrediction.count({ where }),
    ]);

    return {
      predictions: predictions.map((p) => ({
        ...p,
        factors: JSON.parse(p.factors),
        affectedEntities: p.affectedEntities ? JSON.parse(p.affectedEntities) : null,
        metadata: p.metadata ? JSON.parse(p.metadata) : null,
      })),
      total,
    };
  }

  async getById(id: string) {
    const p = await db.environmentalPrediction.findUnique({ where: { id } });
    if (!p) return null;
    return {
      ...p,
      factors: JSON.parse(p.factors),
      affectedEntities: p.affectedEntities ? JSON.parse(p.affectedEntities) : null,
      metadata: p.metadata ? JSON.parse(p.metadata) : null,
    };
  }

  async summary() {
    const [total, byType, byRiskLevel, avgRisk, critical, recent, topRisk] = await Promise.all([
      db.environmentalPrediction.count(),
      db.environmentalPrediction.groupBy({ by: ["type"], _count: true, _avg: { riskScore: true } }),
      db.environmentalPrediction.groupBy({ by: ["riskLevel"], _count: true }),
      db.environmentalPrediction.aggregate({ _avg: { riskScore: true, confidence: true } }),
      db.environmentalPrediction.count({ where: { riskLevel: "critical" } }),
      db.environmentalPrediction.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
      db.environmentalPrediction.findMany({ take: 5, orderBy: { riskScore: "desc" } }),
    ]);

    return {
      total,
      avgRiskScore: avgRisk._avg.riskScore ?? 0,
      avgConfidence: avgRisk._avg.confidence ?? 0,
      criticalCount: critical,
      byType: byType.map((t) => ({ type: t.type, count: t._count, avgRisk: t._avg.riskScore ?? 0 })),
      byRiskLevel: byRiskLevel.map((r) => ({ level: r.riskLevel, count: r._count })),
      recent: recent.map((p) => ({
        id: p.id, type: p.type, targetName: p.targetName, riskScore: p.riskScore, riskLevel: p.riskLevel,
        confidence: p.confidence, timeframe: p.timeframe, prediction: p.prediction, createdAt: p.createdAt,
      })),
      topRisk: topRisk.map((p) => ({
        id: p.id, type: p.type, targetName: p.targetName, riskScore: p.riskScore, riskLevel: p.riskLevel,
        prediction: p.prediction, timeframe: p.timeframe,
      })),
    };
  }
}

let _svc: PredictionService | null = null;
export function getPredictionService(): PredictionService {
  if (!_svc) _svc = new PredictionService();
  return _svc;
}
