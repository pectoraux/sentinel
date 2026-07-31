/**
 * Sentinel — Fraud Detection AI Domain
 * =============================================================================
 * Detects seven classes of fraud across the Sentinel platform:
 *   1. Fake evidence   — manipulated, duplicated, or fabricated evidence
 *   2. Collusion       — multiple users coordinating to manipulate evidence
 *   3. Sockpuppets     — one user controlling multiple accounts
 *   4. Location spoofing — GPS coordinates that don't match reality
 *   5. Deepfakes       — AI-generated images/video detected as synthetic
 *   6. Vote rings      — coordinated corroboration rings (circular support)
 *   7. Reward farming  — low-quality submissions to farm reward pools
 *
 * Each fraud type has detectors that produce signals. Signals are aggregated
 * into alerts. Alerts are investigated, resolved, and feed into UserRiskProfile.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Fraud types — the seven classes of fraud we detect
// ---------------------------------------------------------------------------

export type FraudType =
  | "fake_evidence"
  | "collusion"
  | "sockpuppet"
  | "location_spoofing"
  | "deepfake"
  | "vote_ring"
  | "reward_farming";

export const FRAUD_TYPE_META: Record<
  FraudType,
  { label: string; color: string; icon: string; description: string; defaultSeverity: Severity }
> = {
  fake_evidence: {
    label: "Fake Evidence",
    color: "#ef4444",
    icon: "FileX",
    description: "Manipulated, duplicated, or fabricated evidence — hash collisions, metadata mismatches, broken hash chains, impossible timestamps.",
    defaultSeverity: "high",
  },
  collusion: {
    label: "Collusion",
    color: "#f59e0b",
    icon: "Users",
    description: "Multiple users coordinating to manipulate evidence or corroboration — circular support, identical submissions, coordinated timing.",
    defaultSeverity: "high",
  },
  sockpuppet: {
    label: "Sockpuppet",
    color: "#a78bfa",
    icon: "UserX",
    description: "One user controlling multiple accounts — shared devices, shared IPs, correlated activity timing, similar registration patterns.",
    defaultSeverity: "medium",
  },
  location_spoofing: {
    label: "Location Spoofing",
    color: "#0ea5e9",
    icon: "MapPinOff",
    description: "GPS coordinates that don't match evidence metadata or reality — impossible travel, GPS/EXIF mismatch, identical coords across 'independent' submissions.",
    defaultSeverity: "medium",
  },
  deepfake: {
    label: "Deepfake",
    color: "#ec4899",
    icon: "Brain",
    description: "AI-generated images/video detected as synthetic — missing EXIF, AI artifact signatures, inconsistent lighting/shadows, facial inconsistencies.",
    defaultSeverity: "critical",
  },
  vote_ring: {
    label: "Vote Ring",
    color: "#14b8a6",
    icon: "Repeat",
    description: "Coordinated corroboration rings — users who only support each other in circular patterns, coordinated timing, high dispute rates against outsiders.",
    defaultSeverity: "high",
  },
  reward_farming: {
    label: "Reward Farming",
    color: "#84cc16",
    icon: "Coins",
    description: "Submitting low-quality evidence repeatedly to farm reward pools — high volume, low weight, repeated mission acceptance with poor verification.",
    defaultSeverity: "medium",
  },
};

// ---------------------------------------------------------------------------
// Signal types — individual indicators produced by detectors
// ---------------------------------------------------------------------------

export type SignalType =
  | "hash_duplicate"
  | "metadata_mismatch"
  | "impossible_travel"
  | "identical_timestamp"
  | "shared_device"
  | "shared_ip"
  | "timing_pattern"
  | "gps_metadata_mismatch"
  | "ai_artifact"
  | "facial_inconsistency"
  | "coordinated_voting"
  | "circular_corroboration"
  | "bulk_submission"
  | "low_quality_spam"
  | "repeated_evidence"
  | "broken_hash_chain"
  | "impossible_timestamp";

export const SIGNAL_TYPE_META: Record<
  SignalType,
  { label: string; weight: number; description: string }
> = {
  hash_duplicate: { label: "Hash Duplicate", weight: 0.95, description: "Identical content hash across evidence from different users or events" },
  metadata_mismatch: { label: "Metadata Mismatch", weight: 0.7, description: "EXIF metadata conflicts with stored location/timestamp" },
  impossible_travel: { label: "Impossible Travel", weight: 0.9, description: "User submitted evidence from two distant locations within impossible timeframe" },
  identical_timestamp: { label: "Identical Timestamp", weight: 0.75, description: "Multiple 'independent' submissions at the exact same millisecond" },
  shared_device: { label: "Shared Device", weight: 0.85, description: "Multiple accounts logged in from the same trusted device" },
  shared_ip: { label: "Shared IP", weight: 0.6, description: "Multiple accounts originating from the same IP address" },
  timing_pattern: { label: "Timing Pattern", weight: 0.65, description: "Correlated activity timing suggesting single operator" },
  gps_metadata_mismatch: { label: "GPS/EXIF Mismatch", weight: 0.8, description: "GPS coordinates in evidence don't match EXIF geotag" },
  ai_artifact: { label: "AI Artifact", weight: 0.85, description: "Metadata signatures consistent with AI image generation" },
  facial_inconsistency: { label: "Facial Inconsistency", weight: 0.8, description: "Inconsistent facial features across supposedly different witnesses" },
  coordinated_voting: { label: "Coordinated Voting", weight: 0.8, description: "Group of users corroborating within tight time windows" },
  circular_corroboration: { label: "Circular Corroboration", weight: 0.9, description: "Users A→B→C→A only support each other in a ring" },
  bulk_submission: { label: "Bulk Submission", weight: 0.6, description: "High volume of evidence submitted in a short window" },
  low_quality_spam: { label: "Low-Quality Spam", weight: 0.7, description: "Consistently low-weighted evidence submissions" },
  repeated_evidence: { label: "Repeated Evidence", weight: 0.85, description: "Same evidence re-submitted across multiple events/missions" },
  broken_hash_chain: { label: "Broken Hash Chain", weight: 0.95, description: "Evidence hash chain invalid — tampered content" },
  impossible_timestamp: { label: "Impossible Timestamp", weight: 0.85, description: "Evidence timestamp before user account creation" },
};

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type Severity = "low" | "medium" | "high" | "critical";

export const SEVERITY_META: Record<
  Severity,
  { label: string; color: string; riskWeight: number; description: string }
> = {
  low: { label: "Low", color: "#64748b", riskWeight: 0.3, description: "Minor anomaly — likely benign" },
  medium: { label: "Medium", color: "#f59e0b", riskWeight: 0.5, description: "Suspicious pattern — warrants review" },
  high: { label: "High", color: "#ef4444", riskWeight: 0.75, description: "Strong fraud indicators — investigate" },
  critical: { label: "Critical", color: "#dc2626", riskWeight: 0.95, description: "Near-certain fraud — immediate action" },
};

// ---------------------------------------------------------------------------
// Risk levels for user profiles
// ---------------------------------------------------------------------------

export type RiskLevel = "clean" | "low_risk" | "moderate_risk" | "high_risk" | "critical";

export const RISK_LEVEL_META: Record<
  RiskLevel,
  { label: string; color: string; minScore: number; description: string }
> = {
  clean: { label: "Clean", color: "#22c55e", minScore: 0.0, description: "No fraud indicators" },
  low_risk: { label: "Low Risk", color: "#eab308", minScore: 0.2, description: "Minor anomalies detected" },
  moderate_risk: { label: "Moderate Risk", color: "#f59e0b", minScore: 0.4, description: "Multiple suspicious patterns" },
  high_risk: { label: "High Risk", color: "#ef4444", minScore: 0.6, description: "Strong fraud indicators" },
  critical: { label: "Critical", color: "#dc2626", minScore: 0.85, description: "Confirmed fraud — action required" },
};

// ---------------------------------------------------------------------------
// Alert status
// ---------------------------------------------------------------------------

export type AlertStatus = "detected" | "investigating" | "confirmed" | "dismissed" | "resolved" | "escalated";

export const ALERT_STATUS_META: Record<AlertStatus, { label: string; color: string }> = {
  detected: { label: "Detected", color: "#f59e0b" },
  investigating: { label: "Investigating", color: "#0ea5e9" },
  confirmed: { label: "Confirmed", color: "#dc2626" },
  dismissed: { label: "Dismissed", color: "#64748b" },
  resolved: { label: "Resolved", color: "#22c55e" },
  escalated: { label: "Escalated", color: "#a855f7" },
};

// ---------------------------------------------------------------------------
// Recommended actions for investigations
// ---------------------------------------------------------------------------

export type RecommendedAction =
  | "dismiss"
  | "warn_user"
  | "suspend_user"
  | "revoke_rewards"
  | "escalate_to_admin"
  | "refer_to_authorities";

export const RECOMMENDED_ACTION_META: Record<RecommendedAction, { label: string; penalty: number; description: string }> = {
  dismiss: { label: "Dismiss", penalty: 0.0, description: "No action — false positive" },
  warn_user: { label: "Warn User", penalty: 0.1, description: "Send warning — minor fraud" },
  suspend_user: { label: "Suspend User", penalty: 0.5, description: "Suspend account — confirmed fraud" },
  revoke_rewards: { label: "Revoke Rewards", penalty: 0.3, description: "Revoke fraudulently obtained rewards" },
  escalate_to_admin: { label: "Escalate to Admin", penalty: 0.4, description: "Manual admin review required" },
  refer_to_authorities: { label: "Refer to Authorities", penalty: 0.6, description: "Criminal activity — refer to EPA/police" },
};

// ---------------------------------------------------------------------------
// Detection result — what each detector returns
// ---------------------------------------------------------------------------

export interface DetectionSignal {
  signalType: SignalType;
  detector: string;
  confidence: number; // 0.0–1.0
  weight?: number; // defaults to SIGNAL_TYPE_META weight
  description: string;
  evidence?: Record<string, unknown>; // supporting data
}

export interface DetectionResult {
  fraudType: FraudType;
  signals: DetectionSignal[];
  targetUserId?: string;
  targetUserIds?: string[];
  targetEntityIds?: string[];
  estimatedImpactGHS?: number;
}

// ---------------------------------------------------------------------------
// Core computation functions
// ---------------------------------------------------------------------------

/**
 * Compute the overall risk score for an alert from its signals.
 * riskScore = sum(signal.confidence × signal.weight) / sum(signal.weight)
 * Clamped to [0, 1].
 */
