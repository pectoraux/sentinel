/**
 * Sentinel — Performance Hardening Domain
 * =============================================================================
 * Scales the platform to millions of users, millions of events, and petabyte
 * imagery. Covers 6 domains:
 *   1. Users          — concurrent user capacity, auth throughput
 *   2. Events         — intelligence event ingestion rate, query throughput
 *   3. Imagery        — satellite imagery storage (petabyte), tile serving
 *   4. Caching        — multi-layer cache (CDN, Redis, app-level) hit rates
 *   5. Horizontal Scaling — auto-scaling, load balancer, partitioning
 *   6. Optimization   — query optimization, index tuning, N+1 elimination
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Performance domains
// ---------------------------------------------------------------------------

export type PerfDomain =
  | "users"
  | "events"
  | "imagery"
  | "caching"
  | "scaling"
  | "optimization";

export const DOMAIN_META: Record<
  PerfDomain,
  { label: string; color: string; icon: string; description: string; targetUsers: string; targetEvents: string }
> = {
  users: {
    label: "Users",
    color: "#0ea5e9",
    icon: "Users",
    description: "Concurrent user capacity, authentication throughput, session management at scale.",
    targetUsers: "10M+ registered users, 500K+ concurrent",
    targetEvents: "10K+ auth/sec",
  },
  events: {
    label: "Events",
    color: "#22c55e",
    icon: "Radio",
    description: "Intelligence event ingestion rate, event sourcing throughput, query performance at scale.",
    targetUsers: "100M+ events stored",
    targetEvents: "50K+ events ingested/sec",
  },
  imagery: {
    label: "Imagery",
    color: "#f59e0b",
    icon: "Satellite",
    description: "Satellite imagery storage at petabyte scale, tile serving throughput, raster pipeline.",
    targetUsers: "2 PB+ imagery stored",
    targetEvents: "10K+ tiles served/sec",
  },
  caching: {
    label: "Caching",
    color: "#a855f7",
    icon: "Zap",
    description: "Multi-layer caching: CDN (Cloudflare), Redis (app-level), browser cache. Target 95%+ hit rate.",
    targetUsers: "95%+ cache hit rate",
    targetEvents: "<5ms cache get latency",
  },
  scaling: {
    label: "Horizontal Scaling",
    color: "#14b8a6",
    icon: "Server",
    description: "Auto-scaling, load balancer, database partitioning, read replicas, stateless API servers.",
    targetUsers: "1→100 nodes auto-scale",
    targetEvents: "<60s scale-up time",
  },
  optimization: {
    label: "Optimization",
    color: "#ef4444",
    icon: "Gauge",
    description: "Query optimization, index tuning, N+1 query elimination, bundle size reduction, lazy loading.",
    targetUsers: "<100ms p95 API latency",
    targetEvents: "0 N+1 queries",
  },
};

// ---------------------------------------------------------------------------
// Capacity tiers
// ---------------------------------------------------------------------------

export type CapacityTier = "current" | "projected_6mo" | "projected_12mo";

export const CAPACITY_TIER_META: Record<
  CapacityTier,
  { label: string; color: string; description: string }
> = {
  current: { label: "Current Capacity", color: "#0ea5e9", description: "Current platform capacity" },
  projected_6mo: { label: "6-Month Projection", color: "#f59e0b", description: "Projected capacity in 6 months" },
  projected_12mo: { label: "12-Month Projection", color: "#a855f7", description: "Projected capacity in 12 months" },
};

// ---------------------------------------------------------------------------
// Load test types
// ---------------------------------------------------------------------------

export type LoadTestType = "stress" | "spike" | "soak" | "ramp" | "capacity";

export const LOAD_TEST_TYPE_META: Record<
  LoadTestType,
  { label: string; color: string; description: string }
> = {
  stress: { label: "Stress Test", color: "#ef4444", description: "Push system beyond limits to find breaking point" },
  spike: { label: "Spike Test", color: "#f59e0b", description: "Sudden traffic spike simulation" },
  soak: { label: "Soak Test", color: "#0ea5e9", description: "Sustained load over extended period (memory leaks)" },
  ramp: { label: "Ramp Test", color: "#22c55e", description: "Gradually increase load to find max throughput" },
  capacity: { label: "Capacity Test", color: "#a855f7", description: "Verify system handles target capacity" },
};

// ---------------------------------------------------------------------------
// Cache layers
// ---------------------------------------------------------------------------

export type CacheLayer = "cdn" | "redis" | "app" | "database" | "browser";

export const CACHE_LAYER_META: Record<
  CacheLayer,
  { label: string; color: string; description: string; defaultTtl: number }
> = {
  cdn: { label: "CDN (Cloudflare)", color: "#0ea5e9", description: "Edge caching for static assets + API responses", defaultTtl: 3600 },
  redis: { label: "Redis", color: "#ef4444", description: "In-memory cache for session, API response, computed data", defaultTtl: 300 },
  app: { label: "App-Level Cache", color: "#22c55e", description: "In-process LRU cache for hot data", defaultTtl: 60 },
  database: { label: "Database Cache", color: "#a855f7", description: "PostgreSQL shared buffers + query cache", defaultTtl: 0 },
  browser: { label: "Browser Cache", color: "#14b8a6", description: "Client-side cache via Cache-Control headers", defaultTtl: 86400 },
};

// ---------------------------------------------------------------------------
// Scaling event types
// ---------------------------------------------------------------------------

export type ScalingType = "scale_up" | "scale_down" | "auto_scale" | "failover" | "partition" | "migration";

export const SCALING_TYPE_META: Record<
  ScalingType,
  { label: string; color: string; description: string }
> = {
  scale_up: { label: "Scale Up", color: "#22c55e", description: "Added more instances to handle increased load" },
  scale_down: { label: "Scale Down", color: "#0ea5e9", description: "Removed instances due to decreased load" },
  auto_scale: { label: "Auto-Scale", color: "#a855f7", description: "Automatic scaling triggered by threshold" },
  failover: { label: "Failover", color: "#ef4444", description: "Failed over to standby/replica" },
  partition: { label: "Partition", color: "#f59e0b", description: "Database partition/shard added" },
  migration: { label: "Migration", color: "#14b8a6", description: "Data/service migration" },
};

// ---------------------------------------------------------------------------
// Optimization types
// ---------------------------------------------------------------------------

export type OptimizationType =
  | "query_optimization"
  | "index_addition"
  | "n+1_fix"
  | "caching_addition"
  | "code_optimization"
  | "bundle_size"
  | "image_optimization"
  | "lazy_load";

export const OPTIMIZATION_TYPE_META: Record<
  OptimizationType,
  { label: string; color: string; description: string }
> = {
  query_optimization: { label: "Query Optimization", color: "#0ea5e9", description: "Optimized SQL query (joins, subqueries, aggregation)" },
  index_addition: { label: "Index Addition", color: "#22c55e", description: "Added database index for faster lookups" },
  "n+1_fix": { label: "N+1 Fix", color: "#ef4444", description: "Eliminated N+1 query pattern" },
  caching_addition: { label: "Caching Addition", color: "#a855f7", description: "Added caching layer for expensive computation" },
  code_optimization: { label: "Code Optimization", color: "#f59e0b", description: "Algorithmic or logic optimization" },
  bundle_size: { label: "Bundle Size", color: "#14b8a6", description: "Reduced JavaScript bundle size" },
  image_optimization: { label: "Image Optimization", color: "#ec4899", description: "Image compression, WebP, responsive images" },
  lazy_load: { label: "Lazy Loading", color: "#6366f1", description: "Deferred loading of non-critical resources" },
};

// ---------------------------------------------------------------------------
// Latency targets (SLA)
// ---------------------------------------------------------------------------

export const LATENCY_TARGETS = {
  p50: 50,    // 50ms p50
  p95: 100,   // 100ms p95
  p99: 250,   // 250ms p99
  max: 1000,  // 1000ms max
} as const;

export const THROUGHPUT_TARGETS = {
  api: 10000,     // 10K req/s API
  auth: 5000,     // 5K auth/s
  eventIngest: 50000, // 50K events/s
  tileServe: 10000,   // 10K tiles/s
} as const;

// ---------------------------------------------------------------------------
// Core computation functions
// ---------------------------------------------------------------------------

/**
 * Compute the performance posture score (0-100).
 * Based on: latency compliance, cache hit rates, throughput vs target, scaling readiness.
 */
