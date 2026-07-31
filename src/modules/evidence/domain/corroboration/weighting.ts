/**
 * Sentinel — Evidence Corroboration Domain
 * =============================================================================
 * Confidence calculation, evidence weighting, and duplicate detection logic.
 *
 * Instead of simple up/down votes, evidence is assessed through:
 *   - Support (corroboration by another user/source)
 *   - Dispute (challenge by another user/source)
 *   - Independent corroboration (multiple independent sources confirm)
 *   - Witness confidence (weighted by trust tier + corroboration count)
 *   - Evidence weighting (reliability score from all factors)
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Weight tiers
// ---------------------------------------------------------------------------

export type WeightTier = "unverified" | "weak" | "moderate" | "strong" | "confirmed";

export const TIER_META: Record<WeightTier, { label: string; color: string; minWeight: number }> = {
  unverified: { label: "Unverified", color: "#6b7280", minWeight: 0.0 },
  weak: { label: "Weak", color: "#f59e0b", minWeight: 0.3 },
  moderate: { label: "Moderate", color: "#0ea5e9", minWeight: 0.5 },
  strong: { label: "Strong", color: "#22c55e", minWeight: 0.7 },
  confirmed: { label: "Confirmed", color: "#10b981", minWeight: 0.85 },
};

export function tierForWeight(weight: number): WeightTier {
  if (weight >= 0.85) return "confirmed";
  if (weight >= 0.7) return "strong";
  if (weight >= 0.5) return "moderate";
  if (weight >= 0.3) return "weak";
  return "unverified";
}

// ---------------------------------------------------------------------------
// Weight factors
// ---------------------------------------------------------------------------

export interface WeightFactors {
  /** Base trust from the submitter's trust tier (0.0–1.0) */
  baseTrust: number;
  /** +0.05 per support, max +0.3 */
  supportBonus: number;
  /** -0.08 per dispute, max -0.4 */
  disputePenalty: number;
  /** +0.1 per independent corroboration, max +0.3 */
  independentBonus: number;
  /** -0.15 if duplicate detected */
  duplicatePenalty: number;
  /** +0.15 if verified by a reviewer */
  verificationBonus: number;
}

export interface WeightResult {
  weight: number;
  confidence: number;
  tier: WeightTier;
  factors: WeightFactors;
}

/**
 * Compute the evidence weight from all factors.
 *
 * Formula:
 *   weight = clamp(baseTrust + supportBonus - disputePenalty + independentBonus - duplicatePenalty + verificationBonus, 0, 1)
 *   confidence = clamp(baseTrust * 0.4 + independentBonus + supportBonus * 0.5, 0, 1)
 *
 * @param baseTrust — submitter's trust score (0-100 → 0.0-1.0)
 * @param supportCount — number of supporting users
 * @param disputeCount — number of disputing users
 * @param independentCount — number of independent corroborations
 * @param isDuplicate — whether this evidence is flagged as a duplicate
 * @param isVerified — whether a reviewer has verified this evidence
 */
