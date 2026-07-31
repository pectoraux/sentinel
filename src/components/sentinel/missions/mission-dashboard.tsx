"use client";

import * as React from "react";
import { Target, MapPin, Clock, Award, Users, Camera, CheckCircle, Plane, Cpu, ClipboardCheck, Brain, Loader2, ChevronRight, AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  evidence_gathering: Camera, verification: CheckCircle, inspection: ClipboardCheck,
  drone_survey: Plane, sensor_check: Cpu, witness_interview: Users,
};
const TYPE_COLOR: Record<string, string> = {
  evidence_gathering: "#0ea5e9", verification: "#22c55e", inspection: "#f59e0b",
  drone_survey: "#14b8a6", sensor_check: "#a78bfa", witness_interview: "#ef4444",
};
const PRIORITY_COLOR: Record<string, string> = { low: "text-muted-foreground", medium: "text-sky-500", high: "text-amber-500", urgent: "text-destructive" };
const PRIORITY_BG: Record<string, string> = { low: "bg-muted-foreground", medium: "bg-sky-500", high: "bg-amber-500", urgent: "bg-destructive" };
const STATUS_COLOR: Record<string, string> = { open: "text-sky-500", assigned: "text-violet-500", in_progress: "text-amber-500", submitted: "text-teal-500", verified: "text-emerald-500", completed: "text-muted-foreground", expired: "text-destructive", cancelled: "text-muted-foreground" };
const QUALITY_COLOR: Record<string, string> = { low: "text-destructive", medium: "text-amber-500", high: "text-sky-500", excellent: "text-emerald-500" };

function timeAgo(d:string){const diff=Date.now()-new Date(d).getTime();const m=Math.floor(diff/60000);if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return `${h}h ago`;return `${Math.floor(h/24)}d ago`;}

