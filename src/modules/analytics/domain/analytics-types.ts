/**
 * Sentinel — Analytics Platform Domain
 * =============================================================================
 * Comprehensive analytics across 6 categories. Each category has a set of KPIs
 * that are computed live from real platform data.
 *
 * Categories:
 *   1. Hotspots          — illegal mining hotspot trends
 *   2. Environmental KPIs — water quality, forest, sediment, protected areas
 *   3. Response Times    — investigation/inspection/case SLA tracking
 *   4. Community Engagement — reports, evidence, comments, subscriptions
 *   5. Trust Metrics     — trust tiers, accuracy, fraud resistance
 *   6. Reward Metrics    — pools, contributions, distributions, ROI
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Analytics categories
// ---------------------------------------------------------------------------

export type AnalyticsCategory =
  | "hotspots"
  | "environmental"
  | "response_times"
  | "community"
  | "trust"
  | "rewards";

export const CATEGORY_META: Record<
  AnalyticsCategory,
  { label: string; color: string; icon: string; description: string }
> = {
  hotspots: {
    label: "Hotspots",
    color: "#ef4444",
    icon: "Crosshair",
    description: "Illegal mining hotspot predictions, probability trends, risk level distribution, and geographic spread.",
  },
  environmental: {
    label: "Environmental KPIs",
    color: "#22c55e",
    icon: "Leaf",
    description: "Water quality, forest cover, sediment flow, river impact, and protected area risk metrics.",
  },
  response_times: {
    label: "Response Times",
    color: "#f59e0b",
    icon: "Clock",
    description: "Investigation SLA compliance, inspection turnaround, case resolution time, and enforcement efficiency.",
  },
  community: {
    label: "Community Engagement",
    color: "#0ea5e9",
    icon: "Users",
    description: "Citizen reports, evidence submissions, comments, subscriptions, shares, and active participation.",
  },
  trust: {
    label: "Trust Metrics",
    color: "#a855f7",
    icon: "Shield",
    description: "Trust tier distribution, accuracy rates, reliability, fraud resistance, and trust score trends.",
  },
  rewards: {
    label: "Reward Metrics",
    color: "#14b8a6",
    icon: "Award",
    description: "Reward pools, contributions, distributions, funding sources, and ROI metrics.",
  },
};

// ---------------------------------------------------------------------------
// KPI definitions per category
// ---------------------------------------------------------------------------

export interface KpiDefinition {
  key: string;
  label: string;
  unit: string;
  category: AnalyticsCategory;
  description: string;
  goodDirection: "up" | "down";
  // Optional target/benchmark
  target?: number;
  targetLabel?: string;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  // --- Hotspots ---
  { key: "hotspot_count", label: "Active Hotspots", unit: "count", category: "hotspots", description: "Total number of active illegal mining hotspot predictions", goodDirection: "down" },
  { key: "hotspot_avg_probability", label: "Avg Probability", unit: "%", category: "hotspots", description: "Average probability of illegal mining across all hotspots", goodDirection: "down", target: 50, targetLabel: "Target: <50%" },
  { key: "hotspot_critical_count", label: "Critical Hotspots", unit: "count", category: "hotspots", description: "Number of hotspots with critical risk level", goodDirection: "down" },
  { key: "hotspot_expansion_count", label: "Expansion Forecasts", unit: "count", category: "hotspots", description: "Number of active expansion forecast predictions", goodDirection: "down" },
  { key: "hotspot_avg_expansion_km", label: "Avg Expansion Radius", unit: "km", category: "hotspots", description: "Average predicted expansion radius in kilometers", goodDirection: "down" },
  { key: "hotspot_at_risk_entities", label: "At-Risk Entities", unit: "count", category: "hotspots", description: "Total entities (rivers, forests, communities) at risk from hotspots", goodDirection: "down" },

  // --- Environmental ---
  { key: "env_prediction_count", label: "Env Predictions", unit: "count", category: "environmental", description: "Total environmental predictions (sediment, river impact, forest loss, etc.)", goodDirection: "down" },
  { key: "env_avg_risk_score", label: "Avg Risk Score", unit: "%", category: "environmental", description: "Average environmental risk score across all predictions", goodDirection: "down", target: 50, targetLabel: "Target: <50%" },
  { key: "env_critical_count", label: "Critical Risk", unit: "count", category: "environmental", description: "Number of predictions with critical risk level", goodDirection: "down" },
  { key: "env_high_risk_count", label: "High Risk", unit: "count", category: "environmental", description: "Number of predictions with high risk level", goodDirection: "down" },
  { key: "env_sediment_avg", label: "Sediment Risk", unit: "%", category: "environmental", description: "Average sediment flow risk score", goodDirection: "down" },
  { key: "env_forest_loss_avg", label: "Forest Loss Risk", unit: "%", category: "environmental", description: "Average forest loss risk score", goodDirection: "down" },
  { key: "env_water_quality_avg", label: "Water Impact Risk", unit: "%", category: "environmental", description: "Average river/water impact risk score", goodDirection: "down" },
  { key: "env_protected_area_avg", label: "Protected Area Risk", unit: "%", category: "environmental", description: "Average protected area risk score", goodDirection: "down" },

  // --- Response Times ---
  { key: "rt_investigation_count", label: "Investigations", unit: "count", category: "response_times", description: "Total investigations (open + closed)", goodDirection: "up" },
  { key: "rt_open_investigations", label: "Open Investigations", unit: "count", category: "response_times", description: "Currently open investigations", goodDirection: "down" },
  { key: "rt_investigation_avg_days", label: "Avg Investigation Days", unit: "days", category: "response_times", description: "Average days to close an investigation", goodDirection: "down", target: 14, targetLabel: "SLA: 14 days" },
  { key: "rt_inspection_count", label: "Inspections", unit: "count", category: "response_times", description: "Total inspections conducted", goodDirection: "up" },
  { key: "rt_inspection_completion_rate", label: "Inspection Completion", unit: "%", category: "response_times", description: "Percentage of scheduled inspections completed", goodDirection: "up", target: 90, targetLabel: "Target: >90%" },
  { key: "rt_case_count", label: "Cases", unit: "count", category: "response_times", description: "Total legal/administrative cases", goodDirection: "up" },
  { key: "rt_case_resolution_rate", label: "Case Resolution Rate", unit: "%", category: "response_times", description: "Percentage of cases closed/adjudicated", goodDirection: "up", target: 70, targetLabel: "Target: >70%" },
  { key: "rt_overdue_count", label: "Overdue Cases", unit: "count", category: "response_times", description: "Cases past their SLA deadline", goodDirection: "down" },
  { key: "rt_fines_collected", label: "Fines Collected", unit: "GHS", category: "response_times", description: "Total fines imposed and collected", goodDirection: "up" },

  // --- Community Engagement ---
  { key: "comm_intel_events", label: "Intelligence Events", unit: "count", category: "community", description: "Total citizen-reported intelligence events", goodDirection: "up" },
  { key: "comm_evidence_count", label: "Evidence Items", unit: "count", category: "community", description: "Total evidence items uploaded", goodDirection: "up" },
  { key: "comm_verified_evidence", label: "Verified Evidence", unit: "count", category: "community", description: "Evidence items that have been verified", goodDirection: "up" },
  { key: "comm_verification_rate", label: "Verification Rate", unit: "%", category: "community", description: "Percentage of evidence verified", goodDirection: "up", target: 60, targetLabel: "Target: >60%" },
  { key: "comm_corroboration_count", label: "Corroborations", unit: "count", category: "community", description: "Total support/dispute corroboration actions", goodDirection: "up" },
  { key: "comm_subscribers", label: "Subscribers", unit: "count", category: "community", description: "Total event subscriptions", goodDirection: "up" },
  { key: "comm_comments", label: "Comments", unit: "count", category: "community", description: "Total comments on intelligence events", goodDirection: "up" },
  { key: "comm_shares", label: "Shares", unit: "count", category: "community", description: "Total event shares", goodDirection: "up" },
  { key: "comm_active_users", label: "Active Users", unit: "count", category: "community", description: "Users with activity in the last 30 days", goodDirection: "up" },
  { key: "comm_missions_completed", label: "Missions Completed", unit: "count", category: "community", description: "Evidence-gathering missions completed", goodDirection: "up" },

  // --- Trust Metrics ---
  { key: "trust_total_profiles", label: "Trust Profiles", unit: "count", category: "trust", description: "Total users with trust profiles", goodDirection: "up" },
  { key: "trust_avg_score", label: "Avg Trust Score", unit: "%", category: "trust", description: "Average composite trust score across all users", goodDirection: "up", target: 60, targetLabel: "Target: >60%" },
  { key: "trust_elite_count", label: "Elite Users", unit: "count", category: "trust", description: "Users in the Elite trust tier", goodDirection: "up" },
  { key: "trust_trusted_count", label: "Trusted Users", unit: "count", category: "trust", description: "Users in the Trusted tier", goodDirection: "up" },
  { key: "trust_verified_count", label: "Verified Users", unit: "count", category: "trust", description: "Users in the Verified tier", goodDirection: "up" },
  { key: "trust_avg_accuracy", label: "Avg Accuracy", unit: "%", category: "trust", description: "Average accuracy (verified/total reports)", goodDirection: "up", target: 70, targetLabel: "Target: >70%" },
  { key: "trust_avg_reliability", label: "Avg Reliability", unit: "%", category: "trust", description: "Average reliability score", goodDirection: "up" },
  { key: "trust_false_report_rate", label: "False Report Rate", unit: "%", category: "trust", description: "Average false report rate", goodDirection: "down", target: 10, targetLabel: "Target: <10%" },
  { key: "trust_fraud_flags", label: "Fraud Flags", unit: "count", category: "trust", description: "Total fraud alerts detected", goodDirection: "down" },
  { key: "trust_high_risk_users", label: "High-Risk Users", unit: "count", category: "trust", description: "Users with high/critical risk profiles", goodDirection: "down" },

  // --- Reward Metrics ---
  { key: "rew_pool_count", label: "Reward Pools", unit: "count", category: "rewards", description: "Total active reward pools", goodDirection: "up" },
  { key: "rew_total_funds", label: "Total Funds", unit: "GHS", category: "rewards", description: "Total funds across all pools", goodDirection: "up" },
  { key: "rew_distributed", label: "Distributed", unit: "GHS", category: "rewards", description: "Total rewards distributed", goodDirection: "up" },
  { key: "rew_available", label: "Available", unit: "GHS", category: "rewards", description: "Funds still available for distribution", goodDirection: "up" },
  { key: "rew_distribution_rate", label: "Distribution Rate", unit: "%", category: "rewards", description: "Percentage of total funds distributed", goodDirection: "up", target: 50, targetLabel: "Target: >50%" },
  { key: "rew_contributors", label: "Contributors", unit: "count", category: "rewards", description: "Total contributions to reward pools", goodDirection: "up" },
  { key: "rew_distributions", label: "Distributions", unit: "count", category: "rewards", description: "Total reward distribution transactions", goodDirection: "up" },
  { key: "rew_avg_contribution_score", label: "Avg Contribution Score", unit: "score", category: "rewards", description: "Average contribution score across all contributions", goodDirection: "up" },
  { key: "rew_ledger_entries", label: "Ledger Entries", unit: "count", category: "rewards", description: "Total hash-chained ledger entries (audit trail)", goodDirection: "up" },
];

// ---------------------------------------------------------------------------
// KPI result type
// ---------------------------------------------------------------------------

export interface KpiResult {
  key: string;
  label: string;
  value: number;
  unit: string;
  category: AnalyticsCategory;
  description: string;
  goodDirection: "up" | "down";
  target?: number;
  targetLabel?: string;
  // trend: % change from previous period (null if no previous data)
  trendPct?: number | null;
  trendDirection?: "up" | "down" | "flat";
  trendGood?: boolean;
  // status: how the value compares to target
  status?: "good" | "warning" | "critical" | "neutral";
}

// ---------------------------------------------------------------------------
// Helper: compute trend
// ---------------------------------------------------------------------------

export function computeTrend(current: number, previous: number | null, goodDirection: "up" | "down"): {
  trendPct: number | null;
  trendDirection: "up" | "down" | "flat";
  trendGood: boolean;
} {
  if (previous == null || previous === 0) {
    return { trendPct: null, trendDirection: "flat", trendGood: true };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const direction: "up" | "down" | "flat" = Math.abs(pct) < 1 ? "flat" : pct > 0 ? "up" : "down";
  // "Good" if the direction aligns with goodDirection
  const trendGood = direction === "flat" ? true : goodDirection === direction;
  return {
    trendPct: Math.round(pct * 10) / 10,
    trendDirection: direction,
    trendGood,
  };
}

// ---------------------------------------------------------------------------
// Helper: compute status from target
// ---------------------------------------------------------------------------

export function computeStatus(value: number, target: number | undefined, goodDirection: "up" | "down"): "good" | "warning" | "critical" | "neutral" {
  if (target == null) return "neutral";
  if (goodDirection === "up") {
    if (value >= target) return "good";
    if (value >= target * 0.7) return "warning";
    return "critical";
  } else {
    if (value <= target) return "good";
    if (value <= target * 1.5) return "warning";
    return "critical";
  }
}

// ---------------------------------------------------------------------------
// Helper: format value for display
// ---------------------------------------------------------------------------

export function formatKpiValue(value: number, unit: string): string {
  if (unit === "GHS") {
    if (Math.abs(value) >= 1_000_000) return `₵${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `₵${(value / 1_000).toFixed(0)}K`;
    return `₵${value.toFixed(0)}`;
  }
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "days") return `${value.toFixed(1)}d`;
  if (unit === "km") return `${value.toFixed(1)}km`;
  if (unit === "score") return value.toFixed(1);
  return value.toLocaleString();
}
