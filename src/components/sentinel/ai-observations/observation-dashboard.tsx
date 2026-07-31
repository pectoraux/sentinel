"use client";

import * as React from "react";
import { Brain, TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, FileText, Network, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_COLOR: Record<string, string> = {
  excavation: "#ef4444", roads: "#64748b", tailings: "#f97316", forest_loss: "#22c55e",
  water_changes: "#0ea5e9", buildings: "#a78bfa", equipment: "#14b8a6",
};
const SEVERITY_COLOR: Record<string, string> = { low:"text-sky-500", medium:"text-amber-500", high:"text-orange-500", critical:"text-destructive" };
const TREND_ICON: Record<string, React.ComponentType<{className?:string}>> = { increasing: TrendingUp, decreasing: TrendingDown, stable: Minus, new: Sparkles };
const TREND_COLOR: Record<string, string> = { increasing: "text-destructive", decreasing: "text-emerald-500", stable: "text-muted-foreground", new: "text-sky-500" };

function timeAgo(d:string){const diff=Date.now()-new Date(d).getTime();const m=Math.floor(diff/60000);if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return `${h}h ago`;return `${Math.floor(h/24)}d ago`;}

export function ObservationDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [observations, setObservations] = React.useState<any[]>(initialSummary.recent ?? []);
  const [selected, setSelected] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/ai-observations/${selected.id}`).then(r=>r.json()).then(d=>setSelected(d)).catch(()=>{}).finally(()=>setLoadingDetail(false));
  }, [selected?.id]);

  const refresh = React.useCallback(async () => {
    try {
      const [s, r] = await Promise.all([fetch("/api/v1/ai-observations/summary",{cache:"no-store"}), fetch("/api/v1/ai-observations?limit=50",{cache:"no-store"})]);
      if (s.ok) setSummary(await s.json());
      if (r.ok) { const d = await r.json(); setObservations(d.observations ?? []); }
    } catch {}
  }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <ObsKpi icon={Brain} label="Observations" value={summary.total ?? 0} hint="AI-generated" />
        <ObsKpi icon={AlertTriangle} label="With Events" value={summary.withIntelEvents ?? 0} hint="linked" />
        <ObsKpi icon={TrendingUp} label="Avg Confidence" value={`${Math.round((summary.avgConfidence ?? 0)*100)}%`} />
        <ObsKpi icon={AlertTriangle} label="Critical" value={summary.bySeverity?.find((s:any)=>s.severity==="critical")?.count ?? 0} hint="severity" />
        {Object.entries(TYPE_COLOR).slice(0,4).map(([key,color]) => {
          const td = summary.byType?.find((t:any)=>t.type===key);
          return <ObsKpi key={key} icon={Brain} label={key.replace(/_/g," ")} value={td?.count ?? 0} hint={td?`${Math.round(td.avgConfidence*100)}%`:"none"} />;
        })}
      </div>

      {/* Observations + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">AI Observation Feed</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">{observations.length} observations · {summary.withIntelEvents ?? 0} linked to events</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[550px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {observations.map((obs:any) => {
                const TrendIcon = TREND_ICON[obs.historicalComparison?.trend ?? "new"] ?? Sparkles;
                return (
                  <button key={obs.id} onClick={() => setSelected(obs)} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selected?.id === obs.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50")}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{backgroundColor:(TYPE_COLOR[obs.type]??"#6b7280")+"20", color:TYPE_COLOR[obs.type]??"#6b7280"}}>
                        <Brain className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{obs.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{obs.summary}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{backgroundColor:TYPE_COLOR[obs.type]??"#6b7280"}} />
                          <span className="capitalize">{obs.type.replace(/_/g," ")}</span>
                          <span>·</span>
                          <span className={cn("font-medium capitalize", SEVERITY_COLOR[obs.severity])}>{obs.severity}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <span className="h-1 w-10 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{width:`${obs.confidence*100}%`, backgroundColor:TYPE_COLOR[obs.type]??"#6b7280"}} /></span>
                            <span className="font-bold tabular-nums">{Math.round(obs.confidence*100)}%</span>
                          </span>
                          {obs.historicalComparison?.trend && (
                            <>
                              <span>·</span>
                              <span className={cn("flex items-center gap-0.5 capitalize", TREND_COLOR[obs.historicalComparison.trend])}>
                                <TrendIcon className="h-2.5 w-2.5" />
                                {obs.historicalComparison.trend}
                              </span>
                            </>
                          )}
                          <span className="ml-auto">{timeAgo(obs.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {observations.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No AI observations yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Observation Detail</CardTitle></div></CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? <div className="flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{selected.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{selected.summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[9px] capitalize" style={{color:TYPE_COLOR[selected.type]}}>{selected.type.replace(/_/g," ")}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[selected.severity])}>{selected.severity}</Badge>
                    <Badge variant="outline" className="text-[9px]">{Math.round(selected.confidence*100)}% confidence</Badge>
                  </div>

                  {/* Reasoning */}
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5 flex items-center gap-1"><Brain className="h-2.5 w-2.5" /> AI Reasoning</p>
                    <div className="space-y-1">
                      {(selected.reasoningSteps ?? []).map((step:string, i:number) => (
                        <p key={i} className="text-[10px] leading-relaxed">{step}</p>
                      ))}
                      {!selected.reasoningSteps && <p className="text-[10px] whitespace-pre-wrap">{selected.reasoning}</p>}
                    </div>
                  </div>

                  {/* Evidence */}
                  {selected.evidenceSummary && (
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> Evidence</p>
                      <p className="text-[10px]">{selected.evidenceSummary}</p>
                    </div>
                  )}

                  {/* Affected entities */}
                  {selected.affectedEntitiesSummary && (
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1"><Network className="h-2.5 w-2.5" /> Affected Entities</p>
                      <p className="text-[10px]">{selected.affectedEntitiesSummary}</p>
                    </div>
                  )}

                  {/* Historical comparison */}
                  {selected.historicalComparison && (
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Historical Comparison</p>
                      <div className="text-[10px] space-y-0.5">
                        <p>Previous observations: {selected.historicalComparison.previousCount ?? 0}</p>
                        <p>Trend: <span className={cn("font-medium capitalize", TREND_COLOR[selected.historicalComparison.trend])}>{selected.historicalComparison.trend}</span></p>
                        {selected.historicalComparison.changePercent !== undefined && (
                          <p>Change: {selected.historicalComparison.changePercent > 0 ? "+" : ""}{selected.historicalComparison.changePercent}%</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Intel event link */}
                  {selected.intelligenceEventId && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <ChevronRight className="h-2.5 w-2.5" />
                      Linked to Intelligence Event
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select an observation to see details.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Type distribution + features */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Detection Trends</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.trends?.map((t:any) => (
                <div key={t.type} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{backgroundColor:TYPE_COLOR[t.type]??"#6b7280"}} />
                  <span className="w-24 text-[10px] font-medium capitalize">{t.type.replace(/_/g," ")}</span>
                  <span className="text-[9px] text-muted-foreground">{t.count} obs</span>
                  <div className="flex-1 flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">min {Math.round(t.minConfidence*100)}%</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted relative">
                      <div className="absolute h-full rounded-full bg-muted-foreground/30" style={{left:`${t.minConfidence*100}%`, width:`${(t.maxConfidence-t.minConfidence)*100}%`}} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">max {Math.round(t.maxConfidence*100)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Observations</p></div>
              <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.withIntelEvents ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Intel Events</p></div>
              <div><p className="text-lg font-bold tabular-nums">{Math.round((summary.avgConfidence ?? 0)*100)}%</p><p className="text-[9px] text-muted-foreground uppercase">Avg Conf</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Engine Features</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { icon: Brain, label: "AI-Created Events", desc: "VLM detections automatically create Intelligence Events", color: "#ef4444" },
                { icon: FileText, label: "Evidence Storage", desc: "Linked CV detection results with full provenance", color: "#22c55e" },
                { icon: TrendingUp, label: "Confidence Tracking", desc: "Per-observation confidence from VLM analysis", color: "#0ea5e9" },
                { icon: Brain, label: "AI Reasoning", desc: "Structured chain-of-thought explaining each observation", color: "#8b5cf6" },
                { icon: Network, label: "Affected Entities", desc: "Twin entities mapped via Knowledge Graph (M6)", color: "#f59e0b" },
                { icon: Clock, label: "Historical Comparison", desc: "Trend analysis vs prior observations (new/increasing/decreasing/stable)", color: "#14b8a6" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-2">
                  <f.icon className="h-4 w-4 flex-shrink-0" style={{color:f.color}} />
                  <div className="min-w-0 flex-1"><p className="text-[11px] font-medium">{f.label}</p><p className="text-[9px] text-muted-foreground">{f.desc}</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ObsKpi({icon:Icon,label,value,hint}:{icon:React.ComponentType<{className?:string}>;label:string;value:number|string;hint?:string}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
