/**
 * Sentinel — Environmental Intelligence Domain
 * =============================================================================
 * Predictive models for environmental impact: sediment flow, river impact,
 * forest loss, downstream effects, protected area risk.
 *
 * Each prediction type uses a weighted multi-factor algorithm that combines
 * real data from the platform: mine proximity, satellite change detection,
 * CV detection results, fusion confidence, knowledge graph relationships,
 * and historical temporal data.
 * =============================================================================
 */

export type PredictionType =
  | "sediment"
  | "river_impact"
  | "forest_loss"
  | "downstream_effects"
  | "protected_area_risk";

export const PREDICTION_TYPE_META: Record<PredictionType, { label: string; description: string; color: string; icon: string }> = {
  sediment: { label: "Sediment Flow", description: "Predicted sediment load from mining into rivers", color: "#f59e0b", icon: "Waves" },
  river_impact: { label: "River Impact", description: "Overall river health impact from pollution sources", color: "#0ea5e9", icon: "Droplets" },
  forest_loss: { label: "Forest Loss", description: "Predicted canopy loss from mining encroachment", color: "#22c55e", icon: "TreePine" },
  downstream_effects: { label: "Downstream Effects", description: "Impact on communities and ecosystems downstream", color: "#a78bfa", icon: "ArrowDown" },
  protected_area_risk: { label: "Protected Area Risk", description: "Risk to legally protected zones from mining activity", color: "#ef4444", icon: "ShieldAlert" },
};

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const RISK_META: Record<RiskLevel, { label: string; color: string; minScore: number }> = {
  low: { label: "Low", color: "#22c55e", minScore: 0.0 },
  moderate: { label: "Moderate", color: "#f59e0b", minScore: 0.3 },
  high: { label: "High", color: "#f97316", minScore: 0.6 },
  critical: { label: "Critical", color: "#ef4444", minScore: 0.8 },
};

export function riskLevelFor(score: number): RiskLevel {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.3) return "moderate";
  return "low";
}

export type Timeframe = "immediate" | "1-3 months" | "3-6 months" | "6-12 months" | "1+ years";

export interface PredictionFactor {
  name: string;
  value: number | string;
  weight: number;
  contribution: number;
  description: string;
}

export interface PredictionResult {
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  timeframe: Timeframe;
  prediction: string;
  factors: PredictionFactor[];
  affectedEntities: Array<{ name: string; type: string; impactLevel: string }>;
}

/**
 * Predict sediment load from mining into a river.
 * Factors: mine proximity, mine activity level, rainfall seasonality, erosion potential, CV excavation detections.
 */
