"use client";

import * as React from "react";
import {
  Zap, Search, Satellite, AlertTriangle, Send, Brain, Eye, CheckCircle2,
  Loader2, ChevronRight, TrendingUp, TrendingDown, Minus, Sparkles, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PHASE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  triggered: Zap, gathering_context: Search, analyzing_imagery: Satellite, identifying_impacts: AlertTriangle,
  requesting_evidence: Send, reasoning: Brain, monitoring: Eye, concluded: CheckCircle2,
};
const PHASE_COLOR: Record<string, string> = {
  triggered: "#f59e0b", gathering_context: "#0ea5e9", analyzing_imagery: "#a855f7", identifying_impacts: "#ef4444",
  requesting_evidence: "#14b8a6", reasoning: "#6366f1", monitoring: "#3b82f6", concluded: "#22c55e",
};
const PHASE_LABEL: Record<string, string> = {
  triggered: "Triggered", gathering_context: "Gathering Context", analyzing_imagery: "Analyzing Imagery",
  identifying_impacts: "Identifying Impacts", requesting_evidence: "Requesting Evidence",
  reasoning: "Reasoning", monitoring: "Monitoring", concluded: "Concluded",
};
const TRIGGER_COLOR: Record<string, string> = {
  citizen_report: "#0ea5e9", digital_twin: "#6366f1", satellite_change: "#a855f7",
  cv_detection: "#ef4444", ai_observation: "#14b8a6", fraud_alert: "#dc2626", manual: "#64748b",
};
const TRIGGER_LABEL: Record<string, string> = {
  citizen_report: "Citizen Report", digital_twin: "Digital Twin", satellite_change: "Satellite Change",
  cv_detection: "CV Detection", ai_observation: "AI Observation", fraud_alert: "Fraud Alert", manual: "Manual",
};
const CONFIDENCE_COLOR: Record<string, string> = {
  very_low: "#dc2626", low: "#ef4444", uncertain: "#f59e0b", moderate: "#0ea5e9", high: "#22c55e", very_high: "#14b8a6",
};
const ACTION_COLOR: Record<string, string> = {
  dispatch_inspector: "#ef4444", request_drone: "#a855f7", wait_for_corroboration: "#f59e0b",
  escalate: "#dc2626", dismiss: "#64748b", monitor: "#0ea5e9", request_lab_analysis: "#14b8a6", notify_agency: "#6366f1",
};
const ACTION_LABEL: Record<string, string> = {
  dispatch_inspector: "Dispatch Inspector", request_drone: "Request Drone", wait_for_corroboration: "Wait for Corroboration",
  escalate: "Escalate", dismiss: "Dismiss", monitor: "Monitor", request_lab_analysis: "Request Lab Analysis", notify_agency: "Notify Agency",
};

function timeAgo(d: string) { const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }

