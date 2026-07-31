"use client";

import * as React from "react";
import { Heart, Building2, Landmark, Target, Users, Award, Receipt, TrendingUp, Loader2, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  donation: Heart, ngo_funding: Building2, government_grant: Landmark, mission_rewards: Target, community_fund: Users,
};
const TYPE_COLOR: Record<string, string> = {
  donation: "#0ea5e9", ngo_funding: "#22c55e", government_grant: "#f59e0b", mission_rewards: "#a78bfa", community_fund: "#14b8a6",
};
const TYPE_LABEL: Record<string, string> = {
  donation: "Donation", ngo_funding: "NGO Funding", government_grant: "Gov Grant", mission_rewards: "Mission Rewards", community_fund: "Community Fund",
};
const STATUS_COLOR: Record<string, string> = { active: "text-emerald-500", depleted: "text-muted-foreground", paused: "text-amber-500", closed: "text-destructive" };
const LEDGER_COLOR: Record<string, string> = { deposit: "text-emerald-500", distribution: "text-sky-500", adjustment: "text-amber-500", reversal: "text-destructive", fee: "text-muted-foreground" };

function formatGHS(amount: number) { return `₵${amount.toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }
function timeAgo(d:string){const diff=Date.now()-new Date(d).getTime();const m=Math.floor(diff/60000);if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return `${h}h ago`;return `${Math.floor(h/24)}d ago`;}

export function RewardDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [pools, setPools] = React.useState<any[]>(initialSummary.recentPools ?? []);
  const [selected, setSelected] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/rewards/pools/${selected.id}`).then(r=>r.json()).then(d=>setSelected(d)).catch(()=>{}).finally(()=>setLoadingDetail(false));
  }, [selected?.id]);

  const refresh = React.useCallback(async () => {
    try { const r = await fetch("/api/v1/rewards/summary",{cache:"no-store"}); if (r.ok) { const d=await r.json(); setSummary(d); setPools(d.recentPools ?? []); } } catch {}
  }, []);
  React.useEffect(() => { const id=setInterval(refresh,30000); return ()=>clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <RewKpi icon={Award} label="Total Pools" value={summary.totalPools ?? 0} hint="funding sources" />
        <RewKpi icon={TrendingUp} label="Total Funds" value={formatGHS(summary.totalFunds ?? 0)} hint="all pools" />
        <RewKpi icon={CheckCircle2} label="Distributed" value={formatGHS(summary.totalDistributed ?? 0)} hint="paid out" />
        <RewKpi icon={Receipt} label="Available" value={formatGHS(summary.totalAvailable ?? 0)} hint="remaining" />
        <RewKpi icon={Users} label="Contributors" value={summary.totalContributions ?? 0} hint="contributions" />
        <RewKpi icon={Award} label="Distributions" value={summary.totalDistributions ?? 0} hint="paid out" />
        <RewKpi icon={Receipt} label="Ledger Entries" value={summary.totalLedgerEntries ?? 0} hint="audit trail" />
        <RewKpi icon={ShieldCheck} label="Audit" value="Verified" hint="hash chain" />
      </div>

      {/* Pools + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Reward Pools</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">Fiat GHS · No crypto · Hash-chained ledger</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {pools.map((pool:any) => {
                const Icon = TYPE_ICON[pool.type] ?? Award;
                const color = TYPE_COLOR[pool.type] ?? "#6b7280";
                const distributedPct = pool.totalFunds > 0 ? (pool.distributedFunds / pool.totalFunds) * 100 : 0;
                return (
                  <button key={pool.id} onClick={()=>setSelected(pool)} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selected?.id===pool.id?"border-primary bg-primary/5":"border-border bg-card/50 hover:bg-accent/50")}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{backgroundColor:color+"20", color}}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{pool.name}</p>
                          <Badge variant="outline" className="text-[9px]" style={{color}}>{TYPE_LABEL[pool.type] ?? pool.type}</Badge>
                          <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[pool.status])}>{pool.status}</Badge>
                          <span className="ml-auto text-[9px] text-muted-foreground">{pool.sourceName}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                          <span className="font-bold tabular-nums">{formatGHS(pool.totalFunds)}</span>
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-primary" style={{width:`${distributedPct}%`}} />
                          </div>
                          <span className="text-muted-foreground">{formatGHS(pool.availableFunds)} left</span>
                          <span className="text-muted-foreground">· {pool.contributionCount} contribs · {pool.distributionCount} dist</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {pools.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No reward pools yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Pool Detail & Ledger</CardTitle></div></CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? <div className="flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">{selected.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selected.description}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded border border-border/60 bg-card/40 p-2"><p className="text-sm font-bold tabular-nums">{formatGHS(selected.totalFunds)}</p><p className="text-[8px] text-muted-foreground uppercase">Total</p></div>
                    <div className="rounded border border-border/60 bg-card/40 p-2"><p className="text-sm font-bold tabular-nums text-emerald-500">{formatGHS(selected.availableFunds)}</p><p className="text-[8px] text-muted-foreground uppercase">Available</p></div>
                    <div className="rounded border border-border/60 bg-card/40 p-2"><p className="text-sm font-bold tabular-nums text-sky-500">{formatGHS(selected.distributedFunds)}</p><p className="text-[8px] text-muted-foreground uppercase">Distributed</p></div>
                  </div>

                  {/* Top contributors */}
                  {selected.contributions?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">Top Contributors (by score)</p>
                      <div className="max-h-32 space-y-1 overflow-y-auto -mr-2 pr-2">
                        {selected.contributions.slice(0, 5).map((c:any, i:number) => (
                          <div key={c.id} className="flex items-center gap-2 rounded border border-border/40 p-1.5 text-[10px]">
                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">{i+1}</span>
                            <span className="flex-1 truncate font-medium">{c.contributorName}</span>
                            <span className="text-muted-foreground">{c.contributionType}</span>
                            <span className="font-bold tabular-nums">{c.contributionScore.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Ledger */}
                  {selected.ledger?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> Audit Ledger ({selected.ledger.length} entries)</p>
                      <div className="max-h-40 space-y-1 overflow-y-auto -mr-2 pr-2">
                        {selected.ledger.slice(0, 10).map((e:any) => (
                          <div key={e.id} className="rounded border border-border/40 p-1.5">
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className={cn("font-medium capitalize flex-shrink-0", LEDGER_COLOR[e.entryType])}>{e.entryType}</span>
                              <span className={cn("font-bold tabular-nums", e.amount >= 0 ? "text-emerald-500" : "text-sky-500")}>{e.amount >= 0 ? "+" : ""}{formatGHS(e.amount)}</span>
                              <span className="ml-auto text-muted-foreground font-mono text-[8px]">{e.entryHash?.slice(0,8)}…</span>
                            </div>
                            <p className="text-[8px] text-muted-foreground mt-0.5 truncate">{e.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select a pool to see details.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pool types + scoring */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Funding Sources</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byType?.map((t:any) => {
                const Icon = TYPE_ICON[t.type] ?? Award;
                const color = TYPE_COLOR[t.type] ?? "#6b7280";
                const maxFunds = Math.max(...(summary.byType?.map((tt:any)=>tt.totalFunds) ?? [1]), 1);
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <Icon className="h-3 w-3 flex-shrink-0" style={{color}} />
                    <span className="w-28 text-[10px] font-medium">{TYPE_LABEL[t.type] ?? t.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{width:`${(t.totalFunds/maxFunds)*100}%`, backgroundColor:color}} /></div>
                    <span className="text-[9px] text-muted-foreground">{t.count}</span>
                    <span className="w-16 text-right text-[10px] font-bold tabular-nums">{formatGHS(t.totalFunds)}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.totalPools ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Pools</p></div>
              <div><p className="text-lg font-bold tabular-nums">{formatGHS(summary.totalFunds ?? 0)}</p><p className="text-[9px] text-muted-foreground uppercase">Total</p></div>
              <div><p className="text-lg font-bold tabular-nums text-sky-500">{formatGHS(summary.totalDistributed ?? 0)}</p><p className="text-[9px] text-muted-foreground uppercase">Paid</p></div>
              <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.totalLedgerEntries ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Ledger</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Contribution Scoring</CardTitle></div></CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-3">Score = baseScore × tierMultiplier × qualityMultiplier × amountFactor. Higher trust + better evidence = bigger reward share.</p>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Contribution Types</p>
                <div className="grid grid-cols-2 gap-1">
                  {[{t:"Financial",s:"1.0×"},{t:"Evidence",s:"1.5×"},{t:"Mission",s:"2.0×"},{t:"Verification",s:"1.8×"},{t:"Referral",s:"0.5×"}].map((c) => (
                    <div key={c.t} className="flex items-center gap-1 text-[10px] rounded border border-border/40 p-1"><span className="flex-1">{c.t}</span><span className="font-bold">{c.s}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Trust Tier Multipliers</p>
                <div className="grid grid-cols-5 gap-1">
                  {[{t:"Elite",m:"2.0×",c:"#10b981"},{t:"Trusted",m:"1.5×",c:"#22c55e"},{t:"Verified",m:"1.2×",c:"#0ea5e9"},{t:"Basic",m:"1.0×",c:"#f59e0b"},{t:"Unverified",m:"0.5×",c:"#64748b"}].map((t) => (
                    <div key={t.t} className="text-center rounded border border-border/40 p-1"><p className="text-[9px] font-medium" style={{color:t.c}}>{t.t}</p><p className="text-[10px] font-bold">{t.m}</p></div>
                  ))}
                </div>
              </div>
              <Separator className="my-1" />
              <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div><p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Transparent Distribution</p><p className="text-[9px] text-muted-foreground">Hash-chained ledger · Public pools · Bank/mobile money transfers · No cryptocurrency</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RewKpi({icon:Icon,label,value,hint}:{icon:React.ComponentType<{className?:string}>;label:string;value:number|string;hint?:string}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

import { ShieldCheck } from "lucide-react";
