/**
 * Sentinel — Civil Trust Service
 * =============================================================================
 * Production trust system: computes composite trust from 8 factors, applies
 * time-based decay, detects fraud, and tracks accuracy/reliability.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  computeTrust,
  computeDecayRate,
  computeDecayAmount,
  computeFraudResistance,
  detectFraudPatterns,
  tierForScore,
  type TrustFactors,
  type TrustResult,
  type FraudType,
  type FraudSeverity,
} from "../../domain/trust-engine";

export class CivilTrustService {
  /**
   * Compute and persist the trust factor record for a user.
   * Gathers data from: M2 verifications, M8 intelligence events, M9 evidence weights,
   * M9 corroboration records, and the user's activity history.
   */
  async computeTrustForUser(userId: string): Promise<TrustResult> {
    // Gather all factors from the platform
    const [
      intelEvents,
      evidenceWeights,
      corroborations,
      verifications,
      fraudFlags,
      existingFactor,
    ] = await Promise.all([
      // M8: Intelligence events created by this user
      db.intelligenceEvent.findMany({
        where: { createdById: userId },
        select: { id: true, status: true, createdAt: true },
      }),
      // M9: Evidence weights for evidence uploaded by this user
      db.evidenceWeight.findMany({
        where: { evidence: { uploadedById: userId } },
        select: { weight: true, supportCount: true, disputeCount: true },
      }),
      // M9: Corroboration records by this user (support/dispute)
      db.corroboration.findMany({
        where: { userId },
        select: { type: true, isIndependent: true },
      }),
      // M2: Identity verifications
      db.identityVerification.findMany({
        where: { userId, status: "approved" },
        select: { id: true, type: true },
      }),
      // Fraud flags
      db.fraudFlag.findMany({
        where: { userId, status: { in: ["detected", "confirmed", "investigating"] } },
        select: { severity: true, status: true, type: true },
      }),
      // Existing factor record
      db.trustFactor.findUnique({ where: { userId } }),
    ]);

    // Factor 1: Accuracy — verified events / total events
    const totalReports = intelEvents.length;
    const verifiedReports = intelEvents.filter((e) => e.status === "verified" || e.status === "resolved").length;
    const falseReports = intelEvents.filter((e) => e.status === "false_positive").length;
    const accuracy = totalReports > 0 ? verifiedReports / totalReports : 0.5;
    const falseReportRate = totalReports > 0 ? falseReports / totalReports : 0.0;

    // Factor 2: Reliability — consistency over time
    // (reports spread across multiple days = more reliable than burst activity)
    const reportDates = intelEvents.map((e) => e.createdAt);
    const uniqueDays = new Set(reportDates.map((d) => d.toISOString().slice(0, 10))).size;
    const reliability = totalReports > 0 ? Math.min(1.0, uniqueDays / Math.max(totalReports, 1) * 1.5) : 0.5;

    // Factor 4: Evidence quality — average evidence weight
    const evidenceQuality = evidenceWeights.length > 0
      ? evidenceWeights.reduce((sum, ew) => sum + ew.weight, 0) / evidenceWeights.length
      : 0.5;

    // Factor 5: Contribution quality — support rate (supports / total corroborations)
    const supports = corroborations.filter((c) => c.type === "support").length;
    const disputes = corroborations.filter((c) => c.type === "dispute").length;
    const totalCorroborations = supports + disputes;
    const contributionQuality = totalCorroborations > 0 ? supports / totalCorroborations : 0.5;

    // Factor 6: Community impact — verifications + independent corroborations
    const independentCorroborations = corroborations.filter((c) => c.isIndependent).length;
    const communityImpact = Math.min(1.0, (verifications.length * 0.15) + (independentCorroborations * 0.1));

    // Factor 8: Fraud resistance
    const fraudInfo = computeFraudResistance(fraudFlags.map((f) => ({ severity: f.severity as FraudSeverity, status: f.status })));

    // Factor 7: Decay
    const lastActivityAt = existingFactor?.lastActivityAt ?? null;
    const decayRate = computeDecayRate(lastActivityAt);

    const factors: TrustFactors = {
      accuracy,
      reliability,
      falseReportRate,
      falseReportCount: falseReports,
      evidenceQuality,
      contributionQuality,
      communityImpact,
      fraudResistance: fraudInfo.fraudResistance,
      fraudFlagCount: fraudInfo.fraudFlagCount,
      decayRate,
      totalReports,
      verifiedReports,
      totalEvidence: evidenceWeights.length,
      totalComments: 0, // would query M8 comments
      totalShares: 0, // would query M8 shares
      lastActivityAt,
    };

    const result = computeTrust(factors);

    // Persist the trust factor record
    await db.trustFactor.upsert({
      where: { userId },
      create: {
        userId,
        accuracy,
        reliability,
        falseReportRate,
        falseReportCount: falseReports,
        evidenceQuality,
        contributionQuality,
        communityImpact,
        fraudResistance: fraudInfo.fraudResistance,
        fraudFlagCount: fraudInfo.fraudFlagCount,
        totalReports,
        verifiedReports,
        totalEvidence: evidenceWeights.length,
        lastActivityAt,
        decayRate,
        compositeScore: result.compositeScore,
        tier: result.tier,
        factors: JSON.stringify({
          factors: result.factors,
          weightedBreakdown: result.weightedBreakdown,
        }),
        lastCalculatedAt: new Date(),
      },
      update: {
        accuracy,
        reliability,
        falseReportRate,
        falseReportCount: falseReports,
        evidenceQuality,
        contributionQuality,
        communityImpact,
        fraudResistance: fraudInfo.fraudResistance,
        fraudFlagCount: fraudInfo.fraudFlagCount,
        totalReports,
        verifiedReports,
        totalEvidence: evidenceWeights.length,
        lastActivityAt,
        decayRate,
        compositeScore: result.compositeScore,
        tier: result.tier,
        factors: JSON.stringify({
          factors: result.factors,
          weightedBreakdown: result.weightedBreakdown,
        }),
        lastCalculatedAt: new Date(),
      },
    });

    // Also update the M2 TrustProfile score for backward compatibility
    await db.trustProfile.upsert({
      where: { userId },
      create: {
        userId,
        score: Math.round(result.compositeScore * 100),
        tier: result.tier,
        factors: JSON.stringify({ composite: result.compositeScore, ...result.factors }),
        lastRecalculatedAt: new Date(),
      },
      update: {
        score: Math.round(result.compositeScore * 100),
        tier: result.tier,
        factors: JSON.stringify({ composite: result.compositeScore, ...result.factors }),
        lastRecalculatedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * Apply decay to all users. Should run as a daily background job.
   * Computes the decay rate based on days inactive and reduces the composite score.
   */
  async applyDecayAll(): Promise<{ usersDecayed: number; totalDecayApplied: number }> {
    const factors = await db.trustFactor.findMany({
      where: { lastActivityAt: { not: null } },
    });

    let usersDecayed = 0;
    let totalDecayApplied = 0;

    for (const factor of factors) {
      if (!factor.lastActivityAt) continue;
      const decayRate = computeDecayRate(factor.lastActivityAt);
      if (decayRate <= 0.001) continue; // skip negligible decay

      const previousScore = factor.compositeScore;
      const decayAmount = computeDecayAmount(previousScore, decayRate);
      const newScore = previousScore - decayAmount;

      if (decayAmount < 0.001) continue;

      // Update the factor record
      await db.trustFactor.update({
        where: { id: factor.id },
        data: {
          decayRate,
          compositeScore: newScore,
          tier: tierForScore(newScore),
          lastDecayAt: new Date(),
        },
      });

      // Log the decay
      const daysInactive = Math.floor((Date.now() - factor.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24));
      await db.trustDecayLog.create({
        data: {
          userId: factor.userId,
          previousScore,
          newScore,
          decayAmount,
          daysInactive,
          decayRate,
        },
      });

      usersDecayed++;
      totalDecayApplied += decayAmount;
    }

    logger.info("trust.decay_applied", { usersDecayed, totalDecayApplied });
    return { usersDecayed, totalDecayApplied };
  }

  /**
   * Detect fraud for a specific user.
   * Runs heuristics and creates FraudFlag records for detected patterns.
   */
  async detectFraud(userId: string): Promise<{ flagsCreated: number; flags: any[] }> {
    const factor = await db.trustFactor.findUnique({ where: { userId } });
    if (!factor) {
      // Compute first
      await this.computeTrustForUser(userId);
    }

    const f = factor ?? await db.trustFactor.findUnique({ where: { userId } });
    if (!f) return { flagsCreated: 0, flags: [] };

    // Get duplicate count from M9
    const duplicateGroups = await db.duplicateGroup.findMany({
      where: { status: { in: ["detected", "confirmed"] } },
    });
    let duplicateCount = 0;
    for (const g of duplicateGroups) {
      const ids: string[] = JSON.parse(g.evidenceIds);
      // Check if any of these evidence items belong to this user
      const userEvidence = await db.evidence.count({
        where: { id: { in: ids }, uploadedById: userId },
      });
      if (userEvidence > 0) duplicateCount++;
    }

    // Get corroborations from same org (coordinated manipulation check)
    const userOrg = await db.organizationMember.findFirst({
      where: { userId, status: "active" },
      select: { organizationId: true },
    });
    const sameOrgCorroborations = userOrg
      ? await db.corroboration.count({
          where: {
            type: "support",
            userId: { not: userId },
            // Would need a join to check org membership — simplified here
          },
        })
      : 0;

    const detected = detectFraudPatterns({
      falseReportRate: f.falseReportRate,
      totalReports: f.totalReports,
      duplicateCount,
      corroborationFromSameOrg: 0, // simplified
      activityRegularityScore: 0.3, // would compute from activity timestamps
    });

    const flagsCreated: any[] = [];
    for (const d of detected) {
      const flag = await db.fraudFlag.create({
        data: {
          userId,
          type: d.type,
          severity: d.severity,
          description: d.description,
          status: "detected",
        },
      });
      flagsCreated.push(flag);
    }

    // Recompute trust with new fraud flags
    if (flagsCreated.length > 0) {
      await this.computeTrustForUser(userId);
    }

    return { flagsCreated: flagsCreated.length, flags: flagsCreated };
  }

  /**
   * Get the trust profile for a user (with factor breakdown).
   */
  async getProfile(userId: string) {
    let factor = await db.trustFactor.findUnique({ where: { userId } });
    if (!factor) {
      await this.computeTrustForUser(userId);
      factor = await db.trustFactor.findUnique({ where: { userId } });
    }
    if (!factor) return null;

    return {
      userId,
      compositeScore: factor.compositeScore,
      tier: factor.tier,
      factors: factor.factors ? JSON.parse(factor.factors) : null,
      metrics: {
        accuracy: factor.accuracy,
        reliability: factor.reliability,
        falseReportRate: factor.falseReportRate,
        falseReportCount: factor.falseReportCount,
        evidenceQuality: factor.evidenceQuality,
        contributionQuality: factor.contributionQuality,
        communityImpact: factor.communityImpact,
        fraudResistance: factor.fraudResistance,
        fraudFlagCount: factor.fraudFlagCount,
        decayRate: factor.decayRate,
        lastActivityAt: factor.lastActivityAt,
        lastDecayAt: factor.lastDecayAt,
        totalReports: factor.totalReports,
        verifiedReports: factor.verifiedReports,
        totalEvidence: factor.totalEvidence,
      },
      lastCalculatedAt: factor.lastCalculatedAt,
    };
  }

  /**
   * Get fraud flags for a user.
   */
  async getFraudFlags(userId: string) {
    const flags = await db.fraudFlag.findMany({
      where: { userId },
      orderBy: { detectedAt: "desc" },
    });
    return { flags };
  }

  /**
   * Resolve a fraud flag (confirm/dismiss).
   */
  async resolveFraudFlag(flagId: string, status: string, resolvedBy: string, resolution: string): Promise<void> {
    await db.fraudFlag.update({
      where: { id: flagId },
      data: { status, resolvedAt: new Date(), resolvedById: resolvedBy, resolution },
    });
    // Recompute trust for the affected user
    const flag = await db.fraudFlag.findUnique({ where: { id: flagId } });
    if (flag) {
      await this.computeTrustForUser(flag.userId);
    }
  }

  /**
   * Get the decay history for a user.
   */
  async getDecayHistory(userId: string) {
    const logs = await db.trustDecayLog.findMany({
      where: { userId },
      orderBy: { appliedAt: "desc" },
      take: 20,
    });
    return { history: logs };
  }

  /**
   * Trust leaderboard.
   */
  async leaderboard(limit = 20) {
    const factors = await db.trustFactor.findMany({
      take: limit,
      orderBy: { compositeScore: "desc" },
    });
    const userIds = factors.map((f) => f.userId);
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, image: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      leaderboard: factors.map((f, i) => ({
        rank: i + 1,
        userId: f.userId,
        score: f.compositeScore,
        tier: f.tier,
        accuracy: f.accuracy,
        reliability: f.reliability,
        evidenceQuality: f.evidenceQuality,
        contributionQuality: f.contributionQuality,
        communityImpact: f.communityImpact,
        fraudResistance: f.fraudResistance,
        decayRate: f.decayRate,
        user: userMap.get(f.userId) ?? null,
      })),
    };
  }

  /**
   * Aggregate summary.
   */
  async summary() {
    const [
      totalUsers,
      tierDistribution,
      avgAccuracy,
      avgReliability,
      avgEvidenceQuality,
      avgContributionQuality,
      avgCommunityImpact,
      avgFraudResistance,
      avgDecayRate,
      totalFraudFlags,
      fraudFlagsByType,
      fraudFlagsByStatus,
      recentDecayLogs,
    ] = await Promise.all([
      db.trustFactor.count(),
      db.trustFactor.groupBy({ by: ["tier"], _count: true }),
      db.trustFactor.aggregate({ _avg: { accuracy: true } }),
      db.trustFactor.aggregate({ _avg: { reliability: true } }),
      db.trustFactor.aggregate({ _avg: { evidenceQuality: true } }),
      db.trustFactor.aggregate({ _avg: { contributionQuality: true } }),
      db.trustFactor.aggregate({ _avg: { communityImpact: true } }),
      db.trustFactor.aggregate({ _avg: { fraudResistance: true } }),
      db.trustFactor.aggregate({ _avg: { decayRate: true } }),
      db.fraudFlag.count(),
      db.fraudFlag.groupBy({ by: ["type"], _count: true }),
      db.fraudFlag.groupBy({ by: ["status"], _count: true }),
      db.trustDecayLog.findMany({
        take: 10,
        orderBy: { appliedAt: "desc" },
      }),
    ]);

    return {
      totalUsers,
      tierDistribution: tierDistribution.map((t) => ({ tier: t.tier, count: t._count })),
      averages: {
        accuracy: avgAccuracy._avg.accuracy ?? 0,
        reliability: avgReliability._avg.reliability ?? 0,
        evidenceQuality: avgEvidenceQuality._avg.evidenceQuality ?? 0,
        contributionQuality: avgContributionQuality._avg.contributionQuality ?? 0,
        communityImpact: avgCommunityImpact._avg.communityImpact ?? 0,
        fraudResistance: avgFraudResistance._avg.fraudResistance ?? 0,
        decayRate: avgDecayRate._avg.decayRate ?? 0,
      },
      fraudFlags: {
        total: totalFraudFlags,
        byType: fraudFlagsByType.map((f) => ({ type: f.type, count: f._count })),
        byStatus: fraudFlagsByStatus.map((f) => ({ status: f.status, count: f._count })),
      },
      recentDecay: recentDecayLogs.map((d) => ({
        userId: d.userId,
        previousScore: d.previousScore,
        newScore: d.newScore,
        decayAmount: d.decayAmount,
        daysInactive: d.daysInactive,
        appliedAt: d.appliedAt,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _svc: CivilTrustService | null = null;
export function getCivilTrustService(): CivilTrustService {
  if (!_svc) _svc = new CivilTrustService();
  return _svc;
}