export function AutonomousDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [selected, setSelected] = React.useState<any>(null);
  const [detail, setDetail] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const refresh = React.useCallback(async () => { try { const r = await fetch("/api/v1/autonomous/summary", { cache: "no-store" }); if (r.ok) setSummary(await r.json()); } catch {} }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/autonomous/investigations/${selected.id}`).then(r => r.json()).then(d => setDetail(d)).catch(() => {}).finally(() => setLoadingDetail(false));
  }, [selected?.id]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <AutoKpi icon={Sparkles} label="Investigations" value={String(summary.totalInvestigations ?? 0)} hint="total" color="text-primary" />
        <AutoKpi icon={Activity} label="Active" value={String(summary.activeInvestigations ?? 0)} hint="monitoring" color="text-sky-500" />
        <AutoKpi icon={CheckCircle2} label="Concluded" value={String(summary.concludedInvestigations ?? 0)} hint="completed" color="text-emerald-500" />
        <AutoKpi icon={Brain} label="Avg Confidence" value={`${summary.avgConfidence ?? 0}%`} hint="across all" color="text-purple-500" />
        <AutoKpi icon={Send} label="Evidence Reqs" value={String(summary.totalEvidenceRequests ?? 0)} hint={`${summary.pendingEvidenceRequests ?? 0} pending`} color="text-teal-500" />
        <AutoKpi icon={ChevronRight} label="Recommendations" value={String(summary.totalRecommendations ?? 0)} hint={`${summary.pendingRecommendations ?? 0} pending`} color="text-amber-500" />
        <AutoKpi icon={Zap} label="Auto-Triggered" value={String(summary.totalInvestigations ?? 0)} hint="by AI" color="text-orange-500" />
        <AutoKpi icon={TrendingUp} label="Confidence Trend" value={summary.avgConfidence >= 60 ? "↑ Rising" : "→ Stable"} hint="avg" color={summary.avgConfidence >= 60 ? "text-emerald-500" : "text-muted-foreground"} />
      </div>

      {/* Investigation feed + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Autonomous Investigations</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">AI-Powered · 7-Phase Workflow</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentInvestigations ?? []).map((inv: any) => {
                const triggerColor = TRIGGER_COLOR[inv.triggerSource] ?? "#6b7280";
                const confColor = CONFIDENCE_COLOR[inv.confidenceLevel] ?? "#6b7280";
                return (
                  <button key={inv.id} onClick={() => setSelected(inv)} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selected?.id === inv.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50")}>
                    <div className="flex items-start gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: triggerColor + "20", color: triggerColor }}>
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px]" style={{ color: triggerColor }}>{TRIGGER_LABEL[inv.triggerSource] ?? inv.triggerSource}</Badge>
                          <Badge variant="outline" className="text-[9px] capitalize">{inv.currentPhase.replace(/_/g, " ")}</Badge>
                          <Badge variant="outline" className={cn("text-[9px] capitalize", inv.confidenceTrend === "increasing" ? "text-emerald-500" : inv.confidenceTrend === "decreasing" ? "text-red-500" : "text-muted-foreground")}>
                            {inv.confidenceTrend === "increasing" ? "↑" : inv.confidenceTrend === "decreasing" ? "↓" : "→"} {inv.confidenceLevel.replace(/_/g, " ")}
                          </Badge>
                          <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(inv.triggeredAt)}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium leading-tight line-clamp-2">{inv.title}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                          {/* Confidence bar */}
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">Confidence:</span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${inv.confidence * 100}%`, backgroundColor: confColor }} /></div>
                            <span className="font-bold tabular-nums" style={{ color: confColor }}>{Math.round(inv.confidence * 100)}%</span>
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{inv.historicalEventsFound} hist</span>
                          <span className="text-muted-foreground">· {inv.satelliteChangesDetected} sat</span>
                          <span className="text-muted-foreground">· {inv.affectedEntitiesCount} affected</span>
                          {inv.recommendedAction && <Badge variant="outline" className="text-[8px] ml-auto" style={{ color: ACTION_COLOR[inv.recommendedAction] ?? "#6b7280" }}>{ACTION_LABEL[inv.recommendedAction] ?? inv.recommendedAction}</Badge>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {(!summary.recentInvestigations || summary.recentInvestigations.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No autonomous investigations yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Investigation Detail</CardTitle></div></CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : detail ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[9px]" style={{ color: TRIGGER_COLOR[detail.triggerSource] ?? "#6b7280" }}>{TRIGGER_LABEL[detail.triggerSource] ?? detail.triggerSource}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", detail.status === "concluded" ? "text-emerald-500" : "text-sky-500")}>{detail.status}</Badge>
                    </div>
                    <p className="text-xs font-medium leading-tight">{detail.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{detail.locationName} · {detail.region}</p>
                  </div>

                  {/* Confidence gauge */}
                  <div className="rounded border border-border/40 p-2 text-center" style={{ borderColor: (CONFIDENCE_COLOR[detail.confidenceLevel] ?? "#6b7280") + "40" }}>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: CONFIDENCE_COLOR[detail.confidenceLevel] ?? "#6b7280" }}>{Math.round(detail.confidence * 100)}%</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{detail.confidenceLevel.replace(/_/g, " ")} confidence · {detail.confidenceTrend}</p>
                  </div>

                  {/* Evidence gathered */}
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded border border-border/40 p-1.5"><p className="text-sm font-bold">{detail.historicalEventsFound}</p><p className="text-[8px] text-muted-foreground uppercase">Historical</p></div>
                    <div className="rounded border border-border/40 p-1.5"><p className="text-sm font-bold">{detail.satelliteChangesDetected}</p><p className="text-[8px] text-muted-foreground uppercase">Satellite</p></div>
                    <div className="rounded border border-border/40 p-1.5"><p className="text-sm font-bold">{detail.affectedEntitiesCount}</p><p className="text-[8px] text-muted-foreground uppercase">Affected</p></div>
                  </div>

                  {/* Phase timeline */}
                  {detail.phases?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">7-Phase Investigation Timeline</p>
                      <div className="space-y-2">
                        {detail.phases.map((phase: any, i: number) => {
                          const Icon = PHASE_ICON[phase.phase] ?? Activity;
                          const color = PHASE_COLOR[phase.phase] ?? "#6b7280";
                          return (
                            <div key={phase.id} className="flex items-start gap-2">
                              <div className="flex flex-col items-center">
                                <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", phase.status === "completed" ? "" : "opacity-50")} style={{ backgroundColor: color + "20", color }}>
                                  <Icon className="h-2.5 w-2.5" />
                                </div>
                                {i < detail.phases.length - 1 && <div className="w-px h-3 bg-border" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-medium">{PHASE_LABEL[phase.phase] ?? phase.phase}</p>
                                <p className="text-[9px] text-muted-foreground line-clamp-2">{phase.description}</p>
                                {phase.status === "completed" && phase.durationMs != null && <p className="text-[8px] text-muted-foreground mt-0.5">{phase.durationMs}ms · {timeAgo(phase.completedAt ?? phase.createdAt)}</p>}
                                {phase.status === "in_progress" && <p className="text-[8px] text-sky-500 mt-0.5">In progress...</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confidence evolution */}
                  {detail.confidenceUpdates?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Confidence Evolution (Bayesian)</p>
                      <div className="max-h-32 space-y-1 overflow-y-auto -mr-2 pr-2">
                        {detail.confidenceUpdates.map((cu: any) => (
                          <div key={cu.id} className="flex items-center gap-2 text-[9px]">
                            <span className={cn("font-bold tabular-nums w-8", cu.delta > 0 ? "text-emerald-500" : cu.delta < 0 ? "text-red-500" : "text-muted-foreground")}>
                              {Math.round(cu.newConfidence * 100)}%
                            </span>
                            {cu.delta > 0 ? <TrendingUp className="h-2.5 w-2.5 text-emerald-500" /> : cu.delta < 0 ? <TrendingDown className="h-2.5 w-2.5 text-red-500" /> : <Minus className="h-2.5 w-2.5 text-muted-foreground" />}
                            <span className="text-muted-foreground truncate flex-1">{cu.description}</span>
                            <span className="text-muted-foreground flex-shrink-0">{timeAgo(cu.updatedAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action recommendations */}
                  {detail.recommendations?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">AI Recommendations</p>
                      <div className="space-y-1.5">
                        {detail.recommendations.map((rec: any) => (
                          <div key={rec.id} className="rounded border border-border/40 p-2">
                            <div className="flex items-center gap-2 text-[10px]">
                              <Badge variant="outline" className="text-[8px]" style={{ color: ACTION_COLOR[rec.action] ?? "#6b7280" }}>{ACTION_LABEL[rec.action] ?? rec.action}</Badge>
                              <Badge variant="outline" className={cn("text-[8px] capitalize", rec.priority === "urgent" ? "text-red-500" : rec.priority === "high" ? "text-amber-500" : "text-muted-foreground")}>{rec.priority}</Badge>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{rec.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credibility assessment */}
                  {detail.credibilityAssessment && (
                    <div className="rounded border border-primary/20 bg-primary/5 p-2">
                      <p className="text-[9px] font-medium text-primary uppercase mb-1">AI Credibility Assessment</p>
                      <p className="text-[10px] leading-tight">{detail.credibilityAssessment}</p>
                    </div>
                  )}
                </div>
              ) : <p className="py-8 text-center text-xs text-muted-foreground">Failed to load.</p>
            ) : <p className="py-8 text-center text-xs text-muted-foreground">Select an investigation to see the AI's 7-phase analysis.</p>}
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><CardTitle className="text-sm">How the Autonomous Investigation Engine Works</CardTitle></div></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { phase: "triggered", desc: "AI auto-triggers when an event is created" },
              { phase: "gathering_context", desc: "Gathers nearby historical events" },
              { phase: "analyzing_imagery", desc: "Compares recent vs older satellite imagery" },
              { phase: "identifying_impacts", desc: "Identifies affected rivers, forests, communities" },
              { phase: "requesting_evidence", desc: "Auto-requests evidence from trusted contributors" },
              { phase: "reasoning", desc: "Explains why the event is credible (or not)" },
              { phase: "monitoring", desc: "Continuously updates confidence + recommends action" },
            ].map((item) => {
              const Icon = PHASE_ICON[item.phase] ?? Activity;
              const color = PHASE_COLOR[item.phase] ?? "#6b7280";
              return (
                <div key={item.phase} className="rounded border border-border/40 p-2 text-center">
                  <div className="flex h-7 w-7 mx-auto items-center justify-center rounded-full mb-1" style={{ backgroundColor: color + "20", color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-medium" style={{ color }}>{PHASE_LABEL[item.phase] ?? item.phase}</p>
                  <p className="text-[8px] text-muted-foreground leading-tight mt-0.5">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AutoKpi({ icon: Icon, label, value, hint, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className={cn("h-3.5 w-3.5 text-muted-foreground", color)} />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className={cn("mt-2 text-xl font-bold tabular-nums leading-none", color)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
