/**
 * Sentinel — Evidence Fusion Domain
 * =============================================================================
 * Multi-source evidence fusion: merges AI detections, citizen reports,
 * satellite imagery, drone surveys, sensor logs, and government inspections
 * into one fused confidence score using weighted Bayesian fusion.
 * =============================================================================
 */

export type SourceType =
  | "ai_detection"
  | "citizen_report"
  | "satellite_imagery"
  | "drone_survey"
  | "sensor_log"
  | "government_inspection"
  | "corroboration";

export const SOURCE_META: Record<SourceType, { label: string; icon: string; color: string; baseWeight: number; reliability: number }> = {
  ai_detection: { label: "AI Detection", icon: "Brain", color: "#ef4444", baseWeight: 0.25, reliability: 0.85 },
  citizen_report: { label: "Citizen Report", icon: "Users", color: "#a78bfa", baseWeight: 0.15, reliability: 0.60 },
  satellite_imagery: { label: "Satellite Imagery", icon: "Satellite", color: "#0ea5e9", baseWeight: 0.20, reliability: 0.90 },
  drone_survey: { label: "Drone Survey", icon: "Plane", color: "#14b8a6", baseWeight: 0.15, reliability: 0.85 },
  sensor_log: { label: "Sensor Log", icon: "Cpu", color: "#f59e0b", baseWeight: 0.10, reliability: 0.95 },
  government_inspection: { label: "Gov Inspection", icon: "ShieldCheck", color: "#22c55e", baseWeight: 0.10, reliability: 0.98 },
  corroboration: { label: "Corroboration", icon: "ThumbsUp", color: "#8b5cf6", baseWeight: 0.05, reliability: 0.75 },
};

export type ConsensusLevel = "unanimous" | "strong" | "moderate" | "weak" | "divided";

export const CONSENSUS_META: Record<ConsensusLevel, { label: string; color: string; minAgreement: number }> = {
  unanimous: { label: "Unanimous", color: "#22c55e", minAgreement: 0.95 },
  strong: { label: "Strong", color: "#0ea5e9", minAgreement: 0.80 },
  moderate: { label: "Moderate", color: "#f59e0b", minAgreement: 0.65 },
  weak: { label: "Weak", color: "#f97316", minAgreement: 0.50 },
  divided: { label: "Divided", color: "#ef4444", minAgreement: 0.0 },
};

export interface SourceInput {
  sourceType: SourceType;
  sourceId?: string;
  rawConfidence: number; // 0.0-1.0
  description?: string;
  sourceTimestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface FusionOutput {
  fusedConfidence: number;
  fusedSeverity: string;
  sourceCount: number;
  sourceBreakdown: Record<string, number>;
  hasConflict: boolean;
  conflictDetails: { spread: number; description: string; disagreeingSources: string[] } | null;
  consensusLevel: ConsensusLevel;
  weightedScores: Array<{ sourceType: string; rawConfidence: number; weight: number; weightedScore: number }>;
}

/**
 * Weighted Bayesian fusion algorithm.
 *
 * fusedConfidence = Σ(sourceConfidence_i × weight_i × reliability_i) / Σ(weight_i × reliability_i)
 *
 * Weights are normalized so they sum to 1.0 before applying reliability.
 * This gives higher-reliability sources more influence on the final score.
 */
export function fuse(sources: SourceInput[]): FusionOutput {
  if (sources.length === 0) {
    return {
      fusedConfidence: 0,
      fusedSeverity: "low",
      sourceCount: 0,
      sourceBreakdown: {},
      hasConflict: false,
      conflictDetails: null,
      consensusLevel: "divided",
      weightedScores: [],
    };
  }

  // Group by source type for breakdown
  const sourceBreakdown: Record<string, number> = {};
  for (const s of sources) {
    sourceBreakdown[s.sourceType] = (sourceBreakdown[s.sourceType] ?? 0) + 1;
  }

  // Compute weighted scores
  let totalWeight = 0;
  let weightedSum = 0;
  const weightedScores: FusionOutput["weightedScores"] = [];

  for (const source of sources) {
    const meta = SOURCE_META[source.sourceType];
    const effectiveWeight = meta.baseWeight * meta.reliability;
    const weightedScore = source.rawConfidence * effectiveWeight;

    weightedSum += weightedScore;
    totalWeight += effectiveWeight;

    weightedScores.push({
      sourceType: source.sourceType,
      rawConfidence: source.rawConfidence,
      weight: meta.baseWeight,
      weightedScore,
    });
  }

  const fusedConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Conflict detection: if sources disagree significantly
  const confidences = sources.map((s) => s.rawConfidence);
  const maxConf = Math.max(...confidences);
  const minConf = Math.min(...confidences);
  const spread = maxConf - minConf;
  const hasConflict = spread > 0.4 && sources.length >= 2;

  let conflictDetails: FusionOutput["conflictDetails"] = null;
  if (hasConflict) {
    const disagreeingSources = sources
      .filter((s) => Math.abs(s.rawConfidence - fusedConfidence) > 0.3)
      .map((s) => s.sourceType);
    conflictDetails = {
      spread: Math.round(spread * 100) / 100,
      description: `Sources disagree by ${Math.round(spread * 100)}% — high-confidence sources conflict with low-confidence ones`,
      disagreeingSources: Array.from(new Set(disagreeingSources)),
    };
  }

  // Consensus level
  const agreementRatio = sources.length > 0
    ? sources.filter((s) => Math.abs(s.rawConfidence - fusedConfidence) < 0.2).length / sources.length
    : 0;
  let consensusLevel: ConsensusLevel = "divided";
  for (const [level, meta] of Object.entries(CONSENSUS_META)) {
    if (agreementRatio >= meta.minAgreement) {
      consensusLevel = level as ConsensusLevel;
      break;
    }
  }

  // Severity from fused confidence
  const fusedSeverity = fusedConfidence >= 0.85 ? "critical" :
    fusedConfidence >= 0.70 ? "high" :
    fusedConfidence >= 0.50 ? "medium" :
    fusedConfidence >= 0.30 ? "low" : "low";

  return {
    fusedConfidence: Math.round(fusedConfidence * 1000) / 1000,
    fusedSeverity,
    sourceCount: sources.length,
    sourceBreakdown,
    hasConflict,
    conflictDetails,
    consensusLevel,
    weightedScores,
  };
}
