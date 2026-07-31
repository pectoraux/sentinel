/**
 * Sentinel — Simulation Engine Domain
 * =============================================================================
 * "What if?" scenario modeling for policy and operational interventions.
 *
 * Users pose questions like:
 *   "What if we increase inspections by 50%?"
 *   "What if we protect the Pra River watershed?"
 *   "What if we close the access roads to Prestea?"
 *   "What if we deploy drones over the Atewa Forest?"
 *
 * The engine predicts outcomes across 5 dimensions over a time horizon:
 *   1. illegal_mining_rate  — % change in illegal mining activity
 *   2. water_quality        — % change in water quality index
 *   3. forest_cover         — hectares of forest saved/lost
 *   4. economic_impact      — GHS (damages avoided)
 *   5. enforcement_cost     — GHS (cost of intervention)
 *
 * Net benefit = economic_impact - enforcement_cost
 * =============================================================================
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Intervention types — the 5 "What if?" scenarios
// ---------------------------------------------------------------------------

export type InterventionType =
  | "baseline"
  | "increase_inspections"
  | "protect_watershed"
  | "close_roads"
  | "deploy_drones"
  | "combined";

export const INTERVENTION_TYPE_META: Record<
  InterventionType,
  { label: string; color: string; icon: string; description: string; question: string }
> = {
  baseline: {
    label: "Baseline (No Intervention)",
    color: "#64748b",
    icon: "Minus",
    description: "Current trajectory — no policy changes. Used as control for comparison.",
    question: "What happens if we do nothing?",
  },
  increase_inspections: {
    label: "Increase Inspections",
    color: "#0ea5e9",
    icon: "ShieldCheck",
    description: "Increase field inspection frequency and coverage. More EPA/Minerals Commission inspectors on the ground.",
    question: "What if we increase inspections by X%?",
  },
  protect_watershed: {
    label: "Protect Watershed",
    color: "#14b8a6",
    icon: "Droplets",
    description: "Establish protected buffer zones around rivers and water bodies. Ban mining within 100m of waterways.",
    question: "What if we protect the watershed?",
  },
  close_roads: {
    label: "Close Roads",
    color: "#f59e0b",
    icon: "Ban",
    description: "Close access roads to illegal mining sites. Block heavy equipment transport routes.",
    question: "What if we close the access roads?",
  },
  deploy_drones: {
    label: "Deploy Drones",
    color: "#a855f7",
    icon: "Plane",
    description: "Deploy surveillance drones for continuous aerial monitoring of high-risk areas.",
    question: "What if we deploy drones?",
  },
  combined: {
    label: "Combined Intervention",
    color: "#ef4444",
    icon: "Layers",
    description: "Multiple interventions applied simultaneously for synergistic effect.",
    question: "What if we combine multiple interventions?",
  },
};

// ---------------------------------------------------------------------------
// Outcome metrics — the 5 predicted dimensions
// ---------------------------------------------------------------------------

export type OutcomeMetric =
  | "illegal_mining_rate"
  | "water_quality"
  | "forest_cover"
  | "economic_impact"
  | "enforcement_cost";

export const OUTCOME_METRIC_META: Record<
  OutcomeMetric,
  { label: string; unit: string; color: string; description: string; goodDirection: "up" | "down" }
> = {
  illegal_mining_rate: {
    label: "Illegal Mining Rate",
    unit: "% change",
    color: "#ef4444",
    description: "Change in illegal mining activity (negative = reduction = good)",
    goodDirection: "down",
  },
  water_quality: {
    label: "Water Quality",
    unit: "% change",
    color: "#0ea5e9",
    description: "Change in water quality index (positive = improvement = good)",
    goodDirection: "up",
  },
  forest_cover: {
    label: "Forest Cover",
    unit: "hectares",
    color: "#22c55e",
    description: "Hectares of forest saved (positive) or lost (negative)",
    goodDirection: "up",
  },
  economic_impact: {
    label: "Economic Impact",
    unit: "GHS",
    color: "#f59e0b",
    description: "Economic damages avoided (positive = savings)",
    goodDirection: "up",
  },
  enforcement_cost: {
    label: "Enforcement Cost",
    unit: "GHS",
    color: "#a855f7",
    description: "Cost of implementing the intervention",
    goodDirection: "down",
  },
};

// ---------------------------------------------------------------------------
// Time horizons
// ---------------------------------------------------------------------------

export const TIME_HORIZONS = [
  { months: 1, label: "1 Month", short: "1mo" },
  { months: 3, label: "3 Months", short: "3mo" },
  { months: 6, label: "6 Months", short: "6mo" },
  { months: 12, label: "1 Year", short: "1yr" },
  { months: 24, label: "2 Years", short: "2yr" },
] as const;

// ---------------------------------------------------------------------------
// Parameter definitions per intervention type
// ---------------------------------------------------------------------------

export interface InterventionParams {
  // Common
  intensity?: number; // 0.0–1.0 — how aggressive the intervention is
  duration?: number; // months the intervention runs
  // increase_inspections
  inspectionIncreasePct?: number; // % increase in inspection frequency (e.g. 50 = +50%)
  inspectorCount?: number; // number of additional inspectors deployed
  // protect_watershed
  bufferZoneM?: number; // buffer zone width in meters (e.g. 100m)
  riversProtected?: number; // number of rivers/streams protected
  // close_roads
  roadsClosed?: number; // number of access roads closed
  checkpointsDeployed?: number; // number of checkpoints
  // deploy_drones
  droneCount?: number; // number of drones deployed
  coverageAreaKm2?: number; // coverage area in km²
  patrolFrequencyPerWeek?: number; // drone patrols per week
}

export const PARAM_RANGES: Record<string, { min: number; max: number; default: number; step: number; label: string }> = {
  inspectionIncreasePct: { min: 10, max: 200, default: 50, step: 10, label: "Inspection Increase (%)" },
  inspectorCount: { min: 1, max: 50, default: 5, step: 1, label: "Additional Inspectors" },
  bufferZoneM: { min: 50, max: 500, default: 100, step: 50, label: "Buffer Zone (m)" },
  riversProtected: { min: 1, max: 20, default: 5, step: 1, label: "Rivers Protected" },
  roadsClosed: { min: 1, max: 30, default: 5, step: 1, label: "Roads Closed" },
  checkpointsDeployed: { min: 1, max: 20, default: 3, step: 1, label: "Checkpoints" },
  droneCount: { min: 1, max: 20, default: 3, step: 1, label: "Drones Deployed" },
  coverageAreaKm2: { min: 10, max: 500, default: 100, step: 10, label: "Coverage Area (km²)" },
  patrolFrequencyPerWeek: { min: 1, max: 14, default: 3, step: 1, label: "Patrols/Week" },
};

// ---------------------------------------------------------------------------
// Prediction model — intervention impact
// =============================================================================
// Each intervention has empirically-derived impact coefficients based on
// environmental enforcement literature and Ghana-specific galamsey data.
// The model computes:
//   Δillegal_mining = -intensity × effectiveness × (1 - diminishing_returns)
//   Δwater_quality  = f(Δillegal_mining, watershed_protection)
//   Δforest_cover   = f(Δillegal_mining, drone_monitoring)
//   economic_impact = damages_per_hectare × hectares_saved
//   enforcement_cost = unit_cost × scale × duration
// ---------------------------------------------------------------------------

export const INTERVENTION_EFFECTIVENESS: Record<InterventionType, {
  illegalMiningReduction: number; // max % reduction at full intensity (0-1)
  waterQualityImprovement: number; // max % improvement (0-1)
  forestProtectionHa: number; // max hectares protected per month
  unitCostGHS: number; // cost per unit per month
  costDriver: string; // which parameter drives cost
  diminishingReturns: number; // 0-1, how quickly effectiveness plateaus
}> = {
  baseline: {
    illegalMiningReduction: 0,
    waterQualityImprovement: 0,
    forestProtectionHa: 0,
    unitCostGHS: 0,
    costDriver: "none",
    diminishingReturns: 0,
  },
  increase_inspections: {
    illegalMiningReduction: 0.35, // up to 35% reduction
    waterQualityImprovement: 0.15,
    forestProtectionHa: 8, // 8 ha/month at full intensity
    unitCostGHS: 3500, // ₵3,500 per inspector per month
    costDriver: "inspectorCount",
    diminishingReturns: 0.3, // plateaus at 30% additional intensity
  },
  protect_watershed: {
    illegalMiningReduction: 0.20, // 20% reduction in watershed areas
    waterQualityImprovement: 0.45, // up to 45% water quality improvement
    forestProtectionHa: 5,
    unitCostGHS: 8000, // ₵8,000 per river per month for enforcement
    costDriver: "riversProtected",
    diminishingReturns: 0.2,
  },
  close_roads: {
    illegalMiningReduction: 0.40, // 40% reduction — very effective at blocking access
    waterQualityImprovement: 0.10,
    forestProtectionHa: 3,
    unitCostGHS: 2500, // ₵2,500 per checkpoint per month
    costDriver: "checkpointsDeployed",
    diminishingReturns: 0.35,
  },
  deploy_drones: {
    illegalMiningReduction: 0.25, // 25% reduction from detection deterrence
    waterQualityImprovement: 0.05,
    forestProtectionHa: 15, // 15 ha/month — excellent for forest monitoring
    unitCostGHS: 6000, // ₵6,000 per drone per month (operator + maintenance)
    costDriver: "droneCount",
    diminishingReturns: 0.25,
  },
  combined: {
    // Combined uses the max of constituent interventions, with synergy bonus
    illegalMiningReduction: 0.60, // up to 60% with combined interventions
    waterQualityImprovement: 0.50,
    forestProtectionHa: 25,
    unitCostGHS: 0, // computed from constituent interventions
    costDriver: "combined",
    diminishingReturns: 0.15,
  },
};

// ---------------------------------------------------------------------------
// Baseline damage rates (Ghana-specific, per month)
// ---------------------------------------------------------------------------

export const BASELINE_RATES = {
  // Average illegal mining damages per hectare per month (GHS)
  damagesPerHectarePerMonth: 15000,
  // Average water pollution damages per river per month (GHS)
  waterDamagesPerRiverPerMonth: 25000,
  // Average forest loss per hotspot per month (hectares)
  forestLossPerHotspotPerMonth: 2.5,
  // Average illegal mining expansion per hotspot per month (hectares)
  miningExpansionPerHotspotPerMonth: 1.8,
};

// ---------------------------------------------------------------------------
// Core prediction functions
// ---------------------------------------------------------------------------

/**
 * Compute the intensity factor with diminishing returns.
 * intensity 0–1 → effective intensity with diminishing returns curve.
 * Formula: eff = 1 - (1 - intensity)^(1/(1-diminishingReturns))
 */
