"use client";

import * as React from "react";
import { Brain, Users, Satellite, Plane, Cpu, ShieldCheck, ThumbsUp, AlertTriangle, TrendingUp, Loader2, ChevronRight, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  ai_detection: Brain, citizen_report: Users, satellite_imagery: Satellite,
  drone_survey: Plane, sensor_log: Cpu, government_inspection: ShieldCheck, corroboration: ThumbsUp,
};
const SOURCE_COLOR: Record<string, string> = {
  ai_detection: "#ef4444", citizen_report: "#a78bfa", satellite_imagery: "#0ea5e9",
  drone_survey: "#14b8a6", sensor_log: "#f59e0b", government_inspection: "#22c55e", corroboration: "#8b5cf6",
};
const CONSENSUS_COLOR: Record<string, string> = {
  unanimous: "text-emerald-500", strong: "text-sky-500", moderate: "text-amber-500", weak: "text-orange-500", divided: "text-destructive",
};
const SEVERITY_COLOR: Record<string, string> = { low: "text-sky-500", medium: "text-amber-500", high: "text-orange-500", critical: "text-destructive" };

export function FusionDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [results, setResults] = React.useState<any[]>(initialSummary.top ?? []);
  const [selected, setSelected] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/fusion/${selected.id}`).then(r => r.json()).then(d => setSelected(d)).catch(() => {}).finally(() => setLoadingDetail(false));
  }, [selected?.id]);

  const refresh = React.useCallback(async () => {
    try {
      const [s, r] = await Promise.all([fetch("/api/v1/fusion/summary", {cache:"no-store"}), fetch("/api/v1/fusion?limit=50", {cache:"no-store"})]);
      if (s.ok) { const sd = await s.json(); setSummary(sd); setResults(sd.top ?? []); }
    } catch {}
  }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <FuseKpi icon={Layers} label="Fusions" value={summary.total ?? 0} hint="events fused" />
        <FuseKpi icon={TrendingUp} label="Avg Confidence" value={`${Math.round((summary.avgConfidence ?? 0)*100)}%`} hint="fused score" />
        <FuseKpi icon={AlertTriangle} label="Conflicts" value={summary.conflicts ?? 0} hint={`${((summary.conflictRate ?? 0)*100).toFixed(0)}% rate`} />
        <FuseKpi icon={Brain} label="Total Sources" value={summary.sourceTypes?.reduce((a:number,s:any)=>a+s.count,0) ?? 0} hint="evidence items" />
        {summary.sourceTypes?.slice(0, 4).map((s: any) => (
          <FuseKpi key={s.type} icon={SOURCE_ICON[s.type] ?? Layers} label={s.label} value={s.count} hint={`${Math.round(s.avgConfidence*100)}% conf`} />
        ))}
      </div>

      {/* Results + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Fused Confidence Rankings</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">{results.length} results · weighted Bayesian</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[550px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {results.map((r: any) => (
                <button key={r.id} onClick={() => setSelected(r)} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selected?.id === r.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50")}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <span className="text-sm font-bold tabular-nums">{Math.round(r.fusedConfidence*100)}%</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{r.locationName || "Fusion result"}</p>
                        <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[r.fusedSeverity])}>{r.fusedSeverity}</Badge>
                        <span className={cn("text-[9px] capitalize", CONSENSUS_COLOR[r.consensusLevel])}>{r.consensusLevel}</span>
                        {r.hasConflict && <Badge variant="outline" className="text-[9px] text-destructive">CONFLICT</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {/* Source type dots */}
                        {Object.entries(r.sourceBreakdown || {}).map(([type, count]: [string, any]) => (
                          <span key={type} className="flex items-center gap-0.5 text-[9px]">
                            {(() => { const Icon = SOURCE_ICON[type] ?? Layers; return <Icon className="h-2.5 w-2.5" style={{color: SOURCE_COLOR[type]}} />; })()}
                            <span className="font-bold">{count}</span>
                          </span>
                        ))}
                        <span className="ml-auto text-[9px] text-muted-foreground">{r.sourceCount} sources</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {results.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No fusion results yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Source Breakdown</CardTitle></div></CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? <div className="flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : (
                <div className="space-y-3">
                  {/* Fused score */}
                  <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Fused Confidence</p>
                    <p className="text-3xl font-bold tabular-nums">{Math.round((selected.fusedConfidence ?? 0)*100)}%</p>
                    <Badge variant="outline" className={cn("text-[9px] capitalize mt-1", SEVERITY_COLOR[selected.fusedSeverity])}>{selected.fusedSeverity}</Badge>
                    <p className={cn("text-[9px] capitalize mt-1", CONSENSUS_COLOR[selected.consensusLevel])}>{selected.consensusLevel} consensus</p>
                  </div>

                  {/* Source list */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Sources ({selected.sources?.length ?? 0})</p>
                    <div className="max-h-48 space-y-1 overflow-y-auto -mr-2 pr-2">
                      {selected.sources?.map((s: any, i: number) => {
                        const Icon = SOURCE_ICON[s.sourceType] ?? Layers;
                        const color = SOURCE_COLOR[s.sourceType] ?? "#6b7280";
                        return (
                          <div key={i} className="rounded border border-border/60 bg-card/40 p-2">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3 w-3 flex-shrink-0" style={{color}} />
                              <span className="text-[10px] font-medium capitalize flex-1">{s.sourceType.replace(/_/g," ")}</span>
                              <span className="text-[10px] font-bold tabular-nums">{Math.round(s.rawConfidence*100)}%</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-[8px] text-muted-foreground">w:{s.weight.toFixed(2)}</span>
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full" style={{width:`${(s.weightedScore/0.3)*100}%`, backgroundColor:color}} />
                              </div>
                              <span className="text-[8px] font-mono text-muted-foreground">{s.weightedScore.toFixed(3)}</span>
                            </div>
                            {s.description && <p className="mt-0.5 text-[8px] text-muted-foreground truncate">{s.description}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conflict */}
                  {selected.hasConflict && selected.conflictDetails && (
                    <div className="rounded border border-destructive/30 bg-destructive/5 p-2">
                      <p className="text-[10px] font-medium text-destructive flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Conflict Detected</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{selected.conflictDetails.description}</p>
                      <p className="text-[9px] text-muted-foreground">Spread: {Math.round(selected.conflictDetails.spread*100)}%</p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select a fusion result to see source breakdown.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Source distribution + algorithm */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Sources by Type</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.sourceTypes?.map((s: any) => {
                const Icon = SOURCE_ICON[s.type] ?? Layers;
                const maxCount = Math.max(...(summary.sourceTypes?.map((st:any)=>st.count) ?? [1]), 1);
                const pct = (s.count / maxCount) * 100;
                return (
                  <div key={s.type} className="flex items-center gap-2">
                    <Icon className="h-3 w-3 flex-shrink-0" style={{color: s.color}} />
                    <span className="w-28 text-[10px] font-medium">{s.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{width:`${pct}%`, backgroundColor: s.color}} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{s.count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Fusions</p></div>
              <div><p className="text-lg font-bold tabular-nums">{Math.round((summary.avgConfidence ?? 0)*100)}%</p><p className="text-[9px] text-muted-foreground uppercase">Avg Conf</p></div>
              <div><p className="text-lg font-bold tabular-nums text-destructive">{summary.conflicts ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Conflicts</p></div>
              <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.byConsensus?.find((c:any)=>c.level==="unanimous")?.count ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Unanimous</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Fusion Algorithm</CardTitle></div></CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-3">Weighted Bayesian fusion merges evidence from 6 source types into one confidence score. Higher-reliability sources have more influence.</p>
            <div className="space-y-2">
              {Object.entries({
                ai_detection: { label: "AI Detection", weight: "25%", reliability: "85%" },
                satellite_imagery: { label: "Satellite Imagery", weight: "20%", reliability: "90%" },
                citizen_report: { label: "Citizen Report", weight: "15%", reliability: "60%" },
                drone_survey: { label: "Drone Survey", weight: "15%", reliability: "85%" },
                sensor_log: { label: "Sensor Log", weight: "10%", reliability: "95%" },
                government_inspection: { label: "Gov Inspection", weight: "10%", reliability: "98%" },
                corroboration: { label: "Corroboration", weight: "5%", reliability: "75%" },
              }).map(([key, meta]) => {
                const Icon = SOURCE_ICON[key] ?? Layers;
                const color = SOURCE_COLOR[key] ?? "#6b7280";
                return (
                  <div key={key} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-2">
                    <Icon className="h-4 w-4 flex-shrink-0" style={{color}} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium">{meta.label}</p>
                      <p className="text-[9px] text-muted-foreground">Weight: {meta.weight} · Reliability: {meta.reliability}</p>
                    </div>
                    <div className="text-right">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{width: meta.weight, backgroundColor: color}} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator className="my-2" />
            <p className="text-[9px] text-muted-foreground font-mono">fusedConfidence = Σ(src_conf × weight × reliability) / Σ(weight × reliability)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FuseKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