export function computeAlertRiskScore(signals: DetectionSignal[]): number {
  if (signals.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of signals) {
    const w = s.weight ?? SIGNAL_TYPE_META[s.signalType].weight;
    weightedSum += s.confidence * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.min(1, Math.max(0, Math.round((weightedSum / totalWeight) * 10000) / 10000));
}

/**
 * Compute the confidence that fraud actually occurred.
 * confidence = 1 - product(1 - signal.confidence) for independent signals
 * (Probability of union of independent events — more signals = higher confidence.)
 */
export function computeAlertConfidence(signals: DetectionSignal[]): number {
  if (signals.length === 0) return 0;
  let probNoFraud = 1.0;
  for (const s of signals) {
    probNoFraud *= (1 - s.confidence);
  }
  return Math.round((1 - probNoFraud) * 10000) / 10000;
}

/**
 * Classify a risk score (0.0–1.0) into a risk level.
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 0.85) return "critical";
  if (score >= 0.6) return "high_risk";
  if (score >= 0.4) return "moderate_risk";
  if (score >= 0.2) return "low_risk";
  return "clean";
}

/**
 * Determine severity from risk score.
 */
export function severityFromRiskScore(score: number): Severity {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

/**
 * Compute the trust score penalty for a confirmed alert.
 * penalty = severityRiskWeight × confirmedMultiplier
 * - Dismissed alerts: 0 penalty
 * - Confirmed alerts: severity drives penalty (0.3 → 0.95)
 */
export function computeTrustPenalty(params: {
  severity: Severity;
  status: AlertStatus;
  signalsCount: number;
}): number {
  if (params.status === "dismissed") return 0;
  const base = SEVERITY_META[params.severity].riskWeight;
  // More signals = higher penalty (capped at 1.5× base)
  const signalMultiplier = Math.min(1.5, 1 + params.signalsCount * 0.1);
  return Math.min(1, Math.round(base * signalMultiplier * 100) / 100);
}

/**
 * Should an alert auto-escalate?
 * - Critical severity with high confidence → yes
 * - Estimated impact > 1000 GHS → yes
 */
export function shouldEscalate(params: {
  severity: Severity;
  confidence: number;
  estimatedImpactGHS: number;
}): boolean {
  if (params.severity === "critical" && params.confidence >= 0.8) return true;
  if (params.estimatedImpactGHS >= 1000) return true;
  return false;
}

/**
 * Haversine distance between two GPS coordinates (in km).
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 100) / 100;
}

/**
 * Check if travel between two GPS points in a given time is physically impossible.
 * Assumes max realistic ground speed of 120 km/h (car) + 30% buffer.
 * @returns speed in km/h if possible, or -1 if impossible
 */
export function checkImpossibleTravel(
  lat1: number,
  lng1: number,
  t1: Date,
  lat2: number,
  lng2: number,
  t2: Date,
): { distanceKm: number; timeHours: number; speedKmh: number; impossible: boolean } {
  const distanceKm = haversineKm(lat1, lng1, lat2, lng2);
  const timeMs = Math.abs(t2.getTime() - t1.getTime());
  const timeHours = timeMs / (1000 * 60 * 60);
  if (timeHours === 0) {
    return { distanceKm, timeHours: 0, speedKmh: distanceKm > 1 ? Infinity : 0, impossible: distanceKm > 1 };
  }
  const speedKmh = distanceKm / timeHours;
  // 156 km/h = 120 km/h × 1.3 buffer (impossible by ground)
  const impossible = speedKmh > 156 && distanceKm > 5;
  return { distanceKm, timeHours, speedKmh: Math.round(speedKmh), impossible };
}

/**
 * Detect a circular corroboration ring from a list of (supporter, supported) pairs.
 * A ring is when A supports B, B supports C, C supports A (cycle of length ≥ 3).
 * Uses a simple DFS to find cycles.
 */
export function detectCircularCorroboration(
  edges: Array<{ from: string; to: string }>,
): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string) {
    if (stack.length >= 6) return; // cap at 6-node rings
    const cycleStart = stack.indexOf(node);
    if (cycleStart !== -1) {
      const cycle = stack.slice(cycleStart).concat(node);
      if (cycle.length >= 4) {
        // length includes the repeated node, so ≥4 means ≥3 unique nodes
        // normalize cycle to start with smallest ID for dedup
        const unique = cycle.slice(0, -1);
        const minIdx = unique.indexOf([...unique].sort()[0]!);
        const normalized = [...unique.slice(minIdx), ...unique.slice(0, minIdx)];
        const key = normalized.join("→");
        if (!cycles.some((c) => c.join("→") === key)) {
          cycles.push(normalized);
        }
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.push(node);
    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        dfs(next);
      }
    }
    stack.pop();
  }

  for (const node of adj.keys()) {
    visited.clear();
    stack.length = 0;
    dfs(node);
  }

  return cycles;
}
