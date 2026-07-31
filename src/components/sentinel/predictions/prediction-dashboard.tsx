"use client";

import * as React from "react";
import { Waves, Droplets, TreePine, ArrowDown, ShieldAlert, AlertTriangle, TrendingUp, Loader2, ChevronRight, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  sediment: Waves, river_impact: Droplets, forest_loss: TreePine, downstream_effects: ArrowDown, protected_area_risk: ShieldAlert,
};
const TYPE_COLOR: Record<string, string> = {
  sediment: "#f59e0b", river_impact: "#0ea5e9", forest_loss: "#22c55e", downstream_effects: "#a78bfa", protected_area_risk: "#ef4444",
};
const TYPE_LABEL: Record<string, string> = {
  sediment: "Sediment Flow", river_impact: "River Impact", forest_loss: "Forest Loss", downstream_effects: "Downstream Effects", protected_area_risk: "Protected Area Risk",
};
const RISK_COLOR: Record<string, string> = { low: "text-emerald-500", moderate: "text-amber-500", high: "text-orange-500", critical: "text-destructive" };
const RISK_BG: Record<string, string> = { low: "bg-emerald-500", moderate: "bg-amber-500", high: "bg-orange-500", critical: "bg-destructive" };

function timeAgo(d:string){const diff=Date.now()-new Date(d).getTime();const m=Math.floor(diff/60000);if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return `${h}h ago`;return `${Math.floor(h/24)}d ago`;}

