"use client";

import * as React from "react";
import {
  Users, Radio, Satellite, Zap, Server, Gauge,
  Activity, TrendingUp, CheckCircle2, AlertTriangle, AlertCircle,
  Loader2, ArrowUp, ArrowDown, Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DOMAIN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users, events: Radio, imagery: Satellite, caching: Zap, scaling: Server, optimization: Gauge,
};
const DOMAIN_COLOR: Record<string, string> = {
  users: "#0ea5e9", events: "#22c55e", imagery: "#f59e0b", caching: "#a855f7", scaling: "#14b8a6", optimization: "#ef4444",
};
const DOMAIN_LABEL: Record<string, string> = {
  users: "Users", events: "Events", imagery: "Imagery", caching: "Caching", scaling: "Scaling", optimization: "Optimization",
};
const STATUS_COLOR: Record<string, string> = {
  good: "text-emerald-500", warning: "text-amber-500", critical: "text-red-500",
};
const STATUS_BG: Record<string, string> = {
  good: "bg-emerald-500", warning: "bg-amber-500", critical: "bg-red-500",
};
const LOAD_TEST_TYPE_COLOR: Record<string, string> = {
  stress: "#ef4444", spike: "#f59e0b", soak: "#0ea5e9", ramp: "#22c55e", capacity: "#a855f7",
};
const CACHE_LAYER_COLOR: Record<string, string> = {
  cdn: "#0ea5e9", redis: "#ef4444", app: "#22c55e", database: "#a855f7", browser: "#14b8a6",
};
const SCALING_TYPE_COLOR: Record<string, string> = {
  scale_up: "#22c55e", scale_down: "#0ea5e9", auto_scale: "#a855f7", failover: "#ef4444", partition: "#f59e0b", migration: "#14b8a6",
};
const OPT_TYPE_COLOR: Record<string, string> = {
  query_optimization: "#0ea5e9", index_addition: "#22c55e", "n+1_fix": "#ef4444", caching_addition: "#a855f7",
  code_optimization: "#f59e0b", bundle_size: "#14b8a6", image_optimization: "#ec4899", lazy_load: "#6366f1",
};

