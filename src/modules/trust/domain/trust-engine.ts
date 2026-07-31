/**
 * Sentinel — Civil Trust Engine Domain
 * =============================================================================
 * Production trust system replacing simple reputation. Computes a composite
 * trust score from 8 factors, applies time-based decay, and resists fraud.
 *
 * The 8 factors:
 *   1. Accuracy          — verified reports / total reports (weight: 0.20)
 *   2. Reliability       — consistency over time (weight: 0.15)
 *   3. False reports     — penalty for false-positive submissions (weight: 0.15)
 *   4. Evidence quality  — aggregate from M9 evidence weights (weight: 0.15)
 *   5. Contribution quality — corroboration support rate (weight: 0.10)
 *   6. Community impact  — positive impact (resolutions, helpful shares) (weight: 0.10)
 *   7. Decay             — trust decays if inactive (half-life 90 days) (weight: multiplier)
 *   8. Fraud resistance  — fraud flags reduce trust; clean history boosts (weight: multiplier)
 *
 * The composite score is a weighted sum of factors 1-6, multiplied by decay
 * (factor 7) and fraud resistance (factor 8). This means inactivity and fraud
 * don't just add/subtract — they scale the entire score down.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Factor weights
// ---------------------------------------------------------------------------

export const FACTOR_WEIGHTS = {
  accuracy: 0.20,
  reliability: 0.15,
  falseReports: 0.15, // penalty (inverted)
  evidenceQuality: 0.15,
  contributionQuality: 0.10,
  communityImpact: 0.10,
  // decay and fraudResistance are multipliers, not additive
  decayMultiplier: 1.0, // applied as multiplier
  fraudMultiplier: 1.0, // applied as multiplier
} as const;

// ---------------------------------------------------------------------------
// Tier system
// ---------------------------------------------------------------------------

export type TrustTier = "unverified" | "basic" | "verified" | "trusted" | "elite";

export const TIER_META: Record<TrustTier, { label: string; color: string; minScore: number }> = {
  unverified: { label: "Unverified", color: "#6b7280", minScore: 0.0 },
  basic: { label: "Basic", color: "#f59e0b", minScore: 0.3 },
  verified: { label: "Verified", color: "#0ea5e9", minScore: 0.5 },
  trusted: { label: "Trusted", color: "#22c55e", minScore: 0.7 },
  elite: { label: "Elite", color: "#10b981", minScore: 0.85 },
};

export function tierForScore(score: number): TrustTier {
  if (score >= 0.85) return "elite";
  if (score >= 0.7) return "trusted";
  if (score >= 0.5) return "verified";
  if (score >= 0.3) return "basic";
  return "unverified";
}

// ---------------------------------------------------------------------------
// Factor computation
// ---------------------------------------------------------------------------

export interface TrustFactors {
  accuracy: number;           // 0.0-1.0
  reliability: number;        // 0.0-1.0
  falseReportRate: number;    // 0.0-1.0 (higher = worse)
  falseReportCount: number;
  evidenceQuality: number;    // 0.0-1.0
  contributionQuality: number; // 0.0-1.0
  communityImpact: number;    // 0.0-1.0
  fraudResistance: number;    // 0.0-1.0
  fraudFlagCount: number;
  decayRate: number;          // 0.0-1.0 (current decay multiplier, 0 = no decay)
  // Activity metrics
  totalReports: number;
  verifiedReports: number;
  totalEvidence: number;
  totalComments: number;
  totalShares: number;
  lastActivityAt: Date | null;
}

export interface TrustResult {
  compositeScore: number; // 0.0-1.0
  tier: TrustTier;
  factors: {
    accuracy: number;
    reliability: number;
    falseReportPenalty: number; // inverted (1.0 - falseReportRate)
    evidenceQuality: number;
    contributionQuality: number;
    communityImpact: number;
    decayMultiplier: number;
    fraudMultiplier: number;
  };
  weightedBreakdown: Record<string, number>; // each factor's weighted contribution
}

/**
 * Compute the composite trust score from all 8 factors.
 *
 * Formula:
 *   baseScore = (accuracy * 0.20) + (reliability * 0.15) + ((1 - falseReportRate) * 0.15)
 *             + (evidenceQuality * 0.15) + (contributionQuality * 0.10) + (communityImpact * 0.10)
 *   decayMultiplier = 1.0 - decayRate (e.g., 0.05 decay → 0.95 multiplier)
 *   fraudMultiplier = fraudResistance (1.0 = clean, 0.0 = fully flagged)
 *   compositeScore = baseScore * decayMultiplier * fraudMultiplier
 */