export function PredictionDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [predictions, setPredictions] = React.useState<any[]>(initialSummary.recent ?? []);
  const [selected, setSelected] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/predictions/${selected.id}`).then(r=>r.json()).then(d=>setSelected(d)).catch(()=>{}).finally(()=>setLoadingDetail(false));
  }, [selected?.id]);

  const refresh = React.useCallback(async () => {
    try {
      const [s,r] = await Promise.all([fetch("/api/v1/predictions/summary",{cache:"no-store"}), fetch("/api/v1/predictions?limit=50",{cache:"no-store"})]);
      if (s.ok) { const sd=await s.json(); setSummary(sd); setPredictions(sd.recent ?? []); }
    } catch {}
  }, []);
  React.useEffect(() => { const id=setInterval(refresh,30000); return ()=>clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <PredKpi icon={Brain} label="Predictions" value={summary.total ?? 0} hint="models run" />
        <PredKpi icon={AlertTriangle} label="Avg Risk" value={`${Math.round((summary.avgRiskScore ?? 0)*100)}%`} hint="risk score" />
        <PredKpi icon={TrendingUp} label="Avg Confidence" value={`${Math.round((summary.avgConfidence ?? 0)*100)}%`} />
        <PredKpi icon={AlertTriangle} label="Critical" value={summary.criticalCount ?? 0} hint="risk level" />
        {summary.byType?.slice(0,4).map((t:any) => (
          <PredKpi key={t.type} icon={TYPE_ICON[t.type] ?? Brain} label={TYPE_LABEL[t.type] ?? t.type} value={t.count} hint={`${Math.round(t.avgRisk*100)}% risk`} />
        ))}
      </div>

      {/* Predictions + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Environmental Predictions</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">{predictions.length} predictions · weighted multi-factor</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[550px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {predictions.map((pred:any) => {
                const Icon = TYPE_ICON[pred.type] ?? Brain;
                const color = TYPE_COLOR[pred.type] ?? "#6b7280";
                return (
                  <button key={pred.id} onClick={()=>setSelected(pred)} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selected?.id===pred.id?"border-primary bg-primary/5":"border-border bg-card/50 hover:bg-accent/50")}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{backgroundColor:color+"20", color}}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{TYPE_LABEL[pred.type] ?? pred.type}</p>
                          <Badge variant="outline" className={cn("text-[9px] capitalize", RISK_COLOR[pred.riskLevel])}>{pred.riskLevel}</Badge>
                          <span className="text-[9px] text-muted-foreground">{pred.timeframe}</span>
                          <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(pred.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{pred.prediction}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">{pred.targetName}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground">Risk:</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div className={cn("h-full rounded-full", RISK_BG[pred.riskLevel] ?? "bg-muted")} style={{width:`${pred.riskScore*100}%`}} />
                            </div>
                            <span className="text-[9px] font-bold tabular-nums">{Math.round(pred.riskScore*100)}%</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground">· Conf: {Math.round(pred.confidence*100)}%</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {predictions.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No predictions yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Prediction Detail</CardTitle></div></CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? <div className="flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Risk Score</p>
                    <p className="text-3xl font-bold tabular-nums">{Math.round((selected.riskScore ?? 0)*100)}%</p>
                    <Badge variant="outline" className={cn("text-[9px] capitalize mt-1", RISK_COLOR[selected.riskLevel])}>{selected.riskLevel}</Badge>
                    <p className="text-[9px] text-muted-foreground mt-1">Confidence: {Math.round((selected.confidence ?? 0)*100)}% · {selected.timeframe}</p>
                  </div>
                  <p className="text-[11px] leading-relaxed">{selected.prediction}</p>

                  {/* Factors */}
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">Predictive Factors</p>
                    <div className="space-y-1.5">
                      {(selected.factors ?? []).map((f:any, i:number) => (
                        <div key={i} className="rounded border border-border/40 p-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium flex-1">{f.name}</span>
                            <span className="text-[9px] text-muted-foreground">w:{f.weight.toFixed(2)}</span>
                            <span className="text-[10px] font-bold tabular-nums">{(f.contribution*100).toFixed(1)}%</span>
                          </div>
                          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{width:`${f.contribution*200}%`}} />
                          </div>
                          <p className="text-[8px] text-muted-foreground mt-0.5">{f.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Affected entities */}
                  {selected.affectedEntities && selected.affectedEntities.length > 0 && (
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Affected Entities</p>
                      {selected.affectedEntities.map((e:any, i:number) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full" style={{backgroundColor: RISK_BG[e.impactLevel]?.replace("bg-","") === "emerald-500" ? "#22c55e" : RISK_BG[e.impactLevel]?.replace("bg-","") === "amber-500" ? "#f59e0b" : RISK_BG[e.impactLevel]?.replace("bg-","") === "orange-500" ? "#f97316" : "#ef4444"}} />
                          <span className="flex-1">{e.name}</span>
                          <span className="text-muted-foreground capitalize">{e.type}</span>
                          <span className={cn("font-medium capitalize", RISK_COLOR[e.impactLevel])}>{e.impactLevel}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select a prediction to see details.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk distribution + model info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Risk Distribution</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byType?.map((t:any) => {
                const Icon = TYPE_ICON[t.type] ?? Brain;
                const color = TYPE_COLOR[t.type] ?? "#6b7280";
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <Icon className="h-3 w-3 flex-shrink-0" style={{color}} />
                    <span className="w-28 text-[10px] font-medium">{TYPE_LABEL[t.type] ?? t.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{width:`${t.avgRisk*100}%`, backgroundColor:color}} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{t.count} preds</span>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{Math.round(t.avgRisk*100)}%</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Predictions</p></div>
              <div><p className="text-lg font-bold tabular-nums">{Math.round((summary.avgRiskScore ?? 0)*100)}%</p><p className="text-[9px] text-muted-foreground uppercase">Avg Risk</p></div>
              <div><p className="text-lg font-bold tabular-nums text-destructive">{summary.criticalCount ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Critical</p></div>
              <div><p className="text-lg font-bold tabular-nums">{Math.round((summary.avgConfidence ?? 0)*100)}%</p><p className="text-[9px] text-muted-foreground uppercase">Confidence</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Prediction Models</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { icon: Waves, label: "Sediment Flow", desc: "Mine proximity + excavation + satellite change + erosion potential", color: "#f59e0b" },
                { icon: Droplets, label: "River Impact", desc: "Sediment risk + pollution detections + upstream mines", color: "#0ea5e9" },
                { icon: TreePine, label: "Forest Loss", desc: "Nearby mines + CV forest_loss detections + satellite + protected status", color: "#22c55e" },
                { icon: ArrowDown, label: "Downstream Effects", desc: "Upstream risk + community count + population + water dependency", color: "#a78bfa" },
                { icon: ShieldAlert, label: "Protected Area Risk", desc: "Mine proximity + forest loss + satellite + enforcement level", color: "#ef4444" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-2">
                  <m.icon className="h-4 w-4 flex-shrink-0" style={{color:m.color}} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium">{m.label}</p>
                    <p className="text-[9px] text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-2" />
            <p className="text-[9px] text-muted-foreground font-mono">riskScore = Σ(factor_value × weight) → riskLevel mapping → timeframe + affectedEntities</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PredKpi({icon:Icon,label,value,hint}:{icon:React.ComponentType<{className?:string}>;label:string;value:number|string;hint?:string}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