export function predictSediment(params: {
  riverName: string;
  mineCount: number;
  mineProximityScore: number; // 0-1 (1 = very close)
  excavationDetections: number;
  excavationConfidence: number;
  satelliteChangeDetected: boolean;
  fusionConfidence: number;
}): PredictionResult {
  const factors: PredictionFactor[] = [];

  // Factor 1: Mine proximity (weight 0.30)
  const mineProxFactor = params.mineProximityScore;
  factors.push({ name: "Mine Proximity", value: params.mineCount, weight: 0.30, contribution: mineProxFactor * 0.30, description: `${params.mineCount} mines near river (proximity score: ${mineProxFactor.toFixed(2)})` });

  // Factor 2: Excavation activity (weight 0.25)
  const excavationFactor = params.excavationDetections > 0 ? params.excavationConfidence : 0.3;
  factors.push({ name: "Excavation Activity", value: params.excavationDetections, weight: 0.25, contribution: excavationFactor * 0.25, description: `${params.excavationDetections} excavation detections (${(excavationFactor * 100).toFixed(0)}% confidence)` });

  // Factor 3: Satellite change (weight 0.20)
  const satelliteFactor = params.satelliteChangeDetected ? 0.85 : 0.3;
  factors.push({ name: "Satellite Change", value: params.satelliteChangeDetected ? "detected" : "none", weight: 0.20, contribution: satelliteFactor * 0.20, description: params.satelliteChangeDetected ? "Recent satellite imagery shows ground disturbance" : "No recent changes detected" });

  // Factor 4: Fusion confidence (weight 0.15)
  factors.push({ name: "Evidence Fusion", value: params.fusionConfidence.toFixed(2), weight: 0.15, contribution: params.fusionConfidence * 0.15, description: `Fused evidence confidence: ${(params.fusionConfidence * 100).toFixed(0)}%` });

  // Factor 5: Erosion potential (weight 0.10) — derived from mine count
  const erosionFactor = Math.min(1, params.mineCount * 0.3);
  factors.push({ name: "Erosion Potential", value: erosionFactor.toFixed(2), weight: 0.10, contribution: erosionFactor * 0.10, description: `Estimated erosion potential from ${params.mineCount} mining sites` });

  const riskScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const riskLevel = riskLevelFor(riskScore);
  const confidence = 0.7 + params.fusionConfidence * 0.2;

  const prediction = `${riskLevel === "critical" ? "Critical" : riskLevel === "high" ? "High" : "Moderate"} sediment load predicted for ${params.riverName} from ${params.mineCount} nearby mining operations. ${params.excavationDetections} active excavation sites detected. ${params.satelliteChangeDetected ? "Recent satellite imagery confirms ground disturbance." : "No recent satellite changes detected."} Expected impact: ${riskLevel === "critical" ? "severe water quality degradation" : riskLevel === "high" ? "significant turbidity increase" : "moderate sediment increase"}.`;

  return {
    riskScore,
    riskLevel,
    confidence,
    timeframe: riskLevel === "critical" || riskLevel === "high" ? "immediate" : "1-3 months",
    prediction,
    factors,
    affectedEntities: [
      { name: params.riverName, type: "river", impactLevel: riskLevel },
      { name: "Downstream communities", type: "community", impactLevel: riskLevel === "critical" ? "high" : "moderate" },
    ],
  };
}

/**
 * Predict river impact from all pollution sources.
 */
export function predictRiverImpact(params: {
  riverName: string;
  sedimentRisk: number;
  pollutionDetections: number;
  pollutionConfidence: number;
  fusionConfidence: number;
  upstreamMines: number;
}): PredictionResult {
  const factors: PredictionFactor[] = [
    { name: "Sediment Risk", value: params.sedimentRisk.toFixed(2), weight: 0.30, contribution: params.sedimentRisk * 0.30, description: `Sediment flow risk: ${(params.sedimentRisk * 100).toFixed(0)}%` },
    { name: "Pollution Detections", value: params.pollutionDetections, weight: 0.25, contribution: Math.min(1, params.pollutionDetections * 0.3) * 0.25, description: `${params.pollutionDetections} pollution/water change detections` },
    { name: "Detection Confidence", value: params.pollutionConfidence.toFixed(2), weight: 0.20, contribution: params.pollutionConfidence * 0.20, description: `AI confidence in pollution: ${(params.pollutionConfidence * 100).toFixed(0)}%` },
    { name: "Upstream Mines", value: params.upstreamMines, weight: 0.15, contribution: Math.min(1, params.upstreamMines * 0.35) * 0.15, description: `${params.upstreamMines} mines upstream` },
    { name: "Evidence Fusion", value: params.fusionConfidence.toFixed(2), weight: 0.10, contribution: params.fusionConfidence * 0.10, description: `Fused confidence: ${(params.fusionConfidence * 100).toFixed(0)}%` },
  ];

  const riskScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const riskLevel = riskLevelFor(riskScore);
  const confidence = 0.75;

  const prediction = `${params.riverName} faces ${riskLevel} overall impact from ${params.upstreamMines} upstream mines and ${params.pollutionDetections} detected pollution events. ${riskLevel === "critical" ? "Immediate intervention recommended." : riskLevel === "high" ? "Water quality monitoring urgently needed." : "Ongoing monitoring recommended."}`;

  return { riskScore, riskLevel, confidence, timeframe: riskLevel === "critical" ? "immediate" : "1-3 months", prediction, factors, affectedEntities: [{ name: params.riverName, type: "river", impactLevel: riskLevel }] };
}

