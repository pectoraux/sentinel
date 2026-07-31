/**
 * Sentinel — Performance Hardening Service
 * =============================================================================
 * Tracks performance metrics across 6 domains, load test results, cache stats,
 * scaling events, and optimization records. Computes overall performance score.
 * =============================================================================
 */

import { db } from "@/lib/db";
import {
  computePerformanceScore,
  computeCacheEfficiency,
  type PerfDomain,
} from "../../domain/performance-types";

export class PerformanceService {
  // ===========================================================================
  // PERFORMANCE POSTURE — all 6 domains
  // ===========================================================================

  async getPerformancePosture(): Promise<{
    overallScore: number;
    level: string;
    color: string;
    domains: Array<{
      domain: PerfDomain;
      label: string;
      color: string;
      metricCount: number;
      goodCount: number;
      warningCount: number;
      criticalCount: number;
    }>;
  }> {
    // Get latest metrics per domain
    const allDomains = ["users", "events", "imagery", "caching", "scaling", "optimization"] as PerfDomain[];
    const domainMetrics = await db.perfMetric.findMany({
      where: { capacityTier: "current" },
      select: { domain: true, status: true, value: true, target: true },
    });

    const domains = allDomains.map((domain) => {
      const metrics = domainMetrics.filter((m) => m.domain === domain);
      return {
        domain,
        label: domain.charAt(0).toUpperCase() + domain.slice(1),
        color: domain === "users" ? "#0ea5e9" : domain === "events" ? "#22c55e" : domain === "imagery" ? "#f59e0b" : domain === "caching" ? "#a855f7" : domain === "scaling" ? "#14b8a6" : "#ef4444",
        metricCount: metrics.length,
        goodCount: metrics.filter((m) => m.status === "good").length,
        warningCount: metrics.filter((m) => m.status === "warning").length,
        criticalCount: metrics.filter((m) => m.status === "critical").length,
      };
    });

    const { score, level, color } = computePerformanceScore(domainMetrics);

    return { overallScore: score, level, color, domains };
  }

  // ===========================================================================
  // LOAD TESTS
  // ===========================================================================

