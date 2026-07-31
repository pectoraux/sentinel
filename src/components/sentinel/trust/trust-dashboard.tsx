"use client";

import * as React from "react";
import {
  Shield,
  Target,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  ThumbsUp,
  Heart,
  Clock,
  Bug,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TIER_COLOR: Record<string, string> = {
  elite: "text-emerald-600 dark:text-emerald-400",
  trusted: "text-green-600 dark:text-green-400",
  verified: "text-sky-600 dark:text-sky-400",
  basic: "text-amber-600 dark:text-amber-400",
  unverified: "text-muted-foreground",
};

const FACTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  accuracy: Target,
  reliability: TrendingUp,
  falseReportPenalty: AlertTriangle,
  evidenceQuality: FileCheck,
  contributionQuality: ThumbsUp,
  communityImpact: Heart,
  decayMultiplier: Clock,
  fraudMultiplier: Bug,
};

const FACTOR_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  reliability: "Reliability",
  falseReportPenalty: "False Reports",
  evidenceQuality: "Evidence Quality",
  contributionQuality: "Contribution Quality",
  communityImpact: "Community Impact",
  decayMultiplier: "Decay",
  fraudMultiplier: "Fraud Resistance",
};

const FRAUD_COLOR: Record<string, string> = {
  duplicate_spam: "#f59e0b",
  false_report: "#ef4444",
  coordinated_manipulation: "#8b5cf6",
  bot_behavior: "#dc2626",
  identity_theft: "#f97316",
  other: "#64748b",
};

function pct(v: number) { return `${Math.round(v * 100)}%`; }

