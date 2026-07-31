/**
 * Sentinel — Analytics Platform Service
 * =============================================================================
 * Computes KPIs across 6 categories live from real platform data. Each category
 * has multiple KPIs with values, targets, trends, and status indicators.
 *
 * The service also supports saving periodic snapshots for trend tracking.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  KPI_DEFINITIONS,
  CATEGORY_META,
  computeTrend,
  computeStatus,
  type AnalyticsCategory,
  type KpiResult,
} from "../../domain/analytics-types";

export class AnalyticsService {
  // ===========================================================================
  // Compute KPIs for a specific category
  // ===========================================================================

  async computeCategoryKPIs(category: AnalyticsCategory): Promise<{
    category: AnalyticsCategory;
    label: string;
    color: string;
    icon: string;
    description: string;
    kpis: KpiResult[];
    summary: { total: number; good: number; warning: number; critical: number; neutral: number };
  }> {
    const meta = CATEGORY_META[category];
    let kpis: KpiResult[] = [];

    if (category === "hotspots") kpis = await this.computeHotspotKPIs();
    else if (category === "environmental") kpis = await this.computeEnvironmentalKPIs();
    else if (category === "response_times") kpis = await this.computeResponseTimeKPIs();
    else if (category === "community") kpis = await this.computeCommunityKPIs();
    else if (category === "trust") kpis = await this.computeTrustKPIs();
    else if (category === "rewards") kpis = await this.computeRewardKPIs();

    // Compute summary
    const summary = {
      total: kpis.length,
      good: kpis.filter((k) => k.status === "good").length,
      warning: kpis.filter((k) => k.status === "warning").length,
      critical: kpis.filter((k) => k.status === "critical").length,
      neutral: kpis.filter((k) => k.status === "neutral").length,
    };

    return { category, ...meta, kpis, summary };
  }

  // ===========================================================================
  // 1. HOTSPOT KPIs
  // ===========================================================================

  async computeHotspotKPIs(): Promise<KpiResult[]> {
    const [total, byRiskLevel, byType, avgProbability, avgExpansion, atRiskCount] = await Promise.all([
      db.hotspotPrediction.count(),
      db.hotspotPrediction.groupBy({ by: ["riskLevel"], _count: true }),
      db.hotspotPrediction.groupBy({ by: ["type"], _count: true }),
      db.hotspotPrediction.aggregate({ _avg: { probability: true } }),
      db.hotspotPrediction.aggregate({ _avg: { expansionRadiusKm: true } }),
      db.hotspotPrediction.findMany({ select: { atRiskEntities: true }, take: 100 }),
    ]);

    const criticalCount = byRiskLevel.find((r) => r.riskLevel === "critical")?._count ?? 0;
    const expansionCount = byType.find((t) => t.type === "expansion")?._count ?? 0;

    // Count at-risk entities
    let atRiskTotal = 0;
    for (const h of atRiskCount) {
      try {
        const entities = h.atRiskEntities ? JSON.parse(h.atRiskEntities) : [];
        atRiskTotal += Array.isArray(entities) ? entities.length : 0;
      } catch {}
    }

    const defs = KPI_DEFINITIONS.filter((d) => d.category === "hotspots");
    const values: Record<string, number> = {
      hotspot_count: total,
      hotspot_avg_probability: (avgProbability._avg.probability ?? 0) * 100,
      hotspot_critical_count: criticalCount,
      hotspot_expansion_count: expansionCount,
      hotspot_avg_expansion_km: avgExpansion._avg.expansionRadiusKm ?? 0,
      hotspot_at_risk_entities: atRiskTotal,
    };

    return defs.map((d) => {
      const value = values[d.key] ?? 0;
      return {
        key: d.key,
        label: d.label,
        value,
        unit: d.unit,
        category: d.category,
        description: d.description,
        goodDirection: d.goodDirection,
        target: d.target,
        targetLabel: d.targetLabel,
        status: computeStatus(value, d.target, d.goodDirection),
      };
    });
  }

  // ===========================================================================
  // 2. ENVIRONMENTAL KPIs
  // ===========================================================================

  async computeEnvironmentalKPIs(): Promise<KpiResult[]> {
    const [total, byRiskLevel, byType, avgRisk] = await Promise.all([
      db.environmentalPrediction.count(),
      db.environmentalPrediction.groupBy({ by: ["riskLevel"], _count: true }),
      db.environmentalPrediction.groupBy({ by: ["type"], _count: true }),
      db.environmentalPrediction.aggregate({ _avg: { riskScore: true } }),
    ]);

    const criticalCount = byRiskLevel.find((r) => r.riskLevel === "critical")?._count ?? 0;
    const highCount = byRiskLevel.find((r) => r.riskLevel === "high")?._count ?? 0;

    // Per-type averages
    const typeAvgs = await Promise.all(
      ["sediment", "river_impact", "forest_loss", "downstream_effects", "protected_area_risk"].map(async (type) => {
        const agg = await db.environmentalPrediction.aggregate({
          where: { type },
          _avg: { riskScore: true },
        });
        return { type, avg: (agg._avg.riskScore ?? 0) * 100 };
      }),
    );

    const defs = KPI_DEFINITIONS.filter((d) => d.category === "environmental");
    const values: Record<string, number> = {
      env_prediction_count: total,
      env_avg_risk_score: (avgRisk._avg.riskScore ?? 0) * 100,
      env_critical_count: criticalCount,
      env_high_risk_count: highCount,
      env_sediment_avg: typeAvgs.find((t) => t.type === "sediment")?.avg ?? 0,
      env_forest_loss_avg: typeAvgs.find((t) => t.type === "forest_loss")?.avg ?? 0,
      env_water_quality_avg: typeAvgs.find((t) => t.type === "river_impact")?.avg ?? 0,
      env_protected_area_avg: typeAvgs.find((t) => t.type === "protected_area_risk")?.avg ?? 0,
    };

    return defs.map((d) => {
      const value = values[d.key] ?? 0;
      return {
        key: d.key,
        label: d.label,
        value,
        unit: d.unit,
        category: d.category,
        description: d.description,
        goodDirection: d.goodDirection,
        target: d.target,
        targetLabel: d.targetLabel,
        status: computeStatus(value, d.target, d.goodDirection),
      };
    });
  }

  // ===========================================================================
  // 3. RESPONSE TIME KPIs
  // ===========================================================================

  async computeResponseTimeKPIs(): Promise<KpiResult[]> {
    const [totalInvestigations, openInvestigations, totalInspections, completedInspections, scheduledInspections, totalCases, closedCases, overdueCases, finesAgg] = await Promise.all([
      db.investigation.count(),
      db.investigation.count({ where: { status: { notIn: ["closed"] } } }),
      db.inspection.count(),
      db.inspection.count({ where: { status: "completed" } }),
      db.inspection.count({ where: { status: "scheduled" } }),
      db.case.count(),
      db.case.count({ where: { status: { in: ["closed", "adjudicated"] } } }),
      db.case.count({ where: { status: { notIn: ["closed", "adjudicated"] } } }),
      db.case.aggregate({ _sum: { finesImposedGHS: true } }),
    ]);

    // Average investigation days (for closed investigations)
    const closedInvestigations = await db.investigation.findMany({
      where: { status: "closed", closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      take: 100,
    });
    let avgInvDays = 0;
    if (closedInvestigations.length > 0) {
      const totalDays = closedInvestigations.reduce((sum, inv) => {
        if (inv.closedAt) {
          return sum + (inv.closedAt.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0);
      avgInvDays = totalDays / closedInvestigations.length;
    }

    const inspectionCompletionRate = scheduledInspections + completedInspections > 0
      ? (completedInspections / (scheduledInspections + completedInspections)) * 100
      : 0;
    const caseResolutionRate = totalCases > 0 ? (closedCases / totalCases) * 100 : 0;

    const defs = KPI_DEFINITIONS.filter((d) => d.category === "response_times");
    const values: Record<string, number> = {
      rt_investigation_count: totalInvestigations,
      rt_open_investigations: openInvestigations,
      rt_investigation_avg_days: avgInvDays,
      rt_inspection_count: totalInspections,
      rt_inspection_completion_rate: inspectionCompletionRate,
      rt_case_count: totalCases,
      rt_case_resolution_rate: caseResolutionRate,
      rt_overdue_count: overdueCases,
      rt_fines_collected: finesAgg._sum.finesImposedGHS ?? 0,
    };

    return defs.map((d) => {
      const value = values[d.key] ?? 0;
      return {
        key: d.key,
        label: d.label,
        value,
        unit: d.unit,
        category: d.category,
        description: d.description,
        goodDirection: d.goodDirection,
        target: d.target,
        targetLabel: d.targetLabel,
        status: computeStatus(value, d.target, d.goodDirection),
      };
    });
  }

  // ===========================================================================
  // 4. COMMUNITY ENGAGEMENT KPIs
  // ===========================================================================

  async computeCommunityKPIs(): Promise<KpiResult[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [intelEvents, evidenceCount, verifiedEvidence, corroborationCount, subscriberCount, commentCount, shareCount, missionsCompleted, activeUsers] = await Promise.all([
      db.intelligenceEvent.count(),
      db.evidence.count(),
      db.evidence.count({ where: { verified: true } }),
      db.corroboration.count(),
      db.eventSubscription.count(),
      db.eventComment.count(),
      db.eventShare.count(),
      db.mission.count({ where: { status: { in: ["verified", "completed"] } } }),
      db.trustFactor.count({ where: { lastActivityAt: { gte: thirtyDaysAgo } } }),
    ]);

    const verificationRate = evidenceCount > 0 ? (verifiedEvidence / evidenceCount) * 100 : 0;

    const defs = KPI_DEFINITIONS.filter((d) => d.category === "community");
    const values: Record<string, number> = {
      comm_intel_events: intelEvents,
      comm_evidence_count: evidenceCount,
      comm_verified_evidence: verifiedEvidence,
      comm_verification_rate: verificationRate,
      comm_corroboration_count: corroborationCount,
      comm_subscribers: subscriberCount,
      comm_comments: commentCount,
      comm_shares: shareCount,
      comm_active_users: activeUsers,
      comm_missions_completed: missionsCompleted,
    };

    return defs.map((d) => {
      const value = values[d.key] ?? 0;
      return {
        key: d.key,
        label: d.label,
        value,
        unit: d.unit,
        category: d.category,
        description: d.description,
        goodDirection: d.goodDirection,
        target: d.target,
        targetLabel: d.targetLabel,
        status: computeStatus(value, d.target, d.goodDirection),
      };
    });
  }

  // ===========================================================================
  // 5. TRUST METRICS KPIs
  // ===========================================================================

  async computeTrustKPIs(): Promise<KpiResult[]> {
    const [totalProfiles, byTier, avgScore, avgAccuracy, avgReliability, avgFalseReportRate, fraudAlertCount, highRiskUsers] = await Promise.all([
      db.trustFactor.count(),
      db.trustFactor.groupBy({ by: ["tier"], _count: true }),
      db.trustFactor.aggregate({ _avg: { compositeScore: true } }),
      db.trustFactor.aggregate({ _avg: { accuracy: true } }),
      db.trustFactor.aggregate({ _avg: { reliability: true } }),
      db.trustFactor.aggregate({ _avg: { falseReportRate: true } }),
      db.fraudAlert.count(),
      db.userRiskProfile.count({ where: { riskLevel: { in: ["high_risk", "critical"] } } }),
    ]);

    const eliteCount = byTier.find((t) => t.tier === "elite")?._count ?? 0;
    const trustedCount = byTier.find((t) => t.tier === "trusted")?._count ?? 0;
    const verifiedCount = byTier.find((t) => t.tier === "verified")?._count ?? 0;

    const defs = KPI_DEFINITIONS.filter((d) => d.category === "trust");
    const values: Record<string, number> = {
      trust_total_profiles: totalProfiles,
      trust_avg_score: (avgScore._avg.compositeScore ?? 0) * 100,
      trust_elite_count: eliteCount,
      trust_trusted_count: trustedCount,
      trust_verified_count: verifiedCount,
      trust_avg_accuracy: (avgAccuracy._avg.accuracy ?? 0) * 100,
      trust_avg_reliability: (avgReliability._avg.reliability ?? 0) * 100,
      trust_false_report_rate: (avgFalseReportRate._avg.falseReportRate ?? 0) * 100,
      trust_fraud_flags: fraudAlertCount,
      trust_high_risk_users: highRiskUsers,
    };

    return defs.map((d) => {
      const value = values[d.key] ?? 0;
      return {
        key: d.key,
        label: d.label,
        value,
        unit: d.unit,
        category: d.category,
        description: d.description,
        goodDirection: d.goodDirection,
        target: d.target,
        targetLabel: d.targetLabel,
        status: computeStatus(value, d.target, d.goodDirection),
      };
    });
  }

  // ===========================================================================
  // 6. REWARD METRICS KPIs
  // ===========================================================================

  async computeRewardKPIs(): Promise<KpiResult[]> {
    const [poolCount, totalFunds, distributed, available, contributionCount, distributionCount, ledgerEntries, avgContributionScore] = await Promise.all([
      db.rewardPool.count(),
      db.rewardPool.aggregate({ _sum: { totalFunds: true } }),
      db.rewardPool.aggregate({ _sum: { distributedFunds: true } }),
      db.rewardPool.aggregate({ _sum: { availableFunds: true } }),
      db.rewardContribution.count(),
      db.rewardDistribution.count(),
      db.rewardLedger.count(),
      db.rewardContribution.aggregate({ _avg: { contributionScore: true } }),
    ]);

    const totalFundsVal = totalFunds._sum.totalFunds ?? 0;
    const distributedVal = distributed._sum.distributedFunds ?? 0;
    const distributionRate = totalFundsVal > 0 ? (distributedVal / totalFundsVal) * 100 : 0;

    const defs = KPI_DEFINITIONS.filter((d) => d.category === "rewards");
    const values: Record<string, number> = {
      rew_pool_count: poolCount,
      rew_total_funds: totalFundsVal,
      rew_distributed: distributedVal,
      rew_available: available._sum.availableFunds ?? 0,
      rew_distribution_rate: distributionRate,
      rew_contributors: contributionCount,
      rew_distributions: distributionCount,
      rew_avg_contribution_score: avgContributionScore._avg.contributionScore ?? 0,
      rew_ledger_entries: ledgerEntries,
    };

    return defs.map((d) => {
      const value = values[d.key] ?? 0;
      return {
        key: d.key,
        label: d.label,
        value,
        unit: d.unit,
        category: d.category,
        description: d.description,
        goodDirection: d.goodDirection,
        target: d.target,
        targetLabel: d.targetLabel,
        status: computeStatus(value, d.target, d.goodDirection),
      };
    });
  }

  // ===========================================================================
  // FULL DASHBOARD — all 6 categories
  // ===========================================================================

  async getDashboard(): Promise<{
    categories: Array<ReturnType<AnalyticsService["computeCategoryKPIs"] extends (c: AnalyticsCategory) => Promise<infer T> ? () => T : never>>;
    totalKpis: number;
    totalGood: number;
    totalWarning: number;
    totalCritical: number;
  }> {
    const categories = await Promise.all([
      this.computeCategoryKPIs("hotspots"),
      this.computeCategoryKPIs("environmental"),
      this.computeCategoryKPIs("response_times"),
      this.computeCategoryKPIs("community"),
      this.computeCategoryKPIs("trust"),
      this.computeCategoryKPIs("rewards"),
    ]);

    const totalKpis = categories.reduce((s, c) => s + c.summary.total, 0);
    const totalGood = categories.reduce((s, c) => s + c.summary.good, 0);
    const totalWarning = categories.reduce((s, c) => s + c.summary.warning, 0);
    const totalCritical = categories.reduce((s, c) => s + c.summary.critical, 0);

    return { categories, totalKpis, totalGood, totalWarning, totalCritical };
  }

  // ===========================================================================
  // SUMMARY — top-level metrics
  // ===========================================================================

  async summary() {
    const dashboard = await this.getDashboard();

    return {
      totalCategories: 6,
      totalKpis: dashboard.totalKpis,
      totalGood: dashboard.totalGood,
      totalWarning: dashboard.totalWarning,
      totalCritical: dashboard.totalCritical,
      healthScore: dashboard.totalKpis > 0 ? Math.round((dashboard.totalGood / dashboard.totalKpis) * 100) : 0,
      categories: dashboard.categories.map((c) => ({
        category: c.category,
        label: c.label,
        color: c.color,
        icon: c.icon,
        description: c.description,
        kpiCount: c.summary.total,
        good: c.summary.good,
        warning: c.summary.warning,
        critical: c.summary.critical,
        neutral: c.summary.neutral,
        healthScore: c.summary.total > 0 ? Math.round((c.summary.good / c.summary.total) * 100) : 0,
        // Top 3 KPIs for quick display
        topKpis: c.kpis.slice(0, 4).map((k) => ({
          key: k.key,
          label: k.label,
          value: k.value,
          unit: k.unit,
          status: k.status,
          target: k.target,
          targetLabel: k.targetLabel,
        })),
      })),
    };
  }

  // ===========================================================================
  // SNAPSHOT — save current KPIs for trend tracking
  // ===========================================================================

  async saveSnapshot(category: AnalyticsCategory, period: string = "daily"): Promise<{ snapshotId: string }> {
    const categoryData = await this.computeCategoryKPIs(category);
    const now = new Date();
    // Truncate to period start
    const snapshotDate = new Date(now);
    if (period === "daily") {
      snapshotDate.setHours(0, 0, 0, 0);
    } else if (period === "weekly") {
      snapshotDate.setDate(snapshotDate.getDate() - snapshotDate.getDay());
      snapshotDate.setHours(0, 0, 0, 0);
    } else if (period === "monthly") {
      snapshotDate.setDate(1);
      snapshotDate.setHours(0, 0, 0, 0);
    }

    const kpis: Record<string, number> = {};
    for (const kpi of categoryData.kpis) {
      kpis[kpi.key] = kpi.value;
    }

    const snapshot = await db.analyticsSnapshot.upsert({
      where: {
        category_period_snapshotDate: {
          category,
          period,
          snapshotDate,
        },
      },
      create: {
        category,
        period,
        snapshotDate,
        kpis: JSON.stringify(kpis),
        metricCount: categoryData.kpis.length,
      },
      update: {
        kpis: JSON.stringify(kpis),
        metricCount: categoryData.kpis.length,
        computedAt: now,
      },
    });

    logger.info("analytics.snapshot_saved", { category, period, snapshotId: snapshot.id });
    return { snapshotId: snapshot.id };
  }

  // ===========================================================================
  // GET SNAPSHOTS — for trend tracking
  // ===========================================================================

  async getSnapshots(params: { category: AnalyticsCategory; period?: string; limit?: number }) {
    const { category, period = "daily", limit = 30 } = params;
    const snapshots = await db.analyticsSnapshot.findMany({
      where: { category, period },
      take: limit,
      orderBy: { snapshotDate: "desc" },
    });

    return {
      snapshots: snapshots.map((s) => ({
        ...s,
        kpis: s.kpis ? JSON.parse(s.kpis) : {},
      })),
    };
  }
}

let _svc: AnalyticsService | null = null;
export function getAnalyticsService(): AnalyticsService {
  if (!_svc) _svc = new AnalyticsService();
  return _svc;
}
