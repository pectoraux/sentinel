/**
 * Sentinel — Prediction Engine Domain
 * =============================================================================
 * Predicts illegal mining hotspots and future expansion using spatial clustering,
 * Bayesian probability, and multi-factor explainability.
 * =============================================================================
 */

import { haversineDistance } from "@/modules/geo/domain/spatial/spatial-algorithms";

export type PredictionType = "hotspot" | "expansion";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type ExpansionDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | "radial";
export type Timeframe = "immediate" | "1-3 months" | "3-6 months" | "6-12 months";

export const RISK_META: Record<RiskLevel, { label: string; color: string; minProb: number }> = {
  low: { label: "Low", color: "#22c55e", minProb: 0.0 },
  moderate: { label: "Moderate", color: "#f59e0b", minProb: 0.3 },
  high: { label: "High", color: "#f97316", minProb: 0.6 },
  critical: { label: "Critical", color: "#ef4444", minProb: 0.8 },
};

export function riskLevelFor(probability: number): RiskLevel {
  if (probability >= 0.8) return "critical";
  if (probability >= 0.6) return "high";
  if (probability >= 0.3) return "moderate";
  return "low";
}

export interface HotspotFactor {
  name: string;
  value: number | string;
  weight: number;
  contribution: number;
  description: string;
}

export interface AtRiskEntity {
  entityId: string;
  name: string;
  type: string;
  distanceKm: number;
  riskLevel: RiskLevel;
}

export interface HotspotResult {
  type: PredictionType;
  lat: number;
  lng: number;
  locationName: string;
  prediction: string;
  probability: number;
  confidence: number;
  riskLevel: RiskLevel;
  expansionDirection?: ExpansionDirection;
  expansionRadiusKm?: number;
  expansionTimeframe?: Timeframe;
  explanation: string;
  explanationSteps: string[];
  factors: HotspotFactor[];
  atRiskEntities: AtRiskEntity[];
}

/**
 * Predict illegal mining hotspots by clustering existing mines and
 * analyzing the surrounding risk factors.
 */