export function computeTrust(f: TrustFactors): TrustResult {
  // Factor 1: Accuracy — verified reports / total reports
  const accuracy = f.totalReports > 0 ? f.verifiedReports / f.totalReports : 0.5;

  // Factor 2: Reliability — consistency (report frequency + verification rate)
  // Computed externally and passed in as f.reliability
  const reliability = f.reliability;

  // Factor 3: False reports — penalty (inverted: 1.0 - falseReportRate)
  const falseReportPenalty = 1.0 - Math.min(f.falseReportRate, 1.0);

  // Factor 4: Evidence quality — from M9 aggregate
  const evidenceQuality = f.evidenceQuality;

  // Factor 5: Contribution quality — corroboration support rate
  const contributionQuality = f.contributionQuality;

  // Factor 6: Community impact
  const communityImpact = f.communityImpact;

  // Factor 7: Decay multiplier
  const decayMultiplier = 1.0 - f.decayRate;

  // Factor 8: Fraud multiplier
  const fraudMultiplier = f.fraudResistance;

  // Weighted base score
  const weightedBreakdown = {
    accuracy: accuracy * FACTOR_WEIGHTS.accuracy,
    reliability: reliability * FACTOR_WEIGHTS.reliability,
    falseReportPenalty: falseReportPenalty * FACTOR_WEIGHTS.falseReports,
    evidenceQuality: evidenceQuality * FACTOR_WEIGHTS.evidenceQuality,
    contributionQuality: contributionQuality * FACTOR_WEIGHTS.contributionQuality,
    communityImpact: communityImpact * FACTOR_WEIGHTS.communityImpact,
  };

  const baseScore = Object.values(weightedBreakdown).reduce((a, b) => a + b, 0);

  // Apply decay and fraud as multipliers (they scale the entire score)
  const compositeScore = Math.max(0, Math.min(1, baseScore * decayMultiplier * fraudMultiplier));

  return {
    compositeScore,
    tier: tierForScore(compositeScore),
    factors: {
      accuracy,
      reliability,
      falseReportPenalty,
      evidenceQuality,
      contributionQuality,
      communityImpact,
      decayMultiplier,
      fraudMultiplier,
    },
    weightedBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Decay algorithm
// =============================================================================
// Trust decays with inactivity. The half-life is 90 days — after 90 days of
// inactivity, trust drops to 50% of its pre-decay value. After 180 days, 25%.
// After 365 days, trust is effectively zero.
//
// decayRate = 1 - 0.5^(daysInactive / 90)
//   0 days  → decayRate = 0.0 (no decay)
//   30 days → decayRate = 0.21 (21% reduction)
//   90 days → decayRate = 0.50 (50% reduction, half-life)
//   180 days → decayRate = 0.75 (75% reduction)
//   365 days → decayRate = 0.94 (94% reduction)
// =============================================================================

export const DECAY_HALF_LIFE_DAYS = 90;

export function computeDecayRate(lastActivityAt: Date | null, now: Date = new Date()): number {
  if (!lastActivityAt) return 0.0;
  const daysInactive = Math.floor((now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24));
  if (daysInactive <= 0) return 0.0;
  return 1.0 - Math.pow(0.5, daysInactive / DECAY_HALF_LIFE_DAYS);
}

export function computeDecayAmount(currentScore: number, decayRate: number): number {
  return currentScore * decayRate;
}

// ---------------------------------------------------------------------------
// Fraud detection heuristics
// =============================================================================
// Fraud flags are detected via heuristics:
//   1. Duplicate spam — same user submits many near-identical reports
//   2. False reports — high false-positive rate (>40%)
//   3. Coordinated manipulation — multiple users from same org/device corroborate each other
//   4. Bot behavior — inhuman activity patterns (too fast, too regular)
//   5. Identity theft — account details don't match verification
// =============================================================================

export type FraudType =
  | "duplicate_spam"
  | "false_report"
  | "coordinated_manipulation"
  | "bot_behavior"
  | "identity_theft"
  | "other";

export type FraudSeverity = "low" | "medium" | "high" | "critical";

export const FRAUD_SEVERITY_PENALTY: Record<FraudSeverity, number> = {
  low: 0.05,
  medium: 0.15,
  high: 0.30,
  critical: 0.60,
};

/**
 * Compute fraud resistance from fraud flags.
 * Each flag reduces fraud resistance by its severity penalty.
 * fraudResistance = max(0, 1.0 - sum(penalties))
 */
export function computeFraudResistance(flags: Array<{ severity: FraudSeverity; status: string }>): {
  fraudResistance: number;
  fraudFlagCount: number;
} {
  const activeFlags = flags.filter((f) => f.status === "detected" || f.status === "confirmed" || f.status === "investigating");
  let totalPenalty = 0;
  for (const flag of activeFlags) {
    totalPenalty += FRAUD_SEVERITY_PENALTY[flag.severity];
  }
  return {
    fraudResistance: Math.max(0, 1.0 - totalPenalty),
    fraudFlagCount: activeFlags.length,
  };
}

/**
 * Detect potential fraud from user activity patterns.
 * Returns suggested fraud flags (not yet created — the service creates them).
 */
export function detectFraudPatterns(params: {
  falseReportRate: number;
  totalReports: number;
  duplicateCount: number;
  corroborationFromSameOrg: number;
  activityRegularityScore: number; // 0.0-1.0, higher = more regular (bot-like)
}): Array<{ type: FraudType; severity: FraudSeverity; description: string }> {
  const flags: Array<{ type: FraudType; severity: FraudSeverity; description: string }> = [];

  // High false report rate
  if (params.totalReports >= 5 && params.falseReportRate > 0.4) {
    flags.push({
      type: "false_report",
      severity: params.falseReportRate > 0.6 ? "high" : "medium",
      description: `False report rate ${(params.falseReportRate * 100).toFixed(0)}% exceeds 40% threshold (${params.totalReports} reports)`,
    });
  }

  // Duplicate spam
  if (params.duplicateCount >= 3) {
    flags.push({
      type: "duplicate_spam",
      severity: params.duplicateCount >= 5 ? "high" : "medium",
      description: `${params.duplicateCount} duplicate submissions detected`,
    });
  }

  // Coordinated manipulation
  if (params.corroborationFromSameOrg >= 3) {
    flags.push({
      type: "coordinated_manipulation",
      severity: "medium",
      description: `${params.corroborationFromSameOrg} corroborations from same organization (possible collusion)`,
    });
  }

  // Bot behavior
  if (params.activityRegularityScore > 0.8 && params.totalReports > 10) {
    flags.push({
      type: "bot_behavior",
      severity: "high",
      description: `Activity regularity score ${(params.activityRegularityScore * 100).toFixed(0)}% suggests automated behavior`,
    });
  }

  return flags;
}
