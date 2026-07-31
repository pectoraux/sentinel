/**
 * Sentinel — Simulation Engine Service
 * =============================================================================
 * "What if?" scenario modeling. Runs simulations by gathering real platform
 * data (hotspots, investigations, inspections, predictions) as the baseline
 * context, then applying intervention parameters to predict outcomes.
 *
 * The engine predicts 5 outcome dimensions over a time horizon:
 *   1. illegal_mining_rate  — % change in illegal mining activity
 *   2. water_quality        — % change in water quality index
 *   3. forest_cover         — hectares of forest saved/lost
 *   4. economic_impact      — GHS (damages avoided)
 *   5. enforcement_cost     — GHS (cost of intervention)
 *
 * Net benefit = economic_impact - enforcement_cost
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  INTERVENTION_TYPE_META,
  predictOutcomes,
  generateExplanation,
  compareScenarios,
  generateScenarioKey,
  type InterventionType,
  type InterventionParams,
} from "../../domain/simulation-types";

export class SimulationService {
  // ===========================================================================
  // RUN SIMULATION
  // ===========================================================================

  /**
   * Run a simulation scenario. Gathers real platform data as baseline context,
   * applies intervention parameters, predicts outcomes.
   */
  async runSimulation(params: {
    name: string;
    description: string;
    interventionType: InterventionType;
    interventionParams: InterventionParams;
    timeHorizonMonths: number;
    region?: string;
    district?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    isBaseline?: boolean;
    createdBy?: string;
  }): Promise<{ scenarioId: string }> {
    // Gather real platform data as baseline context
    const hotspotWhere: Record<string, unknown> = {};
    const investigationWhere: Record<string, unknown> = {};
    const inspectionWhere: Record<string, unknown> = {};
    if (params.region) {
      hotspotWhere.region = params.region;
      investigationWhere.region = params.region;
      inspectionWhere.region = params.region;
    }

    const [hotspots, investigations, inspections, predictions, twinEntities] = await Promise.all([
      db.hotspotPrediction.findMany({ where: hotspotWhere, select: { id: true, type: true, locationName: true, probability: true, riskLevel: true }, take: 50 }),
      db.investigation.findMany({ where: investigationWhere, select: { id: true, type: true, status: true, estimatedImpactGHS: true }, take: 50 }),
      db.inspection.findMany({ where: inspectionWhere, select: { id: true, type: true, status: true, complianceLevel: true, violationCount: true }, take: 50 }),
      db.environmentalPrediction.findMany({ select: { id: true, type: true, targetName: true, riskScore: true, riskLevel: true }, take: 50 }),
      db.twinEntity.findMany({ where: params.region ? {} : {}, select: { id: true, name: true, type: true }, take: 50 }),
    ]);

    const hotspotCount = hotspots.length;
    const investigationCount = investigations.length;
    const inspectionCount = inspections.length;

    // Predict outcomes
    const prediction = predictOutcomes({
      interventionType: params.interventionType,
      interventionParams: params.interventionParams,
      timeHorizonMonths: params.timeHorizonMonths,
      hotspotCount,
      investigationCount,
      inspectionCount,
      region: params.region,
    });

    // Generate explanation
    const explanation = generateExplanation({
      interventionType: params.interventionType,
      timeHorizonMonths: params.timeHorizonMonths,
      locationName: params.locationName,
      metrics: prediction.metrics,
    });

    // Create scenario record
    const key = generateScenarioKey({
      interventionType: params.interventionType,
      region: params.region,
      locationName: params.locationName,
    });

    const scenario = await db.simulationScenario.create({
      data: {
        key,
        name: params.name,
        description: params.description,
        type: params.interventionType,
        status: "completed",
        region: params.region,
        district: params.district,
        locationName: params.locationName,
        lat: params.lat,
        lng: params.lng,
        radiusKm: params.radiusKm,
        timeHorizonMonths: params.timeHorizonMonths,
        isBaseline: params.isBaseline ?? params.interventionType === "baseline",
        parameters: JSON.stringify(params.interventionParams),
        outcomes: JSON.stringify(prediction.timeSeries),
        illegalMiningRateChange: prediction.metrics.illegalMiningRateChange,
        waterQualityChange: prediction.metrics.waterQualityChange,
        forestCoverChangeHa: prediction.metrics.forestCoverChangeHa,
        economicImpactGHS: prediction.metrics.economicImpactGHS,
        enforcementCostGHS: prediction.metrics.enforcementCostGHS,
        netBenefitGHS: prediction.metrics.netBenefitGHS,
        confidence: 0.7 + Math.min(0.25, hotspotCount * 0.02),
        model: "sim-engine-v1",
        algorithm: "intervention_impact_model",
        inputInvestigationIds: JSON.stringify(investigations.map((i) => i.id)),
        inputInspectionIds: JSON.stringify(inspections.map((i) => i.id)),
        inputHotspotIds: JSON.stringify(hotspots.map((h) => h.id)),
        inputPredictionIds: JSON.stringify(predictions.map((p) => p.id)),
        inputEntityIds: JSON.stringify(twinEntities.map((e) => e.id)),
        explanation,
        factorsBreakdown: JSON.stringify(prediction.factorsBreakdown),
        metadata: JSON.stringify({
          hotspotCount,
          investigationCount,
          inspectionCount,
          predictionCount: predictions.length,
          entityCount: twinEntities.length,
          createdBy: params.createdBy,
        }),
        createdBy: params.createdBy,
      },
    });

    logger.info("simulation.run", {
      scenarioId: scenario.id,
      type: params.interventionType,
      netBenefit: prediction.metrics.netBenefitGHS,
      hotspotCount,
    });

    return { scenarioId: scenario.id };
  }

  // ===========================================================================
  // COMPARE SCENARIOS
  // ===========================================================================

  async compareScenarios(params: {
    name: string;
    description?: string;
    scenarioIds: string[];
    createdBy?: string;
  }): Promise<{ comparisonId: string; bestScenarioId: string; results: any }> {
    const scenarios = await db.simulationScenario.findMany({
      where: { id: { in: params.scenarioIds } },
      select: {
        id: true,
        name: true,
        type: true,
        illegalMiningRateChange: true,
        waterQualityChange: true,
        forestCoverChangeHa: true,
        economicImpactGHS: true,
        enforcementCostGHS: true,
        netBenefitGHS: true,
      },
    });

    if (scenarios.length < 2) {
      throw new Error("need_at_least_2_scenarios");
    }

    const comparison = compareScenarios(
      scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as InterventionType,
        metrics: {
          illegalMiningRateChange: s.illegalMiningRateChange,
          waterQualityChange: s.waterQualityChange,
          forestCoverChangeHa: s.forestCoverChangeHa,
          economicImpactGHS: s.economicImpactGHS,
          enforcementCostGHS: s.enforcementCostGHS,
          netBenefitGHS: s.netBenefitGHS,
        },
      })),
    );

    const key = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record = await db.simulationComparison.create({
      data: {
        key,
        name: params.name,
        description: params.description,
        scenarioIds: JSON.stringify(params.scenarioIds),
        results: JSON.stringify(comparison.results),
        bestScenarioId: comparison.bestScenarioId,
        bestMetric: comparison.bestMetric,
        createdBy: params.createdBy,
      },
    });

    return {
      comparisonId: record.id,
      bestScenarioId: comparison.bestScenarioId,
      results: { ...comparison, scenarios: scenarios.map((s) => ({ ...s, type: s.type as InterventionType })) },
    };
  }

  // ===========================================================================
  // READ METHODS
  // ===========================================================================

  async listScenarios(params?: {
    type?: string;
    region?: string;
    isBaseline?: boolean;
    limit?: number;
  }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.region) where.region = filters.region;
    if (filters.isBaseline !== undefined) where.isBaseline = filters.isBaseline;

    const scenarios = await db.simulationScenario.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return {
      scenarios: scenarios.map((s) => ({
        ...s,
        parameters: s.parameters ? JSON.parse(s.parameters) : null,
        outcomes: s.outcomes ? JSON.parse(s.outcomes) : null,
        factorsBreakdown: s.factorsBreakdown ? JSON.parse(s.factorsBreakdown) : null,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
      })),
    };
  }

  async getById(id: string) {
    const scenario = await db.simulationScenario.findUnique({ where: { id } });
    if (!scenario) return null;
    return {
      ...scenario,
      parameters: scenario.parameters ? JSON.parse(scenario.parameters) : null,
      outcomes: scenario.outcomes ? JSON.parse(scenario.outcomes) : null,
      factorsBreakdown: scenario.factorsBreakdown ? JSON.parse(scenario.factorsBreakdown) : null,
      metadata: scenario.metadata ? JSON.parse(scenario.metadata) : null,
    };
  }

  async summary() {
    const [
      totalScenarios,
      byType,
      byRegion,
      baselineCount,
      avgNetBenefit,
      totalNetBenefit,
      totalEconomicImpact,
      totalEnforcementCost,
      bestScenario,
      worstScenario,
      recentScenarios,
      totalComparisons,
    ] = await Promise.all([
      db.simulationScenario.count(),
      db.simulationScenario.groupBy({ by: ["type"], _count: true, _avg: { netBenefitGHS: true } }),
      db.simulationScenario.groupBy({ by: ["region"], _count: true }),
      db.simulationScenario.count({ where: { isBaseline: true } }),
      db.simulationScenario.aggregate({ _avg: { netBenefitGHS: true } }),
      db.simulationScenario.aggregate({ _sum: { netBenefitGHS: true } }),
      db.simulationScenario.aggregate({ _sum: { economicImpactGHS: true } }),
      db.simulationScenario.aggregate({ _sum: { enforcementCostGHS: true } }),
      db.simulationScenario.findFirst({ where: { isBaseline: false }, orderBy: { netBenefitGHS: "desc" } }),
      db.simulationScenario.findFirst({ where: { isBaseline: false }, orderBy: { netBenefitGHS: "asc" } }),
      db.simulationScenario.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
      db.simulationComparison.count(),
    ]);

    return {
      totalScenarios,
      baselineCount,
      interventionScenarios: totalScenarios - baselineCount,
      totalComparisons,
      avgNetBenefitGHS: Math.round(avgNetBenefit._avg.netBenefitGHS ?? 0),
      totalNetBenefitGHS: totalNetBenefit._sum.netBenefitGHS ?? 0,
      totalEconomicImpactGHS: totalEconomicImpact._sum.economicImpactGHS ?? 0,
      totalEnforcementCostGHS: totalEnforcementCost._sum.enforcementCostGHS ?? 0,
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count,
        avgNetBenefit: Math.round(t._avg.netBenefitGHS ?? 0),
      })),
      byRegion: byRegion.map((r) => ({ region: r.region, count: r._count })),
      bestScenario: bestScenario
        ? {
            id: bestScenario.id,
            name: bestScenario.name,
            type: bestScenario.type,
            netBenefitGHS: bestScenario.netBenefitGHS,
            illegalMiningRateChange: bestScenario.illegalMiningRateChange,
            locationName: bestScenario.locationName,
          }
        : null,
      worstScenario: worstScenario
        ? {
            id: worstScenario.id,
            name: worstScenario.name,
            type: worstScenario.type,
            netBenefitGHS: worstScenario.netBenefitGHS,
            locationName: worstScenario.locationName,
          }
        : null,
      recentScenarios: recentScenarios.map((s) => ({
        id: s.id,
        key: s.key,
        name: s.name,
        type: s.type,
        region: s.region,
        locationName: s.locationName,
        timeHorizonMonths: s.timeHorizonMonths,
        isBaseline: s.isBaseline,
        illegalMiningRateChange: s.illegalMiningRateChange,
        waterQualityChange: s.waterQualityChange,
        forestCoverChangeHa: s.forestCoverChangeHa,
        economicImpactGHS: s.economicImpactGHS,
        enforcementCostGHS: s.enforcementCostGHS,
        netBenefitGHS: s.netBenefitGHS,
        confidence: s.confidence,
        createdAt: s.createdAt,
      })),
    };
  }
}

let _svc: SimulationService | null = null;
export function getSimulationService(): SimulationService {
  if (!_svc) _svc = new SimulationService();
  return _svc;
}
