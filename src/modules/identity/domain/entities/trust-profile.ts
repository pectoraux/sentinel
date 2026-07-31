/**
 * Sentinel — Identity Domain: TrustProfile
 * =============================================================================
 * A user's trust score (0-100) and tier. Computed from contributing factors:
 *   - Number of approved verifications
 *   - Reports submitted / verified (future milestone)
 *   - Organization memberships
 *   - Account age
 *   - Penalties / disputes
 *
 * Trust is recalculated by the TrustProfileService whenever a TrustEvent is
 * recorded (verification approved, report verified, etc.).
 * =============================================================================
 */

import { ValueObject } from "@/core/shared";

export type TrustTier =
  | "unverified"
  | "basic"
  | "verified"
  | "trusted"
  | "elite";

export interface TrustFactors {
  verifications: number;
  reportsSubmitted: number;
  reportsVerified: number;
  orgMemberships: number;
  accountAgeDays: number;
  penalties: number;
  disputes: number;
}

export const EMPTY_FACTORS: TrustFactors = {
  verifications: 0,
  reportsSubmitted: 0,
  reportsVerified: 0,
  orgMemberships: 0,
  accountAgeDays: 0,
  penalties: 0,
  disputes: 0,
};

/**
 * Tier boundaries (inclusive lower bound):
 *   0-19   → unverified
 *   20-39  → basic
 *   40-59  → verified
 *   60-79  → trusted
 *   80-100 → elite
 */
export function tierForScore(score: number): TrustTier {
  if (score >= 80) return "elite";
  if (score >= 60) return "trusted";
  if (score >= 40) return "verified";
  if (score >= 20) return "basic";
  return "unverified";
}

/**
 * Compute the trust score from factors.
 * Weighted formula:
 *   verifications: +15 each (max 60)
 *   orgMemberships: +10 each (max 30)
 *   reportsVerified: +3 each (max 30)
 *   reportsSubmitted: +1 each (max 10)
 *   accountAgeDays: +1 per 30 days (max 20)
 *   penalties: -15 each (no floor above 0)
 *   disputes: -5 each
 * Final score clamped to [0, 100].
 */
export function computeScore(factors: TrustFactors): number {
  let score = 0;
  score += Math.min(factors.verifications * 15, 60);
  score += Math.min(factors.orgMemberships * 10, 30);
  score += Math.min(factors.reportsVerified * 3, 30);
  score += Math.min(factors.reportsSubmitted * 1, 10);
  score += Math.min(Math.floor(factors.accountAgeDays / 30) * 1, 20);
  score -= factors.penalties * 15;
  score -= factors.disputes * 5;
  return Math.max(0, Math.min(100, score));
}

/**
 * Badges earned based on factors + tier.
 */
export function computeBadges(factors: TrustFactors, tier: TrustTier): string[] {
  const badges: string[] = [];
  if (factors.verifications >= 1) badges.push("id_verified");
  if (factors.verifications >= 3) badges.push("thoroughly_verified");
  if (factors.orgMemberships >= 1) badges.push("org_member");
  if (factors.reportsVerified >= 10) badges.push("top_reporter");
  if (factors.reportsSubmitted >= 50) badges.push("prolific_reporter");
  if (tier === "elite") badges.push("elite_member");
  if (factors.accountAgeDays >= 365) badges.push("early_adopter");
  return badges;
}

export class TrustProfile extends ValueObject<{
  userId: string;
  score: number;
  tier: TrustTier;
  factors: TrustFactors;
  badges: string[];
}> {
  get userId(): string {
    return this.props.userId;
  }
  get score(): number {
    return this.props.score;
  }
  get tier(): TrustTier {
    return this.props.tier;
  }
  get factors(): TrustFactors {
    return this.props.factors;
  }
  get badges(): string[] {
    return this.props.badges;
  }

  static fromFactors(userId: string, factors: TrustFactors): TrustProfile {
    const score = computeScore(factors);
    const tier = tierForScore(score);
    const badges = computeBadges(factors, tier);
    return new TrustProfile({ userId, score, tier, factors, badges });
  }
}