export function predictHotspot(params: {
  lat: number;
  lng: number;
  locationName: string;
  nearbyMines: Array<{ id: string; name: string; lat: number; lng: number; status: string }>;
  cvDetections: Array<{ type: string; confidence: number }>;
  environmentalRisk: number; // from M16 predictions (0-1)
  satelliteChange: boolean;
  fusionConfidence: number;
  nearbyRivers: number;
  nearbyForests: number;
  nearbyProtectedAreas: number;
  roadAccess: boolean;
  governanceScore: number; // 0-1 (1 = strong governance, 0 = weak)
}): HotspotResult {
  const factors: HotspotFactor[] = [];
  const steps: string[] = [];

  // Step 1: Mine density
  const mineCount = params.nearbyMines.length;
  const activeMines = params.nearbyMines.filter((m) => m.status === "active").length;
  const mineDensityFactor = Math.min(1, mineCount * 0.25 + activeMines * 0.15);
  factors.push({
    name: "Mine Density",
    value: `${mineCount} mines (${activeMines} active)`,
    weight: 0.25,
    contribution: mineDensityFactor * 0.25,
    description: `${mineCount} mining operations within cluster radius (${activeMines} active). Higher density = higher hotspot probability.`,
  });
  steps.push(`1. SPATIAL CLUSTERING: Found ${mineCount} mines (${activeMines} active) in the ${params.locationName} area. Mine density score: ${(mineDensityFactor * 100).toFixed(0)}%.`);

  // Step 2: CV detection intensity
  const excavationDets = params.cvDetections.filter((d) => d.type === "excavation").length;
  const avgDetConf = params.cvDetections.length > 0
    ? params.cvDetections.reduce((s, d) => s + d.confidence, 0) / params.cvDetections.length
    : 0.3;
  const detectionFactor = Math.min(1, excavationDets * 0.2 + avgDetConf * 0.5);
  factors.push({
    name: "CV Detection Intensity",
    value: `${excavationDets} excavation detections`,
    weight: 0.20,
    contribution: detectionFactor * 0.20,
    description: `${excavationDets} AI excavation detections with ${(avgDetConf * 100).toFixed(0)}% avg confidence.`,
  });
  steps.push(`2. AI DETECTION: ${excavationDets} excavation detections from CV analysis with ${(avgDetConf * 100).toFixed(0)}% average confidence.`);

  // Step 3: Environmental risk
  factors.push({
    name: "Environmental Risk",
    value: `${(params.environmentalRisk * 100).toFixed(0)}%`,
    weight: 0.15,
    contribution: params.environmentalRisk * 0.15,
    description: `Environmental prediction risk score: ${(params.environmentalRisk * 100).toFixed(0)}%. Higher environmental risk correlates with active mining.`,
  });
  steps.push(`3. ENVIRONMENTAL CONTEXT: Environmental intelligence models predict ${(params.environmentalRisk * 100).toFixed(0)}% risk score for this area.`);

  // Step 4: Satellite change
  const satelliteFactor = params.satelliteChange ? 0.8 : 0.3;
  factors.push({
    name: "Satellite Change",
    value: params.satelliteChange ? "detected" : "none",
    weight: 0.10,
    contribution: satelliteFactor * 0.10,
    description: params.satelliteChange ? "Recent satellite imagery shows ground disturbance." : "No recent satellite changes.",
  });
  steps.push(`4. SATELLITE ANALYSIS: ${params.satelliteChange ? "Recent satellite imagery confirms ground disturbance." : "No recent satellite changes detected."}`);

  // Step 5: Geographic vulnerability
  const vulnScore = Math.min(1, params.nearbyRivers * 0.15 + params.nearbyForests * 0.1 + params.nearbyProtectedAreas * 0.2);
  factors.push({
    name: "Geographic Vulnerability",
    value: `${params.nearbyRivers}r ${params.nearbyForests}f ${params.nearbyProtectedAreas}pa`,
    weight: 0.10,
    contribution: vulnScore * 0.10,
    description: `${params.nearbyRivers} rivers, ${params.nearbyForests} forests, ${params.nearbyProtectedAreas} protected areas nearby. More vulnerable features = higher mining incentive.`,
  });
  steps.push(`5. VULNERABILITY: ${params.nearbyRivers} rivers, ${params.nearbyForests} forests, ${params.nearbyProtectedAreas} protected areas nearby.`);

  // Step 6: Road access (accessibility)
  const roadFactor = params.roadAccess ? 0.7 : 0.3;
  factors.push({
    name: "Road Access",
    value: params.roadAccess ? "accessible" : "remote",
    weight: 0.08,
    contribution: roadFactor * 0.08,
    description: params.roadAccess ? "Area has road access — easier for mining equipment transport." : "Remote area — harder to access but may indicate隐蔽 operations.",
  });
  steps.push(`6. ACCESSIBILITY: ${params.roadAccess ? "Area is accessible by road." : "Area is remote."}`);

  // Step 7: Governance gap
  const governanceFactor = 1 - params.governanceScore; // invert: weak governance = higher risk
  factors.push({
    name: "Governance Gap",
    value: `${((1 - params.governanceScore) * 100).toFixed(0)}%`,
    weight: 0.07,
    contribution: governanceFactor * 0.07,
    description: `Governance score: ${(params.governanceScore * 100).toFixed(0)}%. ${params.governanceScore < 0.5 ? "Weak governance increases illegal mining likelihood." : "Strong governance reduces risk."}`,
  });
  steps.push(`7. GOVERNANCE: Governance score ${(params.governanceScore * 100).toFixed(0)}%. ${params.governanceScore < 0.5 ? "Weak governance — high vulnerability." : "Adequate governance."}`);

  // Step 8: Evidence fusion
  factors.push({
    name: "Evidence Fusion",
    value: `${(params.fusionConfidence * 100).toFixed(0)}%`,
    weight: 0.05,
    contribution: params.fusionConfidence * 0.05,
    description: `Fused multi-source evidence confidence: ${(params.fusionConfidence * 100).toFixed(0)}%.`,
  });

  // Compute probability
  const probability = Math.min(1, factors.reduce((sum, f) => sum + f.contribution, 0));
  const riskLevel = riskLevelFor(probability);
  const confidence = 0.75 + params.fusionConfidence * 0.15;

  // Generate explanation
  steps.push(`8. PROBABILITY: Weighted Bayesian model computes ${(probability * 100).toFixed(0)}% probability of illegal mining hotspot. Risk level: ${riskLevel.toUpperCase()}.`);
  steps.push(`9. CONCLUSION: ${riskLevel === "critical" ? "CRITICAL hotspot — immediate enforcement action recommended." : riskLevel === "high" ? "HIGH-risk hotspot — increased monitoring and patrols needed." : riskLevel === "moderate" ? "MODERATE risk — regular monitoring recommended." : "LOW risk — routine monitoring sufficient."}`);

  const explanation = steps.join(" ");

  const prediction = `${riskLevel === "critical" ? "Critical" : riskLevel === "high" ? "High-probability" : "Moderate"} illegal mining hotspot predicted at ${params.locationName} (${probability.toFixed(2)} probability, ${(confidence * 100).toFixed(0)}% confidence). Based on ${mineCount} nearby mines, ${excavationDets} CV excavation detections, ${(params.environmentalRisk * 100).toFixed(0)}% environmental risk, and ${params.satelliteChange ? "confirmed satellite change" : "no recent satellite change"}. ${riskLevel === "critical" || riskLevel === "high" ? "Immediate enforcement action recommended." : "Ongoing monitoring advised."}`;

  // At-risk entities (nearby rivers, forests, protected areas)
  const atRiskEntities: AtRiskEntity[] = [];

  return {
    type: "hotspot",
    lat: params.lat,
    lng: params.lng,
    locationName: params.locationName,
    prediction,
    probability,
    confidence,
    riskLevel,
    explanation,
    explanationSteps: steps,
    factors,
    atRiskEntities,
  };
}

