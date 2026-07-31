"use client";

import * as React from "react";
import {
  FlaskConical,
  ShieldCheck,
  Droplets,
  Ban,
  Plane,
  Layers,
  Minus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Trees,
  Activity,
  Loader2,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  baseline: Minus,
  increase_inspections: ShieldCheck,
  protect_watershed: Droplets,
  close_roads: Ban,
  deploy_drones: Plane,
  combined: Layers,
};
const TYPE_COLOR: Record<string, string> = {
  baseline: "#64748b",
  increase_inspections: "#0ea5e9",
  protect_watershed: "#14b8a6",
  close_roads: "#f59e0b",
  deploy_drones: "#a855f7",
  combined: "#ef4444",
};
const TYPE_LABEL: Record<string, string> = {
  baseline: "Baseline",
  increase_inspections: "Increase Inspections",
  protect_watershed: "Protect Watershed",
  close_roads: "Close Roads",
  deploy_drones: "Deploy Drones",
  combined: "Combined",
};

function formatGHS(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₵${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₵${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₵${abs}`;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SimulationDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [scenarios, setScenarios] = React.useState<any[]>(initialSummary.recentScenarios ?? []);
  const [selected, setSelected] = React.useState<any>(null);
  const [detail, setDetail] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);
  const [comparison, setComparison] = React.useState<any>(null);

  // What-if builder state
  const [builderType, setBuilderType] = React.useState<string>("increase_inspections");
  const [builderParams, setBuilderParams] = React.useState<Record<string, number>>({
    inspectionIncreasePct: 50,
    inspectorCount: 5,
  });
  const [builderHorizon, setBuilderHorizon] = React.useState<number>(6);
  const [builderRegion, setBuilderRegion] = React.useState<string>("Western");

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/simulations/summary", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setSummary(d);
        setScenarios(d.recentScenarios ?? []);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/simulations/scenarios/${selected.id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selected?.id]);

  // Run a new simulation from the builder
  const runSimulation = React.useCallback(async () => {
    setRunning(true);
    try {
      const interventionParams: Record<string, number> = { ...builderParams };
      if (builderType === "increase_inspections") {
        interventionParams.inspectionIncreasePct = builderParams.inspectionIncreasePct ?? 50;
        interventionParams.inspectorCount = builderParams.inspectorCount ?? 5;
      } else if (builderType === "protect_watershed") {
        interventionParams.bufferZoneM = builderParams.bufferZoneM ?? 100;
        interventionParams.riversProtected = builderParams.riversProtected ?? 5;
      } else if (builderType === "close_roads") {
        interventionParams.roadsClosed = builderParams.roadsClosed ?? 5;
        interventionParams.checkpointsDeployed = builderParams.checkpointsDeployed ?? 3;
      } else if (builderType === "deploy_drones") {
        interventionParams.droneCount = builderParams.droneCount ?? 3;
        interventionParams.coverageAreaKm2 = builderParams.coverageAreaKm2 ?? 100;
        interventionParams.patrolFrequencyPerWeek = builderParams.patrolFrequencyPerWeek ?? 3;
      } else if (builderType === "combined") {
        // Use all params
      }

      const typeLabel = TYPE_LABEL[builderType] ?? builderType;
      const res = await fetch("/api/v1/simulations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${typeLabel} — ${builderRegion} (${builderHorizon}mo)`,
          description: `What if we ${typeLabel.toLowerCase()} in ${builderRegion}?`,
          interventionType: builderType,
          interventionParams,
          timeHorizonMonths: builderHorizon,
          region: builderRegion,
          locationName: builderRegion,
        }),
      });
      if (res.ok) {
        await refresh();
      }
    } catch {} finally {
      setRunning(false);
    }
  }, [builderType, builderParams, builderHorizon, builderRegion, refresh]);

  // Compare all non-baseline scenarios
  const compareAll = React.useCallback(async () => {
    setComparing(true);
    try {
      const nonBaseline = scenarios.filter((s) => !s.isBaseline).map((s) => s.id);
      if (nonBaseline.length < 2) return;
      const res = await fetch("/api/v1/simulations/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "All Scenarios Comparison",
          scenarioIds: nonBaseline,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setComparison(data.results);
      }
    } catch {} finally {
      setComparing(false);
    }
  }, [scenarios]);

  // Update builder params when type changes
  const onTypeChange = (type: string) => {
    setBuilderType(type);
    if (type === "increase_inspections") {
      setBuilderParams({ inspectionIncreasePct: 50, inspectorCount: 5 });
    } else if (type === "protect_watershed") {
      setBuilderParams({ bufferZoneM: 100, riversProtected: 5 });
    } else if (type === "close_roads") {
      setBuilderParams({ roadsClosed: 5, checkpointsDeployed: 3 });
    } else if (type === "deploy_drones") {
      setBuilderParams({ droneCount: 3, coverageAreaKm2: 100, patrolFrequencyPerWeek: 3 });
    } else if (type === "combined") {
      setBuilderParams({ inspectionIncreasePct: 50, inspectorCount: 5, bufferZoneM: 100, riversProtected: 5, roadsClosed: 5, checkpointsDeployed: 3, droneCount: 3, coverageAreaKm2: 100, patrolFrequencyPerWeek: 3 });
    }
  };

  // Get param config for current builder type
  const paramConfig: Record<string, { key: string; label: string; min: number; max: number; step: number }> = {
    increase_inspections: { key: "inspectionIncreasePct", label: "Inspection Increase (%)", min: 10, max: 200, step: 10 },
    protect_watershed: { key: "bufferZoneM", label: "Buffer Zone (m)", min: 50, max: 500, step: 50 },
    close_roads: { key: "roadsClosed", label: "Roads Closed", min: 1, max: 30, step: 1 },
    deploy_drones: { key: "droneCount", label: "Drones Deployed", min: 1, max: 20, step: 1 },
  };

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <SimKpi icon={FlaskConical} label="Scenarios" value={summary.totalScenarios ?? 0} hint="total" />
        <SimKpi icon={Minus} label="Baselines" value={summary.baselineCount ?? 0} hint="controls" />
        <SimKpi icon={Layers} label="Interventions" value={summary.interventionScenarios ?? 0} hint="tested" />
        <SimKpi icon={Trophy} label="Best Net Benefit" value={summary.bestScenario ? formatGHS(summary.bestScenario.netBenefitGHS) : "—"} hint={summary.bestScenario?.type} />
        <SimKpi icon={DollarSign} label="Total Impact" value={formatGHS(summary.totalEconomicImpactGHS ?? 0)} hint="damages avoided" />
        <SimKpi icon={Activity} label="Total Cost" value={formatGHS(summary.totalEnforcementCostGHS ?? 0)} hint="enforcement" />
        <SimKpi icon={TrendingUp} label="Net Benefit" value={formatGHS(summary.totalNetBenefitGHS ?? 0)} hint="all scenarios" />
        <SimKpi icon={Sparkles} label="Comparisons" value={summary.totalComparisons ?? 0} hint="run" />
      </div>

      {/* What-if builder */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">"What if?" Scenario Builder</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Intervention type selector */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Intervention Type</p>
              <div className="flex flex-wrap gap-2">
                {["increase_inspections", "protect_watershed", "close_roads", "deploy_drones", "combined"].map((type) => {
                  const Icon = TYPE_ICON[type] ?? Layers;
                  const color = TYPE_COLOR[type] ?? "#6b7280";
                  const isActive = builderType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => onTypeChange(type)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isActive ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50",
                      )}
                      style={isActive ? { borderColor: color } : {}}
                    >
                      <Icon className="h-3 w-3" style={{ color }} />
                      {TYPE_LABEL[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Region */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Region</label>
                <select
                  value={builderRegion}
                  onChange={(e) => setBuilderRegion(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {["Western", "Ashanti", "Eastern", "Central", "Western North"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {/* Time horizon */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Time Horizon</label>
                <select
                  value={builderHorizon}
                  onChange={(e) => setBuilderHorizon(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {[1, 3, 6, 12, 24].map((m) => (
                    <option key={m} value={m}>{m} months</option>
                  ))}
                </select>
              </div>
              {/* Primary param slider */}
              {builderType !== "baseline" && builderType !== "combined" && paramConfig[builderType] && (
                <>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">{paramConfig[builderType].label}</label>
                    <input
                      type="range"
                      min={paramConfig[builderType].min}
                      max={paramConfig[builderType].max}
                      step={paramConfig[builderType].step}
                      value={builderParams[paramConfig[builderType].key] ?? paramConfig[builderType].min}
                      onChange={(e) => setBuilderParams({ ...builderParams, [paramConfig[builderType].key]: Number(e.target.value) })}
                      className="mt-2 w-full"
                    />
                    <p className="text-[10px] font-bold tabular-nums">{builderParams[paramConfig[builderType].key] ?? paramConfig[builderType].min}</p>
                  </div>
                  {/* Secondary param */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Secondary Parameter</label>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {builderType === "increase_inspections" && `${builderParams.inspectorCount ?? 5} inspectors`}
                      {builderType === "protect_watershed" && `${builderParams.riversProtected ?? 5} rivers`}
                      {builderType === "close_roads" && `${builderParams.checkpointsDeployed ?? 3} checkpoints`}
                      {builderType === "deploy_drones" && `${builderParams.coverageAreaKm2 ?? 100} km² coverage`}
                    </p>
                  </div>
                </>
              )}
              {builderType === "combined" && (
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground">Combined: all 4 interventions at default intensity (inspections +50%, 5 rivers, 5 roads, 3 drones)</p>
                </div>
              )}
            </div>

            {/* Run button */}
            <div className="flex items-center gap-2">
              <button
                onClick={runSimulation}
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                Run Simulation
              </button>
              <button
                onClick={compareAll}
                disabled={comparing || scenarios.filter((s) => !s.isBaseline).length < 2}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent/50 disabled:opacity-50"
              >
                {comparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                Compare All
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Simulation Scenarios</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">{scenarios.length} scenarios</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[480px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {scenarios.map((s: any) => {
                const Icon = TYPE_ICON[s.type] ?? Layers;
                const color = TYPE_COLOR[s.type] ?? "#6b7280";
                const isPositive = s.netBenefitGHS > 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      selected?.id === s.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px]" style={{ color }}>{TYPE_LABEL[s.type] ?? s.type}</Badge>
                          {s.isBaseline && <Badge variant="outline" className="text-[9px] text-muted-foreground">BASELINE</Badge>}
                          <span className="text-[9px] text-muted-foreground">{s.timeHorizonMonths}mo · {s.region}</span>
                          <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(s.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium leading-tight line-clamp-1">{s.name}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                          <span className={cn("flex items-center gap-0.5 font-medium", s.illegalMiningRateChange <= 0 ? "text-emerald-500" : "text-red-500")}>
                            {s.illegalMiningRateChange <= 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
                            {Math.abs(s.illegalMiningRateChange).toFixed(1)}% mining
                          </span>
                          {s.waterQualityChange > 0 && <span className="text-sky-500">+{s.waterQualityChange.toFixed(1)}% water</span>}
                          {s.forestCoverChangeHa > 0 && <span className="text-emerald-500">{s.forestCoverChangeHa.toFixed(0)}ha forest</span>}
                          <span className={cn("font-bold ml-auto", isPositive ? "text-emerald-500" : "text-red-500")}>
                            {isPositive ? "+" : ""}{formatGHS(s.netBenefitGHS)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {scenarios.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No scenarios yet. Run a simulation above.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Outcome Detail</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : detail ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[9px]" style={{ color: TYPE_COLOR[detail.type] }}>{TYPE_LABEL[detail.type]}</Badge>
                      <span className="text-[9px] text-muted-foreground">{detail.timeHorizonMonths} months · {detail.region}</span>
                    </div>
                    <p className="text-xs font-medium leading-tight">{detail.name}</p>
                  </div>

                  {/* Outcome metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <OutcomeBox label="Mining Rate" value={`${detail.illegalMiningRateChange > 0 ? "+" : ""}${detail.illegalMiningRateChange.toFixed(1)}%`} good={detail.illegalMiningRateChange <= 0} icon={detail.illegalMiningRateChange <= 0 ? TrendingDown : TrendingUp} />
                    <OutcomeBox label="Water Quality" value={`${detail.waterQualityChange > 0 ? "+" : ""}${detail.waterQualityChange.toFixed(1)}%`} good={detail.waterQualityChange > 0} icon={Droplets} />
                    <OutcomeBox label="Forest Saved" value={`${detail.forestCoverChangeHa.toFixed(0)} ha`} good={detail.forestCoverChangeHa > 0} icon={Trees} />
                    <OutcomeBox label="Confidence" value={`${Math.round(detail.confidence * 100)}%`} good={detail.confidence >= 0.7} icon={CheckCircle2} />
                  </div>

                  {/* Financial summary */}
                  <div className="rounded border border-border/40 p-2 space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Economic Impact:</span><span className="font-bold text-emerald-500">{formatGHS(detail.economicImpactGHS)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Enforcement Cost:</span><span className="font-bold text-amber-500">{formatGHS(detail.enforcementCostGHS)}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between"><span className="font-medium">Net Benefit:</span><span className={cn("font-bold", detail.netBenefitGHS > 0 ? "text-emerald-500" : "text-red-500")}>{detail.netBenefitGHS > 0 ? "+" : ""}{formatGHS(detail.netBenefitGHS)}</span></div>
                  </div>

                  {/* Time series chart */}
                  {detail.outcomes && detail.outcomes.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Projected Over Time</p>
                      <div className="space-y-1.5">
                        {detail.outcomes.map((point: any) => (
                          <div key={point.month} className="flex items-center gap-2 text-[10px]">
                            <span className="w-8 text-muted-foreground">M{point.month}</span>
                            <div className="flex-1 flex items-center gap-1">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${Math.min(100, Math.abs(point.illegalMiningRate))}%` }}
                                />
                              </div>
                              <span className="text-emerald-500 font-medium tabular-nums w-10 text-right">{point.illegalMiningRate.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {detail.explanation && (
                    <div className="rounded border border-border/40 bg-card/40 p-2">
                      <p className="text-[9px] text-muted-foreground uppercase mb-1">Explanation</p>
                      <p className="text-[10px] leading-tight">{detail.explanation}</p>
                    </div>
                  )}

                  {/* Factors breakdown */}
                  {detail.factorsBreakdown && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Key Factors</p>
                      <div className="space-y-1">
                        {Object.entries(detail.factorsBreakdown).map(([key, factor]: [string, any]) => (
                          <div key={key} className="rounded border border-border/40 p-1.5">
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="font-medium capitalize flex-1 truncate">{key.replace(/_/g, " ")}</span>
                              <Badge variant="outline" className="text-[8px]">{(factor.weight * 100).toFixed(0)}%</Badge>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{factor.contribution}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">Failed to load.</p>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select a scenario to see predicted outcomes.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison results */}
      {comparison && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Scenario Comparison</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {comparison.scenarios && (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Scenario</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Mining Δ</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Water Δ</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Forest (ha)</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Impact</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cost</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Net Benefit</th>
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.scenarios.map((s: any) => {
                      const rank = comparison.ranking?.find((r: any) => r.scenarioId === s.id)?.rank ?? 0;
                      const isBest = s.id === comparison.bestScenarioId;
                      return (
                        <tr key={s.id} className={cn("border-b border-border/40", isBest && "bg-emerald-500/5")}>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5">
                              {isBest && <Trophy className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                              <span className="font-medium truncate">{s.name}</span>
                            </div>
                          </td>
                          <td className={cn("text-right py-2 px-2 tabular-nums", s.illegalMiningRateChange <= 0 ? "text-emerald-500" : "text-red-500")}>
                            {s.illegalMiningRateChange > 0 ? "+" : ""}{s.illegalMiningRateChange.toFixed(1)}%
                          </td>
                          <td className={cn("text-right py-2 px-2 tabular-nums", s.waterQualityChange > 0 ? "text-sky-500" : "text-muted-foreground")}>
                            +{s.waterQualityChange.toFixed(1)}%
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums text-emerald-500">{s.forestCoverChangeHa.toFixed(0)}</td>
                          <td className="text-right py-2 px-2 tabular-nums text-emerald-500">{formatGHS(s.economicImpactGHS)}</td>
                          <td className="text-right py-2 px-2 tabular-nums text-amber-500">{formatGHS(s.enforcementCostGHS)}</td>
                          <td className={cn("text-right py-2 px-2 font-bold tabular-nums", s.netBenefitGHS > 0 ? "text-emerald-500" : "text-red-500")}>
                            {s.netBenefitGHS > 0 ? "+" : ""}{formatGHS(s.netBenefitGHS)}
                          </td>
                          <td className="text-center py-2 px-2">
                            <Badge variant={isBest ? "default" : "outline"} className="text-[9px]">#{rank}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Intervention type reference */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">5 Intervention Types</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { type: "increase_inspections", question: "What if we increase inspections by 50%?", desc: "More EPA/Minerals Commission inspectors on the ground", maxReduction: "35%", cost: "₵3,500/inspector/mo" },
              { type: "protect_watershed", question: "What if we protect the watershed?", desc: "Buffer zones around rivers, ban mining near waterways", maxReduction: "20%", cost: "₵8,000/river/mo" },
              { type: "close_roads", question: "What if we close access roads?", desc: "Block heavy equipment transport routes", maxReduction: "40%", cost: "₵2,500/checkpoint/mo" },
              { type: "deploy_drones", question: "What if we deploy drones?", desc: "Continuous aerial surveillance of high-risk areas", maxReduction: "25%", cost: "₵6,000/drone/mo" },
              { type: "combined", question: "What if we combine interventions?", desc: "Multiple interventions for synergistic effect", maxReduction: "60%", cost: "varies" },
              { type: "baseline", question: "What happens if we do nothing?", desc: "Current trajectory — no policy changes", maxReduction: "0%", cost: "₵0" },
            ].map((item) => {
              const Icon = TYPE_ICON[item.type] ?? Layers;
              const color = TYPE_COLOR[item.type] ?? "#6b7280";
              return (
                <div key={item.type} className="rounded border border-border/40 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
                    <span className="text-[11px] font-medium" style={{ color }}>{TYPE_LABEL[item.type]}</span>
                  </div>
                  <p className="text-[10px] font-medium italic mb-1">"{item.question}"</p>
                  <p className="text-[9px] text-muted-foreground leading-tight mb-1.5">{item.desc}</p>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-muted-foreground">Max reduction:</span>
                    <span className="font-bold text-emerald-500">{item.maxReduction}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-muted-foreground">Cost:</span>
                    <span className="font-medium text-amber-500">{item.cost}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SimKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function OutcomeBox({ label, value, good, icon: Icon }: { label: string; value: string; good: boolean; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className={cn("rounded border p-2 text-center", good ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/40 bg-card/40")}>
      <Icon className={cn("h-3 w-3 mx-auto mb-0.5", good ? "text-emerald-500" : "text-muted-foreground")} />
      <p className={cn("text-sm font-bold tabular-nums", good ? "text-emerald-500" : "text-muted-foreground")}>{value}</p>
      <p className="text-[8px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
