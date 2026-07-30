/**
 * Sentinel — Feature Flag bounded context
 * =============================================================================
 * Production-grade feature flag service with multiple rollout strategies:
 *   - boolean: on/off globally
 *   - percentage: rollout to a % of users (deterministic bucketing)
 *   - segment: targeted rollout by user attributes
 *   - environment: per-environment gating
 *
 * Evaluation is cached in-memory (short TTL) and refreshed on change via the
 * event bus. Future milestones gate AI/Digital-Twin capabilities behind flags.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { config } from "@/config";

export type FlagStrategy = "boolean" | "percentage" | "segment" | "environment";

export interface FlagEvaluationContext {
  userId?: string;
  roles?: string[];
  environment?: string;
  attributes?: Record<string, unknown>;
}

interface FlagRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  strategy: FlagStrategy;
  config: Record<string, unknown> | null;
  segments: Array<{ name: string; rule: Record<string, unknown>; priority: number }>;
  expiresAt: number;
}

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, FlagRecord>();

export class FeatureFlagService {
  async list() {
    const flags = await db.featureFlag.findMany({
      include: { segments: { orderBy: { priority: "asc" } } },
      orderBy: { key: "asc" },
    });
    return flags.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      enabled: f.enabled,
      rolloutPercentage: f.rolloutPercentage,
      strategy: f.strategy,
      config: f.config ? JSON.parse(f.config) : null,
      segments: f.segments.map((s) => ({
        name: s.name,
        rule: JSON.parse(s.rule),
        priority: s.priority,
      })),
      updatedAt: f.updatedAt,
    }));
  }

  async evaluate(key: string, ctx: FlagEvaluationContext = {}): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag || !flag.enabled) return false;

    switch (flag.strategy) {
      case "boolean":
        return true;
      case "environment":
        return (
          (flag.config as { environments?: string[] })?.environments?.includes(
            ctx.environment ?? config.NODE_ENV,
          ) ?? false
        );
      case "percentage":
        if (!ctx.userId) return false;
        return bucket(ctx.userId, key) < flag.rolloutPercentage;
      case "segment":
        return this.evaluateSegments(flag, ctx);
      default:
        return false;
    }
  }

  async toggle(key: string, enabled: boolean, updatedBy?: string): Promise<void> {
    await db.featureFlag.update({
      where: { key },
      data: { enabled, updatedById: updatedBy },
    });
    cache.delete(key);
    logger.info("feature_flag.toggled", { key, enabled });
  }

  async create(params: {
    key: string;
    name: string;
    description?: string;
    strategy?: FlagStrategy;
    rolloutPercentage?: number;
    config?: Record<string, unknown>;
    enabled?: boolean;
    createdById?: string;
  }): Promise<void> {
    await db.featureFlag.create({
      data: {
        key: params.key,
        name: params.name,
        description: params.description,
        strategy: params.strategy ?? "boolean",
        rolloutPercentage: params.rolloutPercentage ?? 0,
        config: params.config ? JSON.stringify(params.config) : null,
        enabled: params.enabled ?? false,
        createdById: params.createdById,
      },
    });
    logger.info("feature_flag.created", { key: params.key });
  }

  private async getFlag(key: string): Promise<FlagRecord | null> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const flag = await db.featureFlag.findUnique({
      where: { key },
      include: { segments: { orderBy: { priority: "asc" } } },
    });
    if (!flag) return null;

    const record: FlagRecord = {
      id: flag.id,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      strategy: flag.strategy as FlagStrategy,
      config: flag.config ? JSON.parse(flag.config) : null,
      segments: flag.segments.map((s) => ({
        name: s.name,
        rule: JSON.parse(s.rule),
        priority: s.priority,
      })),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    cache.set(key, record);
    return record;
  }

  private evaluateSegments(flag: FlagRecord, ctx: FlagEvaluationContext): boolean {
    for (const seg of flag.segments) {
      if (this.matchRule(seg.rule, ctx)) {
        // segment config can specify enabled/disabled
        return (seg.rule as { enabled?: boolean })?.enabled !== false;
      }
    }
    return false;
  }

  private matchRule(rule: Record<string, unknown>, ctx: FlagEvaluationContext): boolean {
    if (rule.roles && ctx.roles) {
      const wanted = rule.roles as string[];
      if (!wanted.some((r) => ctx.roles!.includes(r))) return false;
    }
    if (rule.userId && ctx.userId !== rule.userId) return false;
    if (rule.environment && (ctx.environment ?? config.NODE_ENV) !== rule.environment)
      return false;
    return true;
  }

  invalidateAll(): void {
    cache.clear();
  }
}

/**
 * Deterministic percentage bucketing.
 * Same (userId, flagKey) always yields the same bucket → no flapping.
 */
function bucket(userId: string, flagKey: string): number {
  const hash = createHashStable(`${flagKey}:${userId}`);
  return hash % 100;
}

function createHashStable(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

let instance: FeatureFlagService | null = null;
export function getFeatureFlagService(): FeatureFlagService {
  if (!instance) instance = new FeatureFlagService();
  return instance;
}

// ---------------------------------------------------------------------------
// Default flag catalogue (seeded)
// ---------------------------------------------------------------------------

export const DEFAULT_FLAGS: Array<{
  key: string;
  name: string;
  description: string;
  strategy: FlagStrategy;
  enabled: boolean;
}> = [
  {
    key: "platform.foundation",
    name: "Platform Foundation",
    description: "Foundation dashboard availability (Milestone 1)",
    strategy: "boolean",
    enabled: true,
  },
  {
    key: "auth.oauth_providers",
    name: "OAuth Providers",
    description: "Enable Google/GitHub/Azure AD sign-in",
    strategy: "boolean",
    enabled: false,
  },
  {
    key: "intelligence.engine",
    name: "Intelligence Engine",
    description: "AI detection pipeline (Milestone 2)",
    strategy: "percentage",
    enabled: false,
  },
  {
    key: "digital_twin.viewer",
    name: "Digital Twin Viewer",
    description: "3D environmental simulation (Milestone 3)",
    strategy: "percentage",
    enabled: false,
  },
  {
    key: "community.reporting",
    name: "Community Reporting",
    description: "Citizen intelligence submission flow",
    strategy: "boolean",
    enabled: false,
  },
  {
    key: "maintenance_mode",
    name: "Maintenance Mode",
    description: "Gates write operations during deployments",
    strategy: "boolean",
    enabled: false,
  },
];