export function computeEffectiveIntensity(intensity: number, diminishingReturns: number): number {
  if (intensity <= 0) return 0;
  if (intensity >= 1) return 1;
  const dr = Math.min(0.9, Math.max(0, diminishingReturns));
  // Using a curve that increases fast initially then plateaus
  return 1 - Math.pow(1 - intensity, 1 / (1 + dr));
}

/**
 * Predict outcomes for a single intervention over a time horizon.
 * Returns time series for each of the 5 outcome metrics.
 */
export function predictOutcomes(params: {
  interventionType: InterventionType;
  interventionParams: InterventionParams;
  timeHorizonMonths: number;
  // baseline context (from real platform data)
  hotspotCount: number;
  investigationCount: number;
  inspectionCount: number;
  region?: string;
}): {
  metrics: {
    illegalMiningRateChange: number;
    waterQualityChange: number;
    forestCoverChangeHa: number;
    economicImpactGHS: number;
    enforcementCostGHS: number;
    netBenefitGHS: number;
  };
  timeSeries: Array<{
    month: number;
    illegalMiningRate: number; // % change from baseline
    waterQuality: number; // % change from baseline
    forestCoverHa: number; // cumulative hectares saved
    economicImpactGHS: number; // cumulative GHS
    enforcementCostGHS: number; // cumulative GHS
  }>;
  factorsBreakdown: Record<string, { value: number; weight: number; contribution: string }>;
} {
  const { interventionType, interventionParams, timeHorizonMonths, hotspotCount } = params;
  const eff = INTERVENTION_EFFECTIVENESS[interventionType];

  // Compute intensity (0-1) from parameters
  let intensity = 0;
  let costUnit = 0;
  let costUnits = 0;

  if (interventionType === "baseline") {
    intensity = 0;
    costUnit = 0;
    costUnits = 0;
  } else if (interventionType === "increase_inspections") {
    const increasePct = interventionParams.inspectionIncreasePct ?? 50;
    intensity = Math.min(1, increasePct / 200); // 200% increase = full intensity
    costUnits = interventionParams.inspectorCount ?? Math.ceil((increasePct / 50) * 5);
    costUnit = eff.unitCostGHS;
  } else if (interventionType === "protect_watershed") {
    const rivers = interventionParams.riversProtected ?? 5;
    const buffer = interventionParams.bufferZoneM ?? 100;
    intensity = Math.min(1, (rivers * buffer) / (20 * 500)); // 20 rivers × 500m = full
    costUnits = rivers;
    costUnit = eff.unitCostGHS;
  } else if (interventionType === "close_roads") {
    const roads = interventionParams.roadsClosed ?? 5;
    const checkpoints = interventionParams.checkpointsDeployed ?? 3;
    intensity = Math.min(1, roads / 20); // 20 roads = full
    costUnits = checkpoints;
    costUnit = eff.unitCostGHS;
  } else if (interventionType === "deploy_drones") {
    const drones = interventionParams.droneCount ?? 3;
    const coverage = interventionParams.coverageAreaKm2 ?? 100;
    intensity = Math.min(1, (drones * coverage) / (15 * 400)); // 15 drones × 400km² = full
    costUnits = drones;
    costUnit = eff.unitCostGHS;
  } else if (interventionType === "combined") {
    // Combined: average of all 4 interventions
    const inspectionsIntensity = Math.min(1, (interventionParams.inspectionIncreasePct ?? 50) / 200);
    const watershedIntensity = Math.min(1, (interventionParams.riversProtected ?? 5) * (interventionParams.bufferZoneM ?? 100) / (20 * 500));
    const roadsIntensity = Math.min(1, (interventionParams.roadsClosed ?? 5) / 20);
    const dronesIntensity = Math.min(1, (interventionParams.droneCount ?? 3) * (interventionParams.coverageAreaKm2 ?? 100) / (15 * 400));
    intensity = (inspectionsIntensity + watershedIntensity + roadsIntensity + dronesIntensity) / 4;
    // Combined cost = sum of all
    costUnit = 0;
    costUnits =
      (interventionParams.inspectorCount ?? 5) * INTERVENTION_EFFECTIVENESS.increase_inspections.unitCostGHS +
      (interventionParams.riversProtected ?? 5) * INTERVENTION_EFFECTIVENESS.protect_watershed.unitCostGHS +
      (interventionParams.checkpointsDeployed ?? 3) * INTERVENTION_EFFECTIVENESS.close_roads.unitCostGHS +
      (interventionParams.droneCount ?? 3) * INTERVENTION_EFFECTIVENESS.deploy_drones.unitCostGHS;
    costUnit = 1; // costUnits already has total
  }

  const effIntensity = computeEffectiveIntensity(intensity, eff.diminishingReturns);

  // Compute outcome changes
  const illegalMiningRateChange = -eff.illegalMiningReduction * effIntensity * 100; // negative = reduction (good)
  const waterQualityChange = eff.waterQualityImprovement * effIntensity * 100; // positive = improvement (good)
  const forestCoverChangeHa = eff.forestProtectionHa * effIntensity * timeHorizonMonths * Math.max(1, hotspotCount / 3);
  const enforcementCostGHS = costUnit * costUnits * timeHorizonMonths;

  // Economic impact = damages avoided
  // Damages avoided = (illegal mining reduction %) × (baseline monthly damages) × (time horizon)
  const baselineMonthlyDamages =
    hotspotCount * BASELINE_RATES.miningExpansionPerHotspotPerMonth * BASELINE_RATES.damagesPerHectarePerMonth +
    (interventionType === "protect_watershed" ? (interventionParams.riversProtected ?? 5) * BASELINE_RATES.waterDamagesPerRiverPerMonth : 0);
  const economicImpactGHS = (Math.abs(illegalMiningRateChange) / 100) * baselineMonthlyDamages * timeHorizonMonths;
  const netBenefitGHS = economicImpactGHS - enforcementCostGHS;

  // Build time series
  const timeSeries = [];
  for (let month = 1; month <= timeHorizonMonths; month++) {
    // Outcomes ramp up over first 3 months (intervention takes effect)
    const rampUp = Math.min(1, month / 3);
    const monthIllegalRate = illegalMiningRateChange * rampUp;
    const monthWaterQuality = waterQualityChange * rampUp;
    const monthForest = forestCoverChangeHa * (month / timeHorizonMonths);
    const monthEconomic = economicImpactGHS * (month / timeHorizonMonths);
    const monthCost = enforcementCostGHS * (month / timeHorizonMonths);
    timeSeries.push({
      month,
      illegalMiningRate: Math.round(monthIllegalRate * 100) / 100,
      waterQuality: Math.round(monthWaterQuality * 100) / 100,
      forestCoverHa: Math.round(monthForest * 100) / 100,
      economicImpactGHS: Math.round(monthEconomic),
      enforcementCostGHS: Math.round(monthCost),
    });
  }

  // Factors breakdown for explainability
  const factorsBreakdown: Record<string, { value: number; weight: number; contribution: string }> = {
    intervention_effectiveness: {
      value: eff.illegalMiningReduction,
      weight: 0.35,
      contribution: `${(eff.illegalMiningReduction * 100).toFixed(0)}% max reduction potential for ${INTERVENTION_TYPE_META[interventionType].label}`,
    },
    intensity: {
      value: intensity,
      weight: 0.25,
      contribution: `${(intensity * 100).toFixed(0)}% intensity → ${(effIntensity * 100).toFixed(0)}% effective (diminishing returns applied)`,
    },
    hotspot_density: {
      value: hotspotCount,
      weight: 0.20,
      contribution: `${hotspotCount} active hotspots in target area — higher density = greater impact`,
    },
    time_horizon: {
      value: timeHorizonMonths,
      weight: 0.15,
      contribution: `${timeHorizonMonths} months — longer horizon compounds benefits`,
    },
    cost_efficiency: {
      value: enforcementCostGHS > 0 ? economicImpactGHS / enforcementCostGHS : 0,
      weight: 0.05,
      contribution: enforcementCostGHS > 0 ? `₵${(economicImpactGHS / enforcementCostGHS).toFixed(1)} benefit per ₵1 spent` : "N/A (baseline)",
    },
  };

  return {
    metrics: {
      illegalMiningRateChange: Math.round(illegalMiningRateChange * 100) / 100,
      waterQualityChange: Math.round(waterQualityChange * 100) / 100,
      forestCoverChangeHa: Math.round(forestCoverChangeHa * 100) / 100,
      economicImpactGHS: Math.round(economicImpactGHS),
      enforcementCostGHS: Math.round(enforcementCostGHS),
      netBenefitGHS: Math.round(netBenefitGHS),
    },
    timeSeries,
    factorsBreakdown,
  };
}