export function TrustDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<any>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/v1/trust/leaderboard?limit=10")
      .then((r) => r.json())
      .then((data) => setLeaderboard(data.leaderboard ?? []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!selectedUser) { setProfile(null); return; }
    setLoadingProfile(true);
    fetch(`/api/v1/trust/profile/${selectedUser}`)
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [selectedUser]);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/trust/summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  const avg = summary.averages ?? {};

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <TrustKpi icon={Target} label="Accuracy" value={pct(avg.accuracy ?? 0)} />
        <TrustKpi icon={TrendingUp} label="Reliability" value={pct(avg.reliability ?? 0)} />
        <TrustKpi icon={FileCheck} label="Evidence Q." value={pct(avg.evidenceQuality ?? 0)} />
        <TrustKpi icon={ThumbsUp} label="Contrib Q." value={pct(avg.contributionQuality ?? 0)} />
        <TrustKpi icon={Heart} label="Impact" value={pct(avg.communityImpact ?? 0)} />
        <TrustKpi icon={Bug} label="Fraud Resist" value={pct(avg.fraudResistance ?? 0)} />
        <TrustKpi icon={Clock} label="Avg Decay" value={pct(avg.decayRate ?? 0)} />
        <TrustKpi icon={AlertTriangle} label="Fraud Flags" value={summary.fraudFlags?.total ?? 0} />
      </div>

      {/* Leaderboard + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Trust Leaderboard</CardTitle></div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {leaderboard.map((item: any, i: number) => (
                <button key={item.userId} onClick={() => setSelectedUser(item.userId)}
                  className={cn("w-full text-left rounded-lg border p-3 transition-colors", selectedUser === item.userId ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50")}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.user?.name ?? item.user?.email}</p>
                      <p className="text-[9px] text-muted-foreground capitalize">{item.tier} · {item.score?.toFixed(3)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn("text-sm font-bold tabular-nums", TIER_COLOR[item.tier])}>{pct(item.score)}</p>
                      <div className="flex items-center gap-2 text-[8px] text-muted-foreground mt-0.5">
                        <span title="Accuracy">{pct(item.accuracy)}</span>
                        <span title="Evidence">{pct(item.evidenceQuality)}</span>
                        <span title="Fraud">{pct(item.fraudResistance)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {leaderboard.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No trust profiles yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Trust Profile</CardTitle></div>
            </CardHeader>
            <CardContent>
              {selectedUser && profile ? (
                loadingProfile ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-3">
                    {/* Composite score */}
                    <div className="rounded-lg border border-border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Composite Trust Score</p>
                        <Badge variant="outline" className={cn("text-[9px] capitalize", TIER_COLOR[profile.tier])}>{profile.tier}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full transition-all" style={{ width: `${profile.compositeScore * 100}%`, backgroundColor: profile.tier === "elite" ? "#10b981" : profile.tier === "trusted" ? "#22c55e" : profile.tier === "verified" ? "#0ea5e9" : profile.tier === "basic" ? "#f59e0b" : "#6b7280" }} />
                        </div>
                        <span className="text-lg font-bold tabular-nums">{pct(profile.compositeScore)}</span>
                      </div>
                    </div>

                    {/* 8 factors */}
                    <div className="grid grid-cols-2 gap-2">
                      {profile.factors?.factors && Object.entries(profile.factors.factors).map(([key, val]: [string, any]) => {
                        const Icon = FACTOR_ICONS[key] ?? Shield;
                        const label = FACTOR_LABELS[key] ?? key;
                        const isPenalty = key === "decayMultiplier" || key === "falseReportPenalty";
                        const displayVal = key === "falseReportPenalty" ? 1 - val : val; // invert falseReportPenalty for display
                        return (
                          <div key={key} className="rounded border border-border/60 bg-card/40 p-2">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-[9px] font-medium text-muted-foreground uppercase truncate">{label}</p>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full", isPenalty && key === "falseReportPenalty" ? "bg-destructive" : "bg-primary")} style={{ width: `${(key === "falseReportPenalty" ? 1 - val : val) * 100}%` }} />
                              </div>
                              <span className="text-[10px] font-bold tabular-nums">{pct(key === "falseReportPenalty" ? 1 - val : val)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Metrics */}
                    {profile.metrics && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded border border-border/60 bg-card/40 p-2">
                          <p className="text-sm font-bold tabular-nums">{profile.metrics.totalReports}</p>
                          <p className="text-[8px] text-muted-foreground uppercase">Reports</p>
                        </div>
                        <div className="rounded border border-border/60 bg-card/40 p-2">
                          <p className="text-sm font-bold tabular-nums">{profile.metrics.verifiedReports}</p>
                          <p className="text-[8px] text-muted-foreground uppercase">Verified</p>
                        </div>
                        <div className="rounded border border-border/60 bg-card/40 p-2">
                          <p className="text-sm font-bold tabular-nums text-destructive">{profile.metrics.falseReportCount}</p>
                          <p className="text-[8px] text-muted-foreground uppercase">False Reports</p>
                        </div>
                      </div>
                    )}

                    {/* Decay + fraud */}
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-amber-500" />
                        <span className="text-muted-foreground">Decay:</span>
                        <span className="font-bold text-amber-500">{pct(profile.metrics?.decayRate ?? 0)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bug className="h-3 w-3 text-emerald-500" />
                        <span className="text-muted-foreground">Fraud Resist:</span>
                        <span className="font-bold text-emerald-500">{pct(profile.metrics?.fraudResistance ?? 1)}</span>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">Select a user from the leaderboard.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent decay */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Recent Decay Events</CardTitle></div>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 space-y-1 overflow-y-auto -mr-2 pr-2">
                {summary.recentDecay?.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-border/60 bg-card/40 p-2 text-[10px]">
                    <Clock className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                    <span className="truncate flex-1">{d.user?.name ?? d.user?.email}</span>
                    <span className="font-mono text-muted-foreground">{d.previousScore.toFixed(2)}→{d.newScore.toFixed(2)}</span>
                    <span className="text-destructive">-{d.decayAmount.toFixed(3)}</span>
                    <span className="text-muted-foreground">{d.daysInactive}d</span>
                  </div>
                ))}
                {(!summary.recentDecay || summary.recentDecay.length === 0) && <p className="py-4 text-center text-[10px] text-muted-foreground">No decay applied yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tier distribution + fraud flags */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Tier Distribution</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {["elite", "trusted", "verified", "basic", "unverified"].map((tier) => {
                const count = summary.tierDistribution?.find((t: any) => t.tier === tier)?.count ?? 0;
                const total = summary.totalUsers ?? 1;
                const pctVal = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <span className={cn("w-24 text-[10px] font-medium capitalize", TIER_COLOR[tier])}>{tier}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${pctVal}%`, backgroundColor: tier === "elite" ? "#10b981" : tier === "trusted" ? "#22c55e" : tier === "verified" ? "#0ea5e9" : tier === "basic" ? "#f59e0b" : "#6b7280" }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.totalUsers ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Users</p></div>
              <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.fraudFlags?.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Fraud Flags</p></div>
              <div><p className="text-lg font-bold tabular-nums text-amber-500">{pct(avg.decayRate ?? 0)}</p><p className="text-[9px] text-muted-foreground uppercase">Avg Decay</p></div>
              <div><p className="text-lg font-bold tabular-nums text-violet-500">{pct(avg.fraudResistance ?? 1)}</p><p className="text-[9px] text-muted-foreground uppercase">Fraud Resist</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Fraud flags */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bug className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Fraud Detection</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.fraudFlags?.byType?.map((f: any) => (
                <div key={f.type} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: FRAUD_COLOR[f.type] ?? "#6b7280" }} />
                  <span className="w-40 text-[10px] font-medium capitalize">{f.type.replace(/_/g, " ")}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full" style={{ width: `${(f.count / Math.max(summary.fraudFlags.total, 1)) * 100}%`, backgroundColor: FRAUD_COLOR[f.type] ?? "#6b7280" }} />
                  </div>
                  <span className="w-8 text-right text-[10px] font-bold tabular-nums">{f.count}</span>
                </div>
              ))}
              {(!summary.fraudFlags?.byType || summary.fraudFlags.byType.length === 0) && <p className="py-4 text-center text-[10px] text-muted-foreground">No fraud flags detected.</p>}
            </div>
            <Separator className="my-3" />
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Fraud Detection Methods</p>
              {[
                { type: "Duplicate Spam", desc: "Near-identical reports submitted rapidly", color: "#f59e0b" },
                { type: "False Reports", desc: "False-positive rate > 40%", color: "#ef4444" },
                { type: "Coordinated Manipulation", desc: "Same-org corroborations (collusion)", color: "#8b5cf6" },
                { type: "Bot Behavior", desc: "Inhuman activity regularity", color: "#dc2626" },
              ].map((m) => (
                <div key={m.type} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-1.5">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium">{m.type}</p>
                    <p className="text-[8px] text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrustKpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
      <p className="mt-2 text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