export function computePerformanceScore(metrics: Array<{
  domain: PerfDomain;
  status: string;
  value: number;
  target?: number;
}>): { score: number; level: string; color: string } {
  if (metrics.length === 0) return { score: 0, level: "Unknown", color: "#64748b" };

  const domainWeights: Record<PerfDomain, number> = {
    users: 1.0,
    events: 1.2,
    imagery: 1.0,
    caching: 1.3,
    scaling: 1.1,
    optimization: 1.0,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of metrics) {
    const weight = domainWeights[m.domain] ?? 1.0;
    let score = 1.0;
    if (m.status === "critical") score = 0.3;
    else if (m.status === "warning") score = 0.7;
    else if (m.status === "good") score = 1.0;

    weightedSum += score * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  let level: string;
  let color: string;
  if (score >= 90) { level = "Excellent"; color = "#22c55e"; }
  else if (score >= 75) { level = "Good"; color = "#0ea5e9"; }
  else if (score >= 60) { level = "Fair"; color = "#f59e0b"; }
  else if (score >= 40) { level = "Poor"; color = "#ef4444"; }
  else { level = "Critical"; color = "#dc2626"; }

  return { score, level, color };
}

/**
 * Compute cache efficiency across all layers.
 * Weighted average of hit rates, with higher layers (CDN) weighted more.
 */
export function computeCacheEfficiency(layers: Array<{
  layer: CacheLayer;
  hitRate: number;
}>): { overallHitRate: number; level: string } {
  if (layers.length === 0) return { overallHitRate: 0, level: "Unknown" };

  const layerWeights: Record<CacheLayer, number> = {
    cdn: 1.5,      // CDN hits are most valuable (avoids server entirely)
    redis: 1.2,    // Redis hits avoid DB
    app: 1.0,
    database: 0.8,
    browser: 1.0,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const l of layers) {
    const weight = layerWeights[l.layer] ?? 1.0;
    weightedSum += l.hitRate * weight;
    totalWeight += weight;
  }

  const overallHitRate = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  let level: string;
  if (overallHitRate >= 0.95) level = "Excellent";
  else if (overallHitRate >= 0.85) level = "Good";
  else if (overallHitRate >= 0.70) level = "Fair";
  else if (overallHitRate >= 0.50) level = "Poor";
  else level = "Critical";

  return { overallHitRate, level };
}

/**
 * Format a performance value for display.
 */
export function formatPerfValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "ms") return `${value.toFixed(0)}ms`;
  if (unit === "req/s") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M req/s`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K req/s`;
    return `${value.toFixed(0)} req/s`;
  }
  if (unit === "TB") return `${value.toFixed(1)}TB`;
  if (unit === "GB") return `${value.toFixed(1)}GB`;
  if (unit === "MB/s") return `${value.toFixed(0)}MB/s`;
  if (unit === "count") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toLocaleString();
  }
  return value.toLocaleString();
}