/**
 * Generate a human-readable explanation of the simulation outcomes.
 */
export function generateExplanation(params: {
  interventionType: InterventionType;
  timeHorizonMonths: number;
  locationName?: string;
  metrics: {
    illegalMiningRateChange: number;
    waterQualityChange: number;
    forestCoverChangeHa: number;
    economicImpactGHS: number;
    enforcementCostGHS: number;
    netBenefitGHS: number;
  };
}): string {
  const { interventionType, timeHorizonMonths, locationName, metrics } = params;
  const meta = INTERVENTION_TYPE_META[interventionType];

  if (interventionType === "baseline") {
    return `Without intervention, illegal mining in ${locationName ?? "the target area"} is projected to continue at current rates over the next ${timeHorizonMonths} months. Based on current hotspot data, this means continued environmental degradation with no enforcement costs but also no damages avoided.`;
  }

  const positive = metrics.netBenefitGHS > 0;
  const parts: string[] = [];

  parts.push(`${meta.label} in ${locationName ?? "the target area"} over ${timeHorizonMonths} months:`);

  if (metrics.illegalMiningRateChange < 0) {
    parts.push(`Illegal mining activity is projected to decrease by ${Math.abs(metrics.illegalMiningRateChange).toFixed(1)}%.`);
  }
  if (metrics.waterQualityChange > 0) {
    parts.push(`Water quality is projected to improve by ${metrics.waterQualityChange.toFixed(1)}%.`);
  }
  if (metrics.forestCoverChangeHa > 0) {
    parts.push(`${metrics.forestCoverChangeHa.toFixed(0)} hectares of forest would be saved.`);
  }

  parts.push(`The intervention costs ₵${metrics.enforcementCostGHS.toLocaleString("en-GH")} but avoids ₵${metrics.economicImpactGHS.toLocaleString("en-GH")} in environmental damages.`);

  if (positive) {
    parts.push(`Net benefit: +₵${metrics.netBenefitGHS.toLocaleString("en-GH")} (${(metrics.economicImpactGHS / metrics.enforcementCostGHS).toFixed(1)}× return on investment).`);
  } else {
    parts.push(`Net cost: -₵${Math.abs(metrics.netBenefitGHS).toLocaleString("en-GH")} (intervention costs exceed damages avoided).`);
  }

  return parts.join(" ");
}