  async listLoadTests(params?: { type?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const tests = await db.loadTestRun.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return { tests };
  }

  // ===========================================================================
  // CACHE STATS
  // ===========================================================================

  async listCacheStats(params?: { layer?: string; limit?: number }) {
    const { limit = 50, layer } = params ?? {};
    const where: Record<string, unknown> = {};
    if (layer) where.layer = layer;

    const stats = await db.cacheStats.findMany({
      where,
      take: limit,
      orderBy: { recordedAt: "desc" },
    });

    // Compute overall cache efficiency
    const efficiency = computeCacheEfficiency(
      stats.map((s) => ({ layer: s.layer as any, hitRate: s.hitRate / 100 })),
    );

    return { stats, overallHitRate: efficiency.overallHitRate, level: efficiency.level };
  }

  // ===========================================================================
  // SCALING EVENTS
  // ===========================================================================

  async listScalingEvents(params?: { type?: string; resource?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.resource) where.resource = filters.resource;

    const events = await db.scalingEvent.findMany({
      where,
      take: limit,
      orderBy: { triggeredAt: "desc" },
    });

    return { events };
  }

  // ===========================================================================
  // OPTIMIZATIONS
  // ===========================================================================

  async listOptimizations(params?: { type?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const records = await db.optimizationRecord.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return { records };
  }

  // ===========================================================================
  // METRICS
  // ===========================================================================

  async listMetrics(params?: { domain?: string; capacityTier?: string; limit?: number }) {
    const { limit = 100, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.domain) where.domain = filters.domain;
    if (filters.capacityTier) where.capacityTier = filters.capacityTier;

    const metrics = await db.perfMetric.findMany({
      where,
      take: limit,
      orderBy: { recordedAt: "desc" },
    });

    return { metrics };
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  async summary() {
    const posture = await this.getPerformancePosture();

    const [
      totalMetrics,
      totalLoadTests,
      passedLoadTests,
      totalCacheLayers,
      totalScalingEvents,
      totalOptimizations,
      completedOptimizations,
      recentLoadTests,
      recentCacheStats,
      recentScalingEvents,
      recentOptimizations,
      capacityMetrics,
    ] = await Promise.all([
      db.perfMetric.count(),
      db.loadTestRun.count(),
      db.loadTestRun.count({ where: { passed: true } }),
      db.cacheStats.count(),
      db.scalingEvent.count(),
      db.optimizationRecord.count(),
      db.optimizationRecord.count({ where: { status: "completed" } }),
      db.loadTestRun.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
      db.cacheStats.findMany({ take: 10, orderBy: { recordedAt: "desc" } }),
      db.scalingEvent.findMany({ take: 8, orderBy: { triggeredAt: "desc" } }),
      db.optimizationRecord.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
      db.perfMetric.findMany({
        where: { capacityTier: "current" },
        select: { domain: true, metric: true, value: true, unit: true, target: true, targetLabel: true, status: true, description: true },
      }),
    ]);

    // Compute cache efficiency
    const cacheEfficiency = computeCacheEfficiency(
      recentCacheStats.map((c) => ({ layer: c.layer as any, hitRate: c.hitRate / 100 })),
    );

    // Compute capacity projections
    const projections = await db.perfMetric.groupBy({
      by: ["capacityTier"],
      _count: true,
    });

    return {
      // Overall posture
      overallScore: posture.overallScore,
      level: posture.level,
      color: posture.color,
      domainCount: posture.domains.length,

      // Metrics
      totalMetrics,

      // Load tests
      totalLoadTests,
      passedLoadTests,
      passRate: totalLoadTests > 0 ? Math.round((passedLoadTests / totalLoadTests) * 100) : 0,

      // Cache
      totalCacheLayers,
      cacheHitRate: Math.round(cacheEfficiency.overallHitRate * 100),
      cacheLevel: cacheEfficiency.level,

      // Scaling
      totalScalingEvents,

      // Optimizations
      totalOptimizations,
      completedOptimizations,
      pendingOptimizations: totalOptimizations - completedOptimizations,

      // Capacity projections
      projections: projections.map((p) => ({ tier: p.capacityTier, count: p._count })),

      // Recent items
      recentLoadTests: recentLoadTests.map((t) => ({
        id: t.id, key: t.key, name: t.name, type: t.type, status: t.status,
        targetEndpoint: t.targetEndpoint,
        concurrentUsers: t.concurrentUsers, durationSec: t.durationSec,
        totalRequests: t.totalRequests, errorRate: t.errorRate,
        p50LatencyMs: t.p50LatencyMs, p95LatencyMs: t.p95LatencyMs, p99LatencyMs: t.p99LatencyMs,
        requestsPerSec: t.requestsPerSec,
        passed: t.passed,
        completedAt: t.completedAt,
      })),
      recentCacheStats: recentCacheStats.map((c) => ({
        id: c.id, layer: c.layer, cacheName: c.cacheName,
        hitRate: c.hitRate, hitCount: c.hitCount, missCount: c.missCount,
        sizeBytes: c.sizeBytes, entryCount: c.entryCount,
        avgGetLatencyMs: c.avgGetLatencyMs,
        status: c.status,
        recordedAt: c.recordedAt,
      })),
      recentScalingEvents: recentScalingEvents.map((e) => ({
        id: e.id, key: e.key, type: e.type, resource: e.resource,
        trigger: e.trigger, description: e.description,
        fromCount: e.fromCount, toCount: e.toCount,
        status: e.status, durationSec: e.durationSec,
        triggeredAt: e.triggeredAt,
      })),
      recentOptimizations: recentOptimizations.map((o) => ({
        id: o.id, key: o.key, title: o.title, type: o.type,
        target: o.target, status: o.status,
        beforeMetric: o.beforeMetric, afterMetric: o.afterMetric,
        metricUnit: o.metricUnit, metricName: o.metricName,
        improvementPct: o.improvementPct, impactLevel: o.impactLevel,
        impactNotes: o.impactNotes,
        implementedAt: o.implementedAt,
      })),

      // Domain breakdown
      domains: posture.domains,

      // Capacity metrics (key metrics per domain)
      capacityMetrics: capacityMetrics.map((m) => ({
        domain: m.domain,
        metric: m.metric,
        value: m.value,
        unit: m.unit,
        target: m.target,
        targetLabel: m.targetLabel,
        status: m.status,
        description: m.description,
      })),
    };
  }
}

let _svc: PerformanceService | null = null;
export function getPerformanceService(): PerformanceService {
  if (!_svc) _svc = new PerformanceService();
  return _svc;
}