export function MissionDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [missions, setMissions] = React.useState<any[]>(initialSummary.recent ?? []);

  const refresh = React.useCallback(async () => {
    try {
      const [s,r] = await Promise.all([fetch("/api/v1/missions/summary",{cache:"no-store"}), fetch("/api/v1/missions?limit=50",{cache:"no-store"})]);
      if (s.ok) { const sd=await s.json(); setSummary(sd); setMissions(sd.recent ?? []); }
    } catch {}
  }, []);
  React.useEffect(() => { const id=setInterval(refresh,30000); return ()=>clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <MissKpi icon={Target} label="Missions" value={summary.total ?? 0} hint="AI-created" />
        <MissKpi icon={Users} label="Active" value={summary.assigned ?? 0} hint="in progress" />
        <MissKpi icon={Award} label="Rewards Paid" value={summary.totalRewardsPaid ?? 0} hint="trust points" />
        <MissKpi icon={Zap} label="Avg Reward" value={summary.avgReward ? Math.round(summary.avgReward) : 0} hint="per mission" />
        {summary.byPriority?.map((p:any) => (
          <MissKpi key={p.priority} icon={AlertTriangle} label={p.priority} value={p.count} hint="priority" />
        ))}
      </div>

      {/* Mission feed + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><CardTitle className="text-sm">AI Mission Feed</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">{missions.length} missions · auto-generated from low confidence</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[550px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {missions.map((m:any) => {
                const Icon = TYPE_ICON[m.type] ?? Camera;
                const color = TYPE_COLOR[m.type] ?? "#6b7280";
                return (
                  <div key={m.id} className={cn("rounded-lg border p-3", m.status === "verified" ? "border-emerald-500/30 bg-emerald-500/5" : m.status === "in_progress" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card/50")}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{backgroundColor:color+"20", color}}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{m.title}</p>
                          <Badge variant="outline" className={cn("text-[9px] capitalize", PRIORITY_COLOR[m.priority])}>{m.priority}</Badge>
                          <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[m.status])}>{m.status.replace(/_/g," ")}</Badge>
                          {m.verificationQuality && <Badge variant="outline" className={cn("text-[9px] capitalize", QUALITY_COLOR[m.verificationQuality])}>★ {m.verificationQuality}</Badge>}
                          <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{m.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                          {m.locationName && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{m.locationName}</span>}
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{m.radiusM}m radius</span>
                          <span className="flex items-center gap-0.5">
                            <Award className="h-2.5 w-2.5" />
                            {m.actualReward ? `${m.actualReward} pts (paid)` : `${m.baseReward}–${m.maxReward} pts`}
                          </span>
                          {m.triggerDescription && <span className="text-[9px] italic truncate max-w-[200px]">{m.triggerDescription}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {missions.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No missions yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* How it works + rewards */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">How It Works</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { step: "1", label: "Low Confidence Detected", desc: "Fusion confidence < 70% triggers mission creation", icon: AlertTriangle, color: "#ef4444" },
                  { step: "2", label: "AI Creates Mission", desc: "Generates instructions: what, where, radius, type", icon: Brain, color: "#0ea5e9" },
                  { step: "3", label: "Nearby Trusted Users Notified", desc: "Users with eligible trust tiers within range", icon: Users, color: "#a78bfa" },
                  { step: "4", label: "User Accepts & Gathers Evidence", desc: "Travels to site, collects photos/video/sensor data", icon: Camera, color: "#22c55e" },
                  { step: "5", label: "Submission Verified", desc: "Reviewer rates quality: low → excellent", icon: CheckCircle, color: "#f59e0b" },
                  { step: "6", label: "Reward Calculated", desc: "base × priority × quality = trust points", icon: Award, color: "#14b8a6" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-2 rounded border border-border/40 bg-card/30 p-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary bg-primary/10">{s.step}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium">{s.label}</p>
                      <p className="text-[9px] text-muted-foreground">{s.desc}</p>
                    </div>
                    <s.icon className="h-3.5 w-3.5 flex-shrink-0" style={{color: s.color}} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Reward System</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Reward = base × priority × quality</p>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Quality Multipliers</p>
                  {[
                    { level: "Excellent", mult: "2.0×", color: "#22c55e", desc: "GPS-tagged, high-res, verified" },
                    { level: "High", mult: "1.5×", color: "#0ea5e9", desc: "Good quality with metadata" },
                    { level: "Medium", mult: "1.0×", color: "#f59e0b", desc: "Acceptable evidence" },
                    { level: "Low", mult: "0.5×", color: "#ef4444", desc: "Poor quality, incomplete" },
                  ].map((q) => (
                    <div key={q.level} className="flex items-center gap-2 text-[10px]">
                      <span className="h-2 w-2 rounded-full" style={{backgroundColor: q.color}} />
                      <span className="w-20 font-medium">{q.level}</span>
                      <span className="font-bold">{q.mult}</span>
                      <span className="text-muted-foreground truncate">{q.desc}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Priority Multipliers</p>
                  {[
                    { level: "Urgent", mult: "3.0×", color: "#ef4444" },
                    { level: "High", mult: "2.0×", color: "#f59e0b" },
                    { level: "Medium", mult: "1.5×", color: "#0ea5e9" },
                    { level: "Low", mult: "1.0×", color: "#64748b" },
                  ].map((p) => (
                    <div key={p.level} className="flex items-center gap-2 text-[10px]">
                      <span className="h-2 w-2 rounded-full" style={{backgroundColor: p.color}} />
                      <span className="w-20 font-medium">{p.level}</span>
                      <span className="font-bold">{p.mult}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.totalRewardsPaid ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Total Paid</p></div>
                  <div><p className="text-lg font-bold tabular-nums">{summary.avgReward ? Math.round(summary.avgReward) : 0}</p><p className="text-[9px] text-muted-foreground uppercase">Avg Reward</p></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MissKpi({icon:Icon,label,value,hint}:{icon:React.ComponentType<{className?:string}>;label:string;value:number|string;hint?:string}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