/**
 * Predict forest loss from mining encroachment.
 */
export function predictForestLoss(params: {
  forestName: string;
  nearbyMines: number;
  forestLossDetections: number;
  forestLossConfidence: number;
  satelliteChangeDetected: boolean;
  protectedStatus: boolean;
  fusionConfidence: number;
}): PredictionResult {
  const factors: PredictionFactor[] = [
    { name: "Nearby Mines", value: params.nearbyMines, weight: 0.25, contribution: Math.min(1, params.nearbyMines * 0.35) * 0.25, description: `${params.nearbyMines} mines near forest` },
    { name: "Forest Loss Detections", value: params.forestLossDetections, weight: 0.25, contribution: Math.min(1, params.forestLossDetections * 0.4) * 0.25, description: `${params.forestLossDetections} CV detections of forest loss` },
    { name: "Detection Confidence", value: params.forestLossConfidence.toFixed(2), weight: 0.20, contribution: params.forestLossConfidence * 0.20, description: `AI confidence: ${(params.forestLossConfidence * 100).toFixed(0)}%` },
    { name: "Satellite Change", value: params.satelliteChangeDetected ? "detected" : "none", weight: 0.15, contribution: (params.satelliteChangeDetected ? 0.85 : 0.3) * 0.15, description: params.satelliteChangeDetected ? "Canopy loss visible in satellite" : "No satellite change detected" },
    { name: "Protected Status", value: params.protectedStatus ? "protected" : "unprotected", weight: 0.10, contribution: (params.protectedStatus ? 0.4 : 0.7) * 0.10, description: params.protectedStatus ? "Protected area — encroachment is illegal" : "Not protected — higher vulnerability" },
    { name: "Evidence Fusion", value: params.fusionConfidence.toFixed(2), weight: 0.05, contribution: params.fusionConfidence * 0.05, description: `Fused confidence: ${(params.fusionConfidence * 100).toFixed(0)}%` },
  ];

  const riskScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const riskLevel = riskLevelFor(riskScore);
  const confidence = 0.8;

  const prediction = `${params.forestName} at ${riskLevel} risk of forest loss. ${params.forestLossDetections} AI detections confirm canopy clearing. ${params.nearbyMines} mining operations in proximity. ${params.satelliteChangeDetected ? "Satellite imagery shows active deforestation." : ""} ${params.protectedStatus ? "This is a protected area — encroachment violates conservation law." : ""}`;

  return { riskScore, riskLevel, confidence, timeframe: riskLevel === "critical" ? "1-3 months" : "3-6 months", prediction, factors, affectedEntities: [{ name: params.forestName, type: "forest", impactLevel: riskLevel }, { name: "Biodiversity", type: "ecosystem", impactLevel: riskLevel }] };
}

/**
 * Predict downstream effects on communities and ecosystems.
 */
