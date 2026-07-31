/**
 * Sentinel — Reward Engine Service
 * =============================================================================
 * Transparent reward distribution: donation pools, NGO funding, government
 * grants. Fiat-based (GHS), no cryptocurrency. Hash-chained audit ledger.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  computeContributionScore,
  computeMeritDistribution,
  computeLedgerHash,
  type PoolType,
  type DistributionModel,
  type ContributionType,
} from "../../domain/reward-types";

export class RewardService {
  /**
   * Create a reward pool.
   */
  async createPool(params: {
    name: string;
    description?: string;
    type: string;
    sourceName: string;
    sourceType: string;
    sourceOrganizationId?: string;
    totalFunds: number;
    distributionModel?: string;
    intelligenceEventId?: string;
    isPublic?: boolean;
  }): Promise<{ poolId: string }> {
    const pool = await db.rewardPool.create({
      data: {
        key: `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: params.name,
        description: params.description,
        type: params.type,
        sourceName: params.sourceName,
        sourceType: params.sourceType,
        sourceOrganizationId: params.sourceOrganizationId,
        totalFunds: params.totalFunds,
        availableFunds: params.totalFunds,
        distributedFunds: 0,
        distributionModel: params.distributionModel ?? "merit_based",
        intelligenceEventId: params.intelligenceEventId,
        isPublic: params.isPublic ?? true,
        status: "active",
      },
    });

    // Create initial deposit ledger entry
    await this.addLedgerEntry({
      poolId: pool.id,
      entryType: "deposit",
      amount: params.totalFunds,
      balance: params.totalFunds,
      fromName: params.sourceName,
      fromId: params.sourceOrganizationId,
      description: `Initial deposit from ${params.sourceName}`,
      referenceType: "manual",
    });

    logger.info("reward.pool_created", { poolId: pool.id, type: params.type, totalFunds: params.totalFunds });
    return { poolId: pool.id };
  }

  /**
   * Record a contribution to a pool.
   */
  async contribute(params: {
    poolId: string;
    userId?: string;
    organizationId?: string;
    contributorName: string;
    contributorType: string;
    amount: number;
    contributionType?: ContributionType;
    trustTier?: string;
    qualityLevel?: string;
    evidenceId?: string;
    missionId?: string;
    description?: string;
  }): Promise<{ contributionId: string; score: number }> {
    const pool = await db.rewardPool.findUnique({ where: { id: params.poolId } });
    if (!pool) throw new Error("pool_not_found");

    const contributionType = params.contributionType ?? "financial";
    const trustTier = params.trustTier ?? "basic";
    const score = computeContributionScore({
      contributionType,
      trustTier,
      qualityLevel: params.qualityLevel,
      amount: params.amount,
    });

    const contribution = await db.rewardContribution.create({
      data: {
        poolId: params.poolId,
        userId: params.userId,
        organizationId: params.organizationId,
        contributorName: params.contributorName,
        contributorType: params.contributorType,
        amount: params.amount,
        contributionScore: score,
        contributionType,
        evidenceId: params.evidenceId,
        missionId: params.missionId,
        description: params.description,
      },
    });

    // Update pool totals (for financial contributions)
    if (contributionType === "financial") {
      await db.rewardPool.update({
        where: { id: params.poolId },
        data: {
          totalFunds: { increment: params.amount },
          availableFunds: { increment: params.amount },
        },
      });

      await this.addLedgerEntry({
        poolId: params.poolId,
        entryType: "deposit",
        amount: params.amount,
        balance: pool.availableFunds + params.amount,
        fromName: params.contributorName,
        fromId: params.userId ?? params.organizationId,
        description: `Contribution from ${params.contributorName} (${contributionType}, score: ${score})`,
        referenceType: "contribution",
        referenceId: contribution.id,
      });
    }

    logger.info("reward.contribution", { poolId: params.poolId, contributionId: contribution.id, score, amount: params.amount });
    return { contributionId: contribution.id, score };
  }

  /**
   * Distribute rewards from a pool based on the distribution model.
   */
  async distribute(params: {
    poolId: string;
    distributedById: string;
  }): Promise<{ distributions: Array<{ recipientId: string; recipientName: string; amount: number; score: number }> }> {
    const pool = await db.rewardPool.findUnique({ where: { id: params.poolId } });
    if (!pool) throw new Error("pool_not_found");
    if (pool.availableFunds <= 0) throw new Error("no_funds_available");

    // Get all contributions with scores
    const contributions = await db.rewardContribution.findMany({
      where: { poolId: params.poolId },
      orderBy: { contributionScore: "desc" },
    });

    if (contributions.length === 0) throw new Error("no_contributors");

    // Group by contributor (aggregate scores)
    const contributorMap = new Map<string, { id: string; name: string; score: number; trustTier?: string }>();
    for (const c of contributions) {
      const id = c.userId ?? c.organizationId ?? c.contributorName;
      const existing = contributorMap.get(id);
      if (existing) {
        existing.score += c.contributionScore;
      } else {
        contributorMap.set(id, { id, name: c.contributorName, score: c.contributionScore });
      }
    }

    const contributors = Array.from(contributorMap.values());
    const availableFunds = pool.availableFunds;

    // Compute distributions based on model
    let distributions: Array<{ recipientId: string; recipientName: string; amount: number; score: number; percentage: number }>;
    const model = pool.distributionModel as DistributionModel;

    if (model === "merit_based" || model === "proportional") {
      distributions = computeMeritDistribution({ availableFunds, contributors });
    } else if (model === "equal") {
      const share = Math.round((availableFunds / contributors.length) * 100) / 100;
      distributions = contributors.map((c) => ({
        recipientId: c.id, recipientName: c.name, amount: share, score: c.score, percentage: Math.round(100 / contributors.length * 100) / 100,
      }));
    } else {
      // first_come — distribute to first contributor
      const first = contributors[0]!;
      distributions = [{ recipientId: first.id, recipientName: first.name, amount: availableFunds, score: first.score, percentage: 100 }];
    }

    // Create distribution records + ledger entries
    const results: Array<{ recipientId: string; recipientName: string; amount: number; score: number }> = [];
    let remainingBalance = availableFunds;

    for (const dist of distributions) {
      // Get user's trust tier
      let trustTier: string | null = null;
      if (dist.recipientId) {
        const tf = await db.trustFactor.findUnique({ where: { userId: dist.recipientId }, select: { tier: true } });
        trustTier = tf?.tier ?? null;
      }

      const distribution = await db.rewardDistribution.create({
        data: {
          poolId: params.poolId,
          recipientId: dist.recipientId,
          recipientName: dist.recipientName,
          recipientTrustTier: trustTier,
          amount: dist.amount,
          distributionModel: model,
          contributionScore: dist.score,
          intelligenceEventId: pool.intelligenceEventId,
          distributedById: params.distributedById,
          status: "completed",
          notes: `Merit-based distribution: ${dist.percentage}% of pool (score: ${dist.score})`,
          transactionRef: `BANK-${Date.now()}-${dist.recipientId.slice(0, 6)}`,
        },
      });

      remainingBalance -= dist.amount;

      await this.addLedgerEntry({
        poolId: params.poolId,
        entryType: "distribution",
        amount: -dist.amount,
        balance: remainingBalance,
        toName: dist.recipientName,
        toId: dist.recipientId,
        description: `Reward distribution to ${dist.recipientName} (${dist.percentage}%, score: ${dist.score})`,
        referenceType: "distribution",
        referenceId: distribution.id,
        authorizedBy: params.distributedById,
      });

      results.push({ recipientId: dist.recipientId, recipientName: dist.recipientName, amount: dist.amount, score: dist.score });
    }

    // Update pool
    await db.rewardPool.update({
      where: { id: params.poolId },
      data: {
        availableFunds: 0,
        distributedFunds: { increment: availableFunds },
        status: availableFunds >= pool.availableFunds ? "depleted" : "active",
      },
    });

    logger.info("reward.distributed", { poolId: params.poolId, totalDistributed: availableFunds, recipientCount: results.length });
    return { distributions: results };
  }

  /**
   * Add a ledger entry with hash chain.
   */
  private async addLedgerEntry(params: {
    poolId: string;
    entryType: string;
    amount: number;
    balance: number;
    fromName?: string;
    fromId?: string;
    toName?: string;
    toId?: string;
    description: string;
    referenceType?: string;
    referenceId?: string;
    authorizedBy?: string;
    transactionRef?: string;
  }) {
    // Get previous hash
    const lastEntry = await db.rewardLedger.findFirst({
      where: { poolId: params.poolId },
      orderBy: { createdAt: "desc" },
      select: { entryHash: true },
    });
    const prevHash = lastEntry?.entryHash ?? null;
    const timestamp = new Date();

    const entryHash = computeLedgerHash({
      entryType: params.entryType,
      amount: params.amount,
      balance: params.balance,
      description: params.description,
      prevHash,
      timestamp,
    });

    await db.rewardLedger.create({
      data: {
        poolId: params.poolId,
        entryType: params.entryType,
        amount: params.amount,
        balance: params.balance,
        fromName: params.fromName,
        fromId: params.fromId,
        toName: params.toName,
        toId: params.toId,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
        authorizedBy: params.authorizedBy,
        transactionRef: params.transactionRef,
        entryHash,
        prevHash,
      },
    });
  }

  /**
   * Get pool ledger.
   */
  async getLedger(poolId: string) {
    const entries = await db.rewardLedger.findMany({
      where: { poolId },
      orderBy: { createdAt: "asc" },
    });
    return { entries, count: entries.length };
  }

  /**
   * List pools.
   */
  async listPools(params?: { type?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    const pools = await db.rewardPool.findMany({ where, take: limit, orderBy: { createdAt: "desc" }, include: { _count: { select: { contributions: true, distributions: true, ledger: true } } } });
    return { pools };
  }

  async getPool(id: string) {
    const pool = await db.rewardPool.findUnique({
      where: { id },
      include: {
        contributions: { take: 20, orderBy: { contributionScore: "desc" } },
        distributions: { take: 20, orderBy: { distributedAt: "desc" } },
        ledger: { take: 30, orderBy: { createdAt: "desc" } },
        _count: { select: { contributions: true, distributions: true, ledger: true } },
      },
    });
    if (!pool) return null;
    return {
      ...pool,
      contributions: pool.contributions.map((c) => ({ ...c, metadata: c.metadata ? JSON.parse(c.metadata) : null })),
      distributions: pool.distributions.map((d) => ({ ...d, metadata: d.metadata ? JSON.parse(d.metadata) : null })),
      ledger: pool.ledger,
    };
  }

  async summary() {
    const [totalPools, byType, byStatus, totalFunds, totalDistributed, totalAvailable, totalContributions, totalDistributions, totalLedgerEntries, recentPools, topContributors] = await Promise.all([
      db.rewardPool.count(),
      db.rewardPool.groupBy({ by: ["type"], _count: true, _sum: { totalFunds: true } }),
      db.rewardPool.groupBy({ by: ["status"], _count: true }),
      db.rewardPool.aggregate({ _sum: { totalFunds: true } }),
      db.rewardPool.aggregate({ _sum: { distributedFunds: true } }),
      db.rewardPool.aggregate({ _sum: { availableFunds: true } }),
      db.rewardContribution.count(),
      db.rewardDistribution.count(),
      db.rewardLedger.count(),
      db.rewardPool.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { _count: { select: { contributions: true, distributions: true } } } }),
      db.rewardContribution.findMany({ take: 5, orderBy: { contributionScore: "desc" }, select: { contributorName: true, contributionScore: true, amount: true, contributionType: true, createdAt: true } }),
    ]);

    return {
      totalPools,
      totalFunds: totalFunds._sum.totalFunds ?? 0,
      totalDistributed: totalDistributed._sum.distributedFunds ?? 0,
      totalAvailable: totalAvailable._sum.availableFunds ?? 0,
      totalContributions,
      totalDistributions,
      totalLedgerEntries,
      byType: byType.map((t) => ({ type: t.type, count: t._count, totalFunds: t._sum.totalFunds ?? 0 })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      recentPools: recentPools.map((p) => ({
        id: p.id, name: p.name, type: p.type, sourceName: p.sourceName,
        totalFunds: p.totalFunds, availableFunds: p.availableFunds, distributedFunds: p.distributedFunds,
        status: p.status, distributionModel: p.distributionModel,
        contributionCount: p._count.contributions, distributionCount: p._count.distributions,
      })),
      topContributors,
    };
  }
}

let _svc: RewardService | null = null;
export function getRewardService(): RewardService {
  if (!_svc) _svc = new RewardService();
  return _svc;
}