function formatPerf(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "ms") return `${value.toFixed(0)}ms`;
  if (unit === "req/s") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M req/s`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K req/s`;
    return `${value.toFixed(0)} req/s`;
  }
  if (unit === "TB") return `${value.toFixed(0)}TB`;
  if (unit === "GB") return `${value.toFixed(0)}GB`;
  if (unit === "MB/s") return `${value.toFixed(0)}MB/s`;
  if (unit === "count") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  }
  return value.toLocaleString();
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PerformanceDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [activeSection, setActiveSection] = React.useState<"domains" | "loadtests" | "cache" | "scaling" | "optimizations">("domains");

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/performance/summary", { cache: "no-store" });
      if (r.ok) setSummary(await r.json());
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const scoreColor = summary.color ?? "#64748b";
  const domains = summary.domains ?? [];

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Top-level KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <PerfKpi icon={Gauge} label="Perf Score" value={`${summary.overallScore ?? 0}%`} hint={summary.level ?? "Unknown"} color={scoreColor} />
        <PerfKpi icon={Activity} label="Metrics" value={String(summary.totalMetrics ?? 0)} hint="tracked" />
        <PerfKpi icon={Zap} label="Cache Hit Rate" value={`${summary.cacheHitRate ?? 0}%`} hint={summary.cacheLevel ?? "Unknown"} color="text-purple-500" />
        <PerfKpi icon={CheckCircle2} label="Load Tests" value={`${summary.passedLoadTests ?? 0}/${summary.totalLoadTests ?? 0}`} hint={`${summary.passRate ?? 0}% pass`} color="text-emerald-500" />
        <PerfKpi icon={Server} label="Scaling Events" value={String(summary.totalScalingEvents ?? 0)} hint="total" color="text-teal-500" />
        <PerfKpi icon={TrendingUp} label="Optimizations" value={String(summary.completedOptimizations ?? 0)} hint={`${summary.pendingOptimizations ?? 0} pending`} color="text-red-500" />
        <PerfKpi icon={Users} label="Concurrent Users" value="42K" hint="of 500K target" color="text-sky-500" />
        <PerfKpi icon={Satellite} label="Imagery" value="850TB" hint="of 2PB target" color="text-amber-500" />
      </div>

      {/* Section tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
        {([
          { id: "domains", label: "6 Domains", icon: Gauge },
          { id: "loadtests", label: "Load Tests", icon: Activity },
          { id: "cache", label: "Cache", icon: Zap },
          { id: "scaling", label: "Scaling", icon: Server },
          { id: "optimizations", label: "Optimizations", icon: TrendingUp },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
              <Icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      {activeSection === "domains" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Performance Posture — 6 Domains</CardTitle></div>
              <Badge variant="outline" className="text-[10px]" style={{ color: scoreColor }}>Score: {summary.overallScore}%</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {domains.map((d: any) => {
                const Icon = DOMAIN_ICON[d.domain] ?? Gauge;
                const color = DOMAIN_COLOR[d.domain] ?? "#6b7280";
                return (
                  <div key={d.domain} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium" style={{ color }}>{DOMAIN_LABEL[d.domain] ?? d.domain}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{d.metricCount} metrics</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-0.5 text-emerald-500"><CheckCircle2 className="h-2.5 w-2.5" />{d.goodCount}</span>
                      <span className="flex items-center gap-0.5 text-amber-500"><AlertTriangle className="h-2.5 w-2.5" />{d.warningCount}</span>
                      <span className="flex items-center gap-0.5 text-red-500"><AlertCircle className="h-2.5 w-2.5" />{d.criticalCount}</span>
                    </div>
                    {/* Capacity progress bars for key metrics */}
                    {(summary.capacityMetrics ?? []).filter((m: any) => m.domain === d.domain).slice(0, 3).map((m: any) => (
                      <div key={m.metric} className="mt-2">
                        <div className="flex items-center justify-between text-[9px] mb-0.5">
                          <span className="text-muted-foreground truncate flex-1">{m.metric.replace(/_/g, " ")}</span>
                          <span className={cn("font-bold tabular-nums ml-1", STATUS_COLOR[m.status])}>{formatPerf(m.value, m.unit)}</span>
                        </div>
                        {m.target && (
                          <div className="h-1 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full", STATUS_BG[m.status])}
                              style={{ width: `${Math.min(100, (m.value / m.target) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "loadtests" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Load Test Results</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentLoadTests ?? []).map((t: any) => {
                const typeColor = LOAD_TEST_TYPE_COLOR[t.type] ?? "#6b7280";
                return (
                  <div key={t.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] capitalize" style={{ color: typeColor }}>{t.type}</Badge>
                      {t.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      <span className="text-[9px] text-muted-foreground">{t.concurrentUsers.toLocaleString()} users · {t.durationSec}s</span>
                      <span className="ml-auto text-[9px] text-muted-foreground">{t.completedAt ? timeAgo(t.completedAt) : ""}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-tight">{t.name}</p>
                    <div className="mt-1.5 flex items-center gap-4 text-[10px]">
                      <span><span className="text-muted-foreground">p50:</span> <span className="font-bold tabular-nums">{t.p50LatencyMs}ms</span></span>
                      <span><span className="text-muted-foreground">p95:</span> <span className="font-bold tabular-nums">{t.p95LatencyMs}ms</span></span>
                      <span><span className="text-muted-foreground">p99:</span> <span className="font-bold tabular-nums">{t.p99LatencyMs}ms</span></span>
                      <span><span className="text-muted-foreground">RPS:</span> <span className="font-bold tabular-nums">{formatPerf(t.requestsPerSec, "req/s")}</span></span>
                      <span className={cn("font-bold", t.errorRate < 0.5 ? "text-emerald-500" : "text-amber-500")}>{t.errorRate}% err</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "cache" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Cache Statistics — 5 Layers</CardTitle></div>
              <Badge variant="outline" className="text-[10px]" style={{ color: scoreColor }}>Overall: {summary.cacheHitRate}% ({summary.cacheLevel})</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(summary.recentCacheStats ?? []).map((c: any) => {
                const color = CACHE_LAYER_COLOR[c.layer] ?? "#6b7280";
                return (
                  <div key={c.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                        <Database className="h-3 w-3" />
                      </div>
                      <span className="text-xs font-medium">{c.cacheName}</span>
                      <Badge variant="outline" className="text-[9px]" style={{ color }}>{c.layer.toUpperCase()}</Badge>
                      <Badge variant="outline" className={cn("text-[9px]", c.status === "healthy" ? "text-emerald-500" : "text-amber-500")}>{c.status}</Badge>
                      <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color }}>{c.hitRate.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{c.hitCount.toLocaleString()} hits</span>
                      <span>{c.missCount.toLocaleString()} misses</span>
                      <span>{c.entryCount.toLocaleString()} entries</span>
                      <span>GET {c.avgGetLatencyMs}ms</span>
                      <span>TTL {c.defaultTtlSec}s</span>
                    </div>
                    {/* Hit rate bar */}
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${c.hitRate}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "scaling" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Server className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Scaling Events</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentScalingEvents ?? []).map((e: any) => {
                const color = SCALING_TYPE_COLOR[e.type] ?? "#6b7280";
                return (
                  <div key={e.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] capitalize" style={{ color }}>{e.type.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-[9px] capitalize">{e.resource}</Badge>
                      <span className="text-[9px] text-muted-foreground">via {e.trigger.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(e.triggeredAt)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-tight">{e.description}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                      <span className="font-bold tabular-nums">{e.fromCount}</span>
                      <ArrowRight />
                      <span className="font-bold tabular-nums" style={{ color }}>{e.toCount}</span>
                      {e.durationSec && <span className="text-muted-foreground">· {e.durationSec}s</span>}
                      {e.impactNotes && <span className="text-muted-foreground truncate">· {e.impactNotes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "optimizations" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Optimization Records</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentOptimizations ?? []).map((o: any) => {
                const color = OPT_TYPE_COLOR[o.type] ?? "#6b7280";
                return (
                  <div key={o.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px]" style={{ color }}>{o.type.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", o.status === "completed" ? "text-emerald-500" : o.status === "in_progress" ? "text-amber-500" : "text-muted-foreground")}>{o.status.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", o.impactLevel === "critical" ? "text-red-500" : o.impactLevel === "high" ? "text-amber-500" : "text-muted-foreground")}>{o.impactLevel}</Badge>
                      <span className="ml-auto text-[9px] text-muted-foreground">{o.implementedAt ? timeAgo(o.implementedAt) : timeAgo(o.proposedAt)}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-tight">{o.title}</p>
                    <code className="text-[9px] font-mono text-muted-foreground mt-0.5 block">{o.target}</code>
                    {o.improvementPct != null && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground">{o.metricName}:</span>
                        <span className="text-red-500 line-through">{o.beforeMetric}{o.metricUnit}</span>
                        <ArrowRight />
                        <span className="text-emerald-500 font-bold">{o.afterMetric}{o.metricUnit}</span>
                        <Badge variant="default" className="text-[9px] bg-emerald-500">{o.improvementPct}% better</Badge>
                      </div>
                    )}
                    {o.impactNotes && <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{o.impactNotes}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ArrowRight() {
  return <span className="text-muted-foreground">→</span>;
}
function XCircle({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}

function PerfKpi({ icon: Icon, label, value, hint, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-3.5 w-3.5 text-muted-foreground", color)} />
        {hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}
      </div>
      <p className={cn("mt-2 text-xl font-bold tabular-nums leading-none", color)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