export function predictDownstream(params: {
  riverName: string;
  upstreamRisk: number;
  communityCount: number;
  populationAffected: number;
  waterSource: string;
  fusionConfidence: number;
}): PredictionResult {
  const factors: PredictionFactor[] = [
    { name: "Upstream Risk", value: params.upstreamRisk.toFixed(2), weight: 0.35, contribution: params.upstreamRisk * 0.35, description: `Upstream river risk: ${(params.upstreamRisk * 100).toFixed(0)}%` },
    { name: "Communities at Risk", value: params.communityCount, weight: 0.25, contribution: Math.min(1, params.communityCount * 0.3) * 0.25, description: `${params.communityCount} communities downstream` },
    { name: "Population Exposed", value: params.populationAffected, weight: 0.20, contribution: Math.min(1, params.populationAffected / 50000) * 0.20, description: `${params.populationAffected.toLocaleString()} people potentially affected` },
    { name: "Water Source Dependency", value: params.waterSource, weight: 0.15, contribution: (params.waterSource === "river" ? 0.9 : 0.3) * 0.15, description: `Water source: ${params.waterSource}` },
    { name: "Evidence Fusion", value: params.fusionConfidence.toFixed(2), weight: 0.05, contribution: params.fusionConfidence * 0.05, description: `Fused confidence: ${(params.fusionConfidence * 100).toFixed(0)}%` },
  ];

  const riskScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const riskLevel = riskLevelFor(riskScore);
  const confidence = 0.72;

  const prediction = `${params.communityCount} communities (${params.populationAffected.toLocaleString()} people) downstream of ${params.riverName} face ${riskLevel} risk from upstream contamination. ${params.waterSource === "river" ? "These communities depend on the river for drinking water — health risk is severe." : "Alternative water sources may mitigate impact."}`;

  return { riskScore, riskLevel, confidence, timeframe: "1-3 months", prediction, factors, affectedEntities: [{ name: `${params.communityCount} communities`, type: "community", impactLevel: riskLevel }] };
}

/**
 * Predict risk to protected areas from mining activity.
 */
export function predictProtectedAreaRisk(params: {
  areaName: string;
  nearbyMines: number;
  mineProximityScore: number;
  forestLossDetections: number;
  satelliteChangeDetected: boolean;
  enforcementLevel: string; // active | passive | none
  fusionConfidence: number;
}): PredictionResult {
  const factors: PredictionFactor[] = [
    { name: "Mine Proximity", value: params.nearbyMines, weight: 0.30, contribution: params.mineProximityScore * 0.30, description: `${params.nearbyMines} mines near protected area (proximity: ${params.mineProximityScore.toFixed(2)})` },
    { name: "Forest Loss", value: params.forestLossDetections, weight: 0.25, contribution: Math.min(1, params.forestLossDetections * 0.4) * 0.25, description: `${params.forestLossDetections} forest loss detections` },
    { name: "Satellite Change", value: params.satelliteChangeDetected ? "detected" : "none", weight: 0.20, contribution: (params.satelliteChangeDetected ? 0.85 : 0.25) * 0.20, description: params.satelliteChangeDetected ? "Encroachment visible from space" : "No visible encroachment" },
    { name: "Enforcement Level", value: params.enforcementLevel, weight: 0.15, contribution: (params.enforcementLevel === "none" ? 0.9 : params.enforcementLevel === "passive" ? 0.6 : 0.3) * 0.15, description: `Enforcement: ${params.enforcementLevel}` },
    { name: "Evidence Fusion", value: params.fusionConfidence.toFixed(2), weight: 0.10, contribution: params.fusionConfidence * 0.10, description: `Fused confidence: ${(params.fusionConfidence * 100).toFixed(0)}%` },
  ];

  const riskScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const riskLevel = riskLevelFor(riskScore);
  const confidence = 0.78;

  const prediction = `${params.areaName} protected area at ${riskLevel} risk from mining encroachment. ${params.nearbyMines} mining operations in proximity. ${params.forestLossDetections > 0 ? `${params.forestLossDetections} confirmed forest loss detections inside the boundary.` : ""} ${params.enforcementLevel === "none" ? "No active enforcement — vulnerability is critical." : params.enforcementLevel === "passive" ? "Passive enforcement — increased patrols recommended." : "Active enforcement in place."}`;

  return { riskScore, riskLevel, confidence, timeframe: riskLevel === "critical" ? "immediate" : "1-3 months", prediction, factors, affectedEntities: [{ name: params.areaName, type: "protected_area", impactLevel: riskLevel }] };
}