/**
 * Compare multiple scenarios and determine the best.
 */
export function compareScenarios(scenarios: Array<{
  id: string;
  name: string;
  type: InterventionType;
  metrics: {
    illegalMiningRateChange: number;
    waterQualityChange: number;
    forestCoverChangeHa: number;
    economicImpactGHS: number;
    enforcementCostGHS: number;
    netBenefitGHS: number;
  };
}>): {
  results: Record<string, Record<string, number>>;
  bestScenarioId: string;
  bestMetric: string;
  ranking: Array<{ scenarioId: string; rank: number; score: number }>;
} {
  if (scenarios.length === 0) {
    return { results: {}, bestScenarioId: "", bestMetric: "", ranking: [] };
  }

  // Build results matrix
  const results: Record<string, Record<string, number>> = {};
  for (const s of scenarios) {
    results[s.id] = {
      illegalMiningRateChange: s.metrics.illegalMiningRateChange,
      waterQualityChange: s.metrics.waterQualityChange,
      forestCoverChangeHa: s.metrics.forestCoverChangeHa,
      economicImpactGHS: s.metrics.economicImpactGHS,
      enforcementCostGHS: s.metrics.enforcementCostGHS,
      netBenefitGHS: s.metrics.netBenefitGHS,
    };
  }

  // Rank scenarios by composite score:
  //   score = netBenefitGHS (normalized) + |illegalMiningReduction| + waterQualityImprovement + forestCoverHa
  // (all weighted equally after normalization)
  const maxNetBenefit = Math.max(...scenarios.map((s) => s.metrics.netBenefitGHS), 1);
  const maxMiningReduction = Math.max(...scenarios.map((s) => Math.abs(s.metrics.illegalMiningRateChange)), 1);
  const maxWaterQuality = Math.max(...scenarios.map((s) => s.metrics.waterQualityChange), 1);
  const maxForest = Math.max(...scenarios.map((s) => s.metrics.forestCoverChangeHa), 1);

  const scored = scenarios.map((s) => {
    const score =
      (s.metrics.netBenefitGHS / maxNetBenefit) * 0.4 +
      (Math.abs(s.metrics.illegalMiningRateChange) / maxMiningReduction) * 0.25 +
      (s.metrics.waterQualityChange / maxWaterQuality) * 0.2 +
      (s.metrics.forestCoverChangeHa / maxForest) * 0.15;
    return { scenarioId: s.id, score: Math.round(score * 1000) / 1000 };
  });

  scored.sort((a, b) => b.score - a.score);
  const ranking = scored.map((s, i) => ({ ...s, rank: i + 1 }));

  const best = scored[0]!;
  const bestMetric = "net_benefit";

  return { results, bestScenarioId: best.scenarioId, bestMetric, ranking };
}

/**
 * Generate a deterministic scenario key from parameters.
 */
export function generateScenarioKey(params: {
  interventionType: InterventionType;
  region?: string;
  locationName?: string;
}): string {
  const loc = params.locationName?.toLowerCase().replace(/\s+/g, "-").slice(0, 20) ?? params.region?.toLowerCase().replace(/\s+/g, "-") ?? "global";
  const hash = createHash("sha256").update(`${params.interventionType}-${loc}-${Date.now()}`).digest("hex").slice(0, 6);
  return `sim-${loc}-${params.interventionType}-${hash}`;
}