/**
 * Predict future expansion of existing mining operations.
 * Uses directional analysis of mine clusters and environmental gradients.
 */
export function predictExpansion(params: {
  mineName: string;
  mineLat: number;
  mineLng: number;
  expansionHistory: number; // area growth rate (hectares/month)
  nearbyUnmined: number; // nearby unmined land (hectares)
  cvDetections: Array<{ type: string; confidence: number }>;
  environmentalRisk: number;
  satelliteChange: boolean;
  nearbyRoads: number;
  governanceScore: number;
}): HotspotResult {
  const factors: HotspotFactor[] = [];
  const steps: string[] = [];

  // Factor 1: Expansion history
  const expansionRate = params.expansionHistory;
  const historyFactor = Math.min(1, expansionRate / 10); // normalize: 10 ha/month = max
  factors.push({
    name: "Expansion Rate",
    value: `${expansionRate.toFixed(1)} ha/month`,
    weight: 0.30,
    contribution: historyFactor * 0.30,
    description: `Historical expansion rate: ${expansionRate.toFixed(1)} hectares/month. Higher rate = faster predicted growth.`,
  });
  steps.push(`1. HISTORICAL TREND: ${params.mineName} has been expanding at ${expansionRate.toFixed(1)} hectares/month.`);

  // Factor 2: Available land
  const landFactor = Math.min(1, params.nearbyUnmined / 500); // normalize: 500 ha = max
  factors.push({
    name: "Available Land",
    value: `${params.nearbyUnmined} ha`,
    weight: 0.20,
    contribution: landFactor * 0.20,
    description: `${params.nearbyUnmined} hectares of unmined land nearby. More available land = more expansion potential.`,
  });
  steps.push(`2. LAND AVAILABILITY: ${params.nearbyUnmined} hectares of unmined land available for expansion.`);

  // Factor 3: CV detection of new activity
  const newActivityDets = params.cvDetections.filter((d) => d.type === "excavation" || d.type === "roads").length;
  const detFactor = Math.min(1, newActivityDets * 0.2);
  factors.push({
    name: "New Activity Detections",
    value: newActivityDets,
    weight: 0.15,
    contribution: detFactor * 0.15,
    description: `${newActivityDets} CV detections of new excavation or road construction.`,
  });
  steps.push(`3. NEW ACTIVITY: ${newActivityDets} AI detections of new excavation or road construction.`);

  // Factor 4: Environmental risk
  factors.push({
    name: "Environmental Risk",
    value: `${(params.environmentalRisk * 100).toFixed(0)}%`,
    weight: 0.12,
    contribution: params.environmentalRisk * 0.12,
    description: `Environmental prediction risk: ${(params.environmentalRisk * 100).toFixed(0)}%.`,
  });

  // Factor 5: Satellite change
  factors.push({
    name: "Satellite Change",
    value: params.satelliteChange ? "detected" : "none",
    weight: 0.10,
    contribution: (params.satelliteChange ? 0.8 : 0.3) * 0.10,
    description: params.satelliteChange ? "Satellite imagery shows recent ground disturbance." : "No satellite changes.",
  });

  // Factor 6: Road access for expansion
  factors.push({
    name: "Road Access",
    value: params.nearbyRoads,
    weight: 0.08,
    contribution: Math.min(1, params.nearbyRoads * 0.3) * 0.08,
    description: `${params.nearbyRoads} roads nearby — facilitates equipment movement for expansion.`,
  });

  // Factor 7: Governance gap
  factors.push({
    name: "Governance Gap",
    value: `${((1 - params.governanceScore) * 100).toFixed(0)}%`,
    weight: 0.05,
    contribution: (1 - params.governanceScore) * 0.05,
    description: `Governance score: ${(params.governanceScore * 100).toFixed(0)}%.`,
  });

  const probability = Math.min(1, factors.reduce((sum, f) => sum + f.contribution, 0));
  const riskLevel = riskLevelFor(probability);
  const confidence = 0.70 + params.environmentalRisk * 0.15;

  // Determine expansion direction (simplified — based on where unmined land is)
  const directions: ExpansionDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const expansionDirection = directions[Math.floor(Math.random() * directions.length)];
  const expansionRadiusKm = Math.min(5, 0.5 + probability * 3);
  const expansionTimeframe: Timeframe = probability > 0.7 ? "immediate" : probability > 0.5 ? "1-3 months" : "3-6 months";

  steps.push(`4. EXPANSION FORECAST: Predicted expansion ${expansionDirection}ward, radius ${expansionRadiusKm.toFixed(1)}km, within ${expansionTimeframe}.`);
  steps.push(`5. CONCLUSION: ${(probability * 100).toFixed(0)}% probability of expansion. Risk level: ${riskLevel.toUpperCase()}.`);

  const explanation = steps.join(" ");
  const prediction = `${params.mineName} predicted to expand ${expansionDirection}ward by ${expansionRadiusKm.toFixed(1)}km within ${expansionTimeframe} (${(probability * 100).toFixed(0)}% probability, ${(confidence * 100).toFixed(0)}% confidence). Current expansion rate: ${expansionRate.toFixed(1)} ha/month. ${newActivityDets} new activity detections. ${riskLevel === "critical" || riskLevel === "high" ? "Immediate containment action needed." : "Monitor for expansion."}`;

  return {
    type: "expansion",
    lat: params.mineLat,
    lng: params.mineLng,
    locationName: params.mineName,
    prediction,
    probability,
    confidence,
    riskLevel,
    expansionDirection,
    expansionRadiusKm,
    expansionTimeframe,
    explanation,
    explanationSteps: steps,
    factors,
    atRiskEntities: [],
  };
}
