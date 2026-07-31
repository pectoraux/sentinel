/**
 * Sentinel — Reward Engine Domain
 * =============================================================================
 * Transparent reward distribution from donation pools, NGO funding, and
 * government grants. No cryptocurrency — fiat-based (GHS) with audit ledger.
 * Event-specific contribution scoring ensures fair, merit-based payouts.
 * =============================================================================
 */

import { createHash } from "node:crypto";

export type PoolType = "donation" | "ngo_funding" | "government_grant" | "mission_rewards" | "community_fund";

export const POOL_TYPE_META: Record<PoolType, { label: string; color: string; icon: string; description: string }> = {
  donation: { label: "Donation Pool", color: "#0ea5e9", icon: "Heart", description: "Community crowdfunded rewards" },
  ngo_funding: { label: "NGO Funding", color: "#22c55e", icon: "Building2", description: "Funded by NGOs for environmental monitoring" },
  government_grant: { label: "Government Grant", color: "#f59e0b", icon: "Landmark", description: "Government-funded enforcement incentives" },
  mission_rewards: { label: "Mission Rewards", color: "#a78bfa", icon: "Target", description: "Rewards for completed evidence missions" },
  community_fund: { label: "Community Fund", color: "#14b8a6", icon: "Users", description: "Community-managed reward fund" },
};

export type DistributionModel = "proportional" | "equal" | "merit_based" | "first_come";

export const DISTRIBUTION_MODEL_META: Record<DistributionModel, { label: string; description: string }> = {
  proportional: { label: "Proportional", description: "Distribute proportionally to contribution amount" },
  equal: { label: "Equal Split", description: "Split equally among all eligible contributors" },
  merit_based: { label: "Merit-Based", description: "Distribute based on contribution score (trust × quality × amount)" },
  first_come: { label: "First Come", description: "First eligible contributors receive rewards" },
};

export type ContributionType = "financial" | "evidence" | "mission_completion" | "verification" | "referral";

export const CONTRIBUTION_TYPE_META: Record<ContributionType, { label: string; baseScore: number }> = {
  financial: { label: "Financial", baseScore: 1.0 },
  evidence: { label: "Evidence", baseScore: 1.5 },
  mission_completion: { label: "Mission Completion", baseScore: 2.0 },
  verification: { label: "Verification", baseScore: 1.8 },
  referral: { label: "Referral", baseScore: 0.5 },
};

export type LedgerEntryType = "deposit" | "distribution" | "adjustment" | "reversal" | "fee";

export const LEDGER_ENTRY_META: Record<LedgerEntryType, { label: string; color: string }> = {
  deposit: { label: "Deposit", color: "#22c55e" },
  distribution: { label: "Distribution", color: "#0ea5e9" },
  adjustment: { label: "Adjustment", color: "#f59e0b" },
  reversal: { label: "Reversal", color: "#ef4444" },
  fee: { label: "Fee", color: "#64748b" },
};

/**
 * Trust tier multipliers for contribution scoring.
 * Higher trust tiers get higher score multipliers.
 */
export const TIER_MULTIPLIER: Record<string, number> = {
  elite: 2.0,
  trusted: 1.5,
  verified: 1.2,
  basic: 1.0,
  unverified: 0.5,
};

/**
 * Quality multipliers for evidence/mission-based contributions.
 */
export const QUALITY_MULTIPLIER: Record<string, number> = {
  excellent: 2.0,
  high: 1.5,
  medium: 1.0,
  low: 0.5,
};

/**
 * Compute contribution score.
 * Score = baseScore × tierMultiplier × qualityMultiplier × amountFactor
 *
 * For financial contributions: amountFactor = log(amount + 1)
 * For evidence/mission: amountFactor = 1 (fixed, quality drives the score)
 */
export function computeContributionScore(params: {
  contributionType: ContributionType;
  trustTier: string;
  qualityLevel?: string;
  amount?: number;
}): number {
  const baseScore = CONTRIBUTION_TYPE_META[params.contributionType].baseScore;
  const tierMult = TIER_MULTIPLIER[params.trustTier] ?? 1.0;
  const qualityMult = params.qualityLevel ? (QUALITY_MULTIPLIER[params.qualityLevel] ?? 1.0) : 1.0;
  const amountFactor = params.amount ? Math.log(params.amount + 1) : 1.0;

  return Math.round(baseScore * tierMult * qualityMult * amountFactor * 100) / 100;
}

/**
 * Compute merit-based distribution amounts.
 * Each contributor gets: (theirScore / totalScore) × availableFunds
 */
export function computeMeritDistribution(params: {
  availableFunds: number;
  contributors: Array<{ id: string; name: string; score: number; trustTier?: string }>;
}): Array<{ recipientId: string; recipientName: string; amount: number; score: number; percentage: number }> {
  const totalScore = params.contributors.reduce((sum, c) => sum + c.score, 0);
  if (totalScore === 0) return [];

  return params.contributors.map((c) => {
    const percentage = c.score / totalScore;
    const amount = Math.round(params.availableFunds * percentage * 100) / 100;
    return {
      recipientId: c.id,
      recipientName: c.name,
      amount,
      score: c.score,
      percentage: Math.round(percentage * 10000) / 100,
    };
  });
}

/**
 * Compute hash chain entry for the ledger (tamper-evident, same pattern as M7).
 */
export function computeLedgerHash(params: {
  entryType: string;
  amount: number;
  balance: number;
  description: string;
  prevHash: string | null;
  timestamp: Date;
}): string {
  const prev = params.prevHash ?? "GENESIS";
  const data = `${params.entryType}:${params.amount}:${params.balance}:${params.description}:${prev}:${params.timestamp.toISOString()}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Verify ledger chain integrity.
 */
export function verifyLedger(entries: Array<{ entryHash: string; prevHash: string | null; entryType: string; amount: number; balance: number; description: string; createdAt: Date }>): { valid: boolean; brokenAt: number | null } {
  let prevHash: string | null = null;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.prevHash !== prevHash) return { valid: false, brokenAt: i };
    const expectedHash = computeLedgerHash({
      entryType: entry.entryType,
      amount: entry.amount,
      balance: entry.balance,
      description: entry.description,
      prevHash: entry.prevHash,
      timestamp: entry.createdAt,
    });
    if (entry.entryHash !== expectedHash) return { valid: false, brokenAt: i };
    prevHash = entry.entryHash;
  }
  return { valid: true, brokenAt: null };
}