export function computeWeight(params: {
  baseTrust: number; // 0-100
  supportCount: number;
  disputeCount: number;
  independentCount: number;
  isDuplicate: boolean;
  isVerified: boolean;
}): WeightResult {
  const baseTrust = params.baseTrust / 100; // normalize 0-100 → 0.0-1.0

  const supportBonus = Math.min(params.supportCount * 0.05, 0.3);
  const disputePenalty = Math.min(params.disputeCount * 0.08, 0.4);
  const independentBonus = Math.min(params.independentCount * 0.1, 0.3);
  const duplicatePenalty = params.isDuplicate ? 0.15 : 0;
  const verificationBonus = params.isVerified ? 0.15 : 0;

  const weight = Math.max(
    0,
    Math.min(
      1,
      baseTrust + supportBonus - disputePenalty + independentBonus - duplicatePenalty + verificationBonus,
    ),
  );

  const confidence = Math.max(
    0,
    Math.min(1, baseTrust * 0.4 + independentBonus + supportBonus * 0.5),
  );

  const tier = tierForWeight(weight);

  return {
    weight,
    confidence,
    tier,
    factors: {
      baseTrust,
      supportBonus,
      disputePenalty,
      independentBonus,
      duplicatePenalty,
      verificationBonus,
    },
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export type DuplicateDetectionMethod =
  | "hash_match"
  | "location_proximity"
  | "time_proximity"
  | "content_similarity";

export interface DuplicateDetectionResult {
  method: DuplicateDetectionMethod;
  confidence: number;
  metadata: Record<string, unknown>;
}

/**
 * Detect duplicates between two evidence items.
 * Returns the detection method + confidence, or null if not a duplicate.
 */
export function detectDuplicate(
  a: {
    checksum: string;
    lat: number | null;
    lng: number | null;
    createdAt: Date;
    type: string;
    mediaType: string;
  },
  b: {
    checksum: string;
    lat: number | null;
    lng: number | null;
    createdAt: Date;
    type: string;
    mediaType: string;
  },
): DuplicateDetectionResult | null {
  // 1. Hash match — exact same content (confidence 1.0)
  if (a.checksum === b.checksum) {
    return {
      method: "hash_match",
      confidence: 1.0,
      metadata: { checksum: a.checksum },
    };
  }

  // 2. Location proximity — same type + within 50m + within 1 hour
  if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
    if (a.type === b.type) {
      const distanceM = haversineMeters(a.lat, a.lng, b.lat, b.lng);
      const timeDiffSec = Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) / 1000;
      if (distanceM < 50 && timeDiffSec < 3600) {
        return {
          method: "location_proximity",
          confidence: 0.85,
          metadata: { distance_m: Math.round(distanceM), time_diff_sec: Math.round(timeDiffSec) },
        };
      }
    }
  }

  // 3. Time proximity — same type + same mediaType + within 5 minutes
  if (a.type === b.type && a.mediaType === b.mediaType) {
    const timeDiffSec = Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) / 1000;
    if (timeDiffSec < 300) {
      return {
        method: "time_proximity",
        confidence: 0.75,
        metadata: { time_diff_sec: Math.round(timeDiffSec) },
      };
    }
  }

  // 4. Content similarity — same type + same checksum prefix (first 16 chars)
  // (a weak heuristic for near-duplicates)
  if (a.type === b.type && a.checksum.slice(0, 16) === b.checksum.slice(0, 16)) {
    return {
      method: "content_similarity",
      confidence: 0.6,
      metadata: { checksum_prefix: a.checksum.slice(0, 16) },
    };
  }

  return null;
}

/**
 * Haversine distance in meters.
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Independence check
// =============================================================================
// A corroboration is "independent" if the corroborator has no relationship to
// the original submitter (different organization, different device, no
// shared membership). This prevents collusion from inflating confidence.
// ---------------------------------------------------------------------------

export interface IndependenceCheck {
  isIndependent: boolean;
  reasons: string[];
}

export function checkIndependence(params: {
  submitterOrgId: string | null;
  corroboratorOrgId: string | null;
  submitterDeviceId: string | null;
  corroboratorDeviceId: string | null;
  hasRelationship: boolean; // from the Knowledge Graph (M6)
}): IndependenceCheck {
  const reasons: string[] = [];

  if (params.submitterOrgId && params.corroboratorOrgId) {
    if (params.submitterOrgId === params.corroboratorOrgId) {
      return { isIndependent: false, reasons: ["same_organization"] };
    }
    reasons.push("different_organization");
  }

  if (params.submitterDeviceId && params.corroboratorDeviceId) {
    if (params.submitterDeviceId === params.corroboratorDeviceId) {
      return { isIndependent: false, reasons: ["same_device"] };
    }
    reasons.push("different_device");
  }

  if (params.hasRelationship) {
    return { isIndependent: false, reasons: ["graph_relationship"] };
  }

  reasons.push("no_relationship");
  return { isIndependent: true, reasons };
}
