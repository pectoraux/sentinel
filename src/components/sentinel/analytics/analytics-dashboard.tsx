"use client";

import * as React from "react";
import {
  Crosshair,
  Leaf,
  Clock,
  Users,
  Shield,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Target,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  hotspots: Crosshair,
  environmental: Leaf,
  response_times: Clock,
  community: Users,
  trust: Shield,
  rewards: Award,
};
const CATEGORY_COLOR: Record<string, string> = {
  hotspots: "#ef4444",
  environmental: "#22c55e",
  response_times: "#f59e0b",
  community: "#0ea5e9",
  trust: "#a855f7",
  rewards: "#14b8a6",
};
const CATEGORY_LABEL: Record<string, string> = {
  hotspots: "Hotspots",
  environmental: "Environmental KPIs",
  response_times: "Response Times",
  community: "Community Engagement",
  trust: "Trust Metrics",
  rewards: "Reward Metrics",
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  good: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertCircle,
  neutral: Minus,
};
const STATUS_COLOR: Record<string, string> = {
  good: "text-emerald-500",
  warning: "text-amber-500",
  critical: "text-red-500",
  neutral: "text-muted-foreground",
};

function formatKpiValue(value: number, unit: string): string {
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

export function AnalyticsDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [categoryData, setCategoryData] = React.useState<any>(null);
  const [loadingCategory, setLoadingCategory] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/analytics/summary", { cache: "no-store" });
      if (r.ok) setSummary(await r.json());
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Fetch detailed KPIs when a category is selected
  React.useEffect(() => {
    if (!selectedCategory) {
      setCategoryData(null);
      return;
    }
    setLoadingCategory(true);
    fetch(`/api/v1/analytics/category/${selectedCategory}`)
      .then((r) => r.json())
      .then((d) => setCategoryData(d))
      .catch(() => {})
      .finally(() => setLoadingCategory(false));
  }, [selectedCategory]);

  const categories = summary.categories ?? [];

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Top-level KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <AnalyticsKpi icon={BarChart3} label="Categories" value={String(summary.totalCategories ?? 6)} hint="tracked" />
        <AnalyticsKpi icon={Activity} label="Total KPIs" value={String(summary.totalKpis ?? 0)} hint="metrics" />
        <AnalyticsKpi icon={CheckCircle2} label="Good" value={String(summary.totalGood ?? 0)} hint="on target" color="text-emerald-500" />
        <AnalyticsKpi icon={AlertTriangle} label="Warning" value={String(summary.totalWarning ?? 0)} hint="near target" color="text-amber-500" />
        <AnalyticsKpi icon={AlertCircle} label="Critical" value={String(summary.totalCritical ?? 0)} hint="off target" color="text-red-500" />
        <AnalyticsKpi icon={Target} label="Health Score" value={`${summary.healthScore ?? 0}%`} hint="overall" color="text-primary" />
      </div>

      {/* 6 Category cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat: any) => {
          const Icon = CATEGORY_ICON[cat.category] ?? Activity;
          const color = CATEGORY_COLOR[cat.category] ?? "#6b7280";
          const isSelected = selectedCategory === cat.category;
          return (
            <button
              key={cat.category}
              onClick={() => setSelectedCategory(isSelected ? null : cat.category)}
              className={cn(
                "text-left rounded-lg border p-4 transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/50",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{cat.label}</p>
                    <Badge variant="outline" className="text-[9px]" style={{ color }}>
                      {cat.kpiCount} KPIs
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>

                  {/* Health score bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${cat.healthScore}%`,
                          backgroundColor: cat.healthScore >= 70 ? "#22c55e" : cat.healthScore >= 40 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums">{cat.healthScore}%</span>
                  </div>

                  {/* Status summary */}
                  <div className="mt-2 flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-0.5 text-emerald-500"><CheckCircle2 className="h-2.5 w-2.5" />{cat.good}</span>
                    <span className="flex items-center gap-0.5 text-amber-500"><AlertTriangle className="h-2.5 w-2.5" />{cat.warning}</span>
                    <span className="flex items-center gap-0.5 text-red-500"><AlertCircle className="h-2.5 w-2.5" />{cat.critical}</span>
                  </div>

                  {/* Top KPIs preview */}
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {cat.topKpis?.slice(0, 4).map((kpi: any) => (
                      <div key={kpi.key} className="rounded border border-border/40 p-1">
                        <p className="text-[8px] text-muted-foreground truncate">{kpi.label}</p>
                        <p className={cn("text-[11px] font-bold tabular-nums", STATUS_COLOR[kpi.status ?? "neutral"])}>
                          {formatKpiValue(kpi.value, kpi.unit)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down: detailed KPIs for selected category */}
      {selectedCategory && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = CATEGORY_ICON[selectedCategory] ?? Activity;
                  const color = CATEGORY_COLOR[selectedCategory] ?? "#6b7280";
                  return <Icon className="h-4 w-4" style={{ color }} />;
                })()}
                <CardTitle className="text-sm">{CATEGORY_LABEL[selectedCategory] ?? selectedCategory} — Detailed KPIs</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">{categoryData?.kpis?.length ?? 0} metrics</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCategory ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : categoryData?.kpis ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categoryData.kpis.map((kpi: any) => {
                  const StatusIcon = STATUS_ICON[kpi.status ?? "neutral"] ?? Minus;
                  const statusColor = STATUS_COLOR[kpi.status ?? "neutral"];
                  return (
                    <div key={kpi.key} className="rounded-lg border border-border/60 bg-card/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium leading-tight">{kpi.label}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{kpi.description}</p>
                        </div>
                        <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", statusColor)} />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className={cn("text-lg font-bold tabular-nums", statusColor)}>
                          {formatKpiValue(kpi.value, kpi.unit)}
                        </span>
                        {kpi.targetLabel && (
                          <span className="text-[9px] text-muted-foreground">{kpi.targetLabel}</span>
                        )}
                      </div>
                      {/* Target progress bar */}
                      {kpi.target != null && (
                        <div className="mt-1.5">
                          <div className="h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full transition-all",
                                kpi.status === "good" ? "bg-emerald-500" : kpi.status === "warning" ? "bg-amber-500" : kpi.status === "critical" ? "bg-red-500" : "bg-muted-foreground",
                              )}
                              style={{
                                width: kpi.goodDirection === "up"
                                  ? `${Math.min(100, (kpi.value / kpi.target) * 100)}%`
                                  : `${Math.min(100, (kpi.target / Math.max(kpi.value, kpi.target, 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No data available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analytics overview chart — category health comparison */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Category Health Comparison</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categories.map((cat: any) => {
              const color = CATEGORY_COLOR[cat.category] ?? "#6b7280";
              const Icon = CATEGORY_ICON[cat.category] ?? Activity;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color }} />
                  <span className="w-32 text-[10px] font-medium truncate">{cat.label}</span>
                  <div className="flex-1 h-3 overflow-hidden rounded-full bg-muted flex">
                    {/* Good portion */}
                    <div className="h-full bg-emerald-500" style={{ width: `${(cat.good / cat.kpiCount) * 100}%` }} title={`${cat.good} good`} />
                    {/* Warning portion */}
                    <div className="h-full bg-amber-500" style={{ width: `${(cat.warning / cat.kpiCount) * 100}%` }} title={`${cat.warning} warning`} />
                    {/* Critical portion */}
                    <div className="h-full bg-red-500" style={{ width: `${(cat.critical / cat.kpiCount) * 100}%` }} title={`${cat.critical} critical`} />
                    {/* Neutral portion */}
                    <div className="h-full bg-muted-foreground/30" style={{ width: `${(cat.neutral / cat.kpiCount) * 100}%` }} title={`${cat.neutral} neutral`} />
                  </div>
                  <span className="w-10 text-right text-[10px] font-bold tabular-nums">{cat.healthScore}%</span>
                </div>
              );
            })}
          </div>
          <Separator className="my-3" />
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Good (on target)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warning (near target)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Critical (off target)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> Neutral (no target)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsKpi({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
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
