"use client";

import * as React from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Shield,
  Copy,
  Scale,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TIER_COLOR: Record<string, { color: string; bg: string }> = {
  confirmed: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  strong: { color: "text-green-600 dark:text-green-400", bg: "bg-green-500/15" },
  moderate: { color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/15" },
  weak: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15" },
  unverified: { color: "text-muted-foreground", bg: "bg-muted" },
};

const METHOD_COLOR: Record<string, string> = {
  hash_match: "#ef4444",
  location_proximity: "#f59e0b",
  time_proximity: "#0ea5e9",
  content_similarity: "#8b5cf6",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function CorroborationDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [evidence, setEvidence] = React.useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = React.useState<any>(null);
  const [corroboration, setCorroboration] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [duplicates, setDuplicates] = React.useState<any>(null);
  const [loadingDupes, setLoadingDupes] = React.useState(false);

  // Load evidence list
  React.useEffect(() => {
    fetch("/api/v1/evidence?limit=20")
      .then((r) => r.json())
      .then((data) => setEvidence(data.evidence ?? []))
      .catch(() => {});
    fetch("/api/v1/evidence/duplicates")
      .then((r) => r.json())
      .then((data) => setDuplicates(data))
      .catch(() => {});
  }, []);

  // Load corroboration details when evidence is selected
  React.useEffect(() => {
    if (!selectedEvidence) return;
    setLoadingDetail(true);
    fetch(`/api/v1/evidence/${selectedEvidence.id}/confidence`)
      .then((r) => r.json())
      .then((data) => setCorroboration(data))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedEvidence?.id]);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/evidence/corroboration-summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CorKpi icon={ThumbsUp} label="Supports" value={summary.supports ?? 0} hint="corroborations" />
        <CorKpi icon={ThumbsDown} label="Disputes" value={summary.disputes ?? 0} hint="challenges" />
        <CorKpi icon={Users} label="Independent" value={summary.independentCorroborations ?? 0} hint="corroborations" />
        <CorKpi icon={Copy} label="Duplicate Groups" value={summary.duplicateGroups ?? 0} hint={`${summary.duplicateGroupsConfirmed ?? 0} confirmed`} />
        <CorKpi icon={Scale} label="Weighted Evidence" value={summary.weightedEvidence ?? 0} hint="scored" />
        <CorKpi icon={Shield} label="Confirmed" value={summary.tierDistribution?.find((t: any) => t.tier === "confirmed")?.count ?? 0} hint="tier" />
      </div>

      {/* Evidence list + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        {/* Evidence list with weights */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Evidence Weight Rankings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {summary.topEvidence?.map((item: any) => {
                const tierMeta = TIER_COLOR[item.tier] ?? TIER_COLOR.unverified;
                return (
                  <button
                    key={item.evidenceId}
                    onClick={() => setSelectedEvidence({ id: item.evidenceId, ...item.evidence })}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      selectedEvidence?.id === item.evidenceId
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card/50 hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.evidence?.title ?? "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{item.evidence?.type?.replace(/_/g, " ")}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold", tierMeta.bg, tierMeta.color)}>
                          {Math.round(item.weight * 100)}%
                        </div>
                        <p className={cn("mt-0.5 text-[9px] font-medium capitalize", tierMeta.color)}>{item.tier}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp className="h-2.5 w-2.5 text-emerald-500" />
                        {item.supportCount}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ThumbsDown className="h-2.5 w-2.5 text-destructive" />
                        {item.disputeCount}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5 text-violet-500" />
                        {item.independentCount}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5 text-sky-500" />
                        {Math.round(item.confidence * 100)}% conf
                      </span>
                    </div>
                  </button>
                );
              })}
              {(!summary.topEvidence || summary.topEvidence.length === 0) && (
                <p className="py-8 text-center text-xs text-muted-foreground">No weighted evidence yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Corroboration detail */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Corroboration Detail</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {selectedEvidence && corroboration ? (
                loadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{selectedEvidence.title ?? selectedEvidence.evidence?.title}</p>

                    {/* Weight visualization */}
                    {corroboration.weight && (
                      <div className="rounded-lg border border-border bg-card/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase">Evidence Weight</p>
                          <Badge variant="outline" className={cn("text-[9px] capitalize", (TIER_COLOR[corroboration.weight.tier] ?? TIER_COLOR.unverified).color)}>
                            {corroboration.weight.tier}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${corroboration.weight.weight * 100}%`,
                                backgroundColor: corroboration.weight.tier === "confirmed" ? "#10b981" : corroboration.weight.tier === "strong" ? "#22c55e" : corroboration.weight.tier === "moderate" ? "#0ea5e9" : corroboration.weight.tier === "weak" ? "#f59e0b" : "#6b7280",
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold tabular-nums">{Math.round(corroboration.weight.weight * 100)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Confidence: {Math.round(corroboration.weight.confidence * 100)}%</span>
                          <span>{corroboration.weight.supportCount} support · {corroboration.weight.disputeCount} dispute · {corroboration.weight.independentCount} independent</span>
                        </div>
                      </div>
                    )}

                    {/* Weight factors */}
                    {corroboration.weight?.factors && (
                      <div className="rounded border border-border/60 bg-card/40 p-2">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Weight Factors</p>
                        <div className="space-y-0.5 text-[10px]">
                          {Object.entries(corroboration.weight.factors).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                              <span className={cn("font-mono", val > 0 ? "text-emerald-500" : val < 0 ? "text-destructive" : "text-muted-foreground")}>
                                {val > 0 ? "+" : ""}{val.toFixed(3)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Supports */}
                    {corroboration.supports && corroboration.supports.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">
                          Supports ({corroboration.supports.length})
                        </p>
                        <div className="space-y-1">
                          {corroboration.supports.map((s: any) => (
                            <div key={s.id} className="flex items-start gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
                              <ThumbsUp className="h-3 w-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px]">{s.reason}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  strength {Math.round(s.strength * 100)}%
                                  {s.isIndependent && <span className="ml-1 text-violet-500">· independent</span>}
                                  · {timeAgo(s.createdAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disputes */}
                    {corroboration.disputes && corroboration.disputes.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">
                          Disputes ({corroboration.disputes.length})
                        </p>
                        <div className="space-y-1">
                          {corroboration.disputes.map((d: any) => (
                            <div key={d.id} className="flex items-start gap-2 rounded border border-destructive/20 bg-destructive/5 p-2">
                              <ThumbsDown className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px]">{d.reason}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  strength {Math.round(d.strength * 100)}% · {timeAgo(d.createdAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Select evidence to see corroboration details.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Duplicate detection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Duplicate Detection</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {duplicates?.groups?.length ?? 0} groups
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {duplicates?.groups && duplicates.groups.length > 0 ? (
                <div className="space-y-2">
                  {duplicates.groups.map((g: any) => (
                    <div key={g.id} className="rounded border border-border/60 bg-card/40 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium capitalize" style={{ color: METHOD_COLOR[g.detectionMethod] ?? "#6b7280" }}>
                          {g.detectionMethod.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums">{Math.round(g.confidence * 100)}%</span>
                      </div>
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        {g.evidenceIds.length} items · {g.status}
                      </p>
                      {g.metadata && Object.keys(g.metadata).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(g.metadata).slice(0, 4).map(([k, v]: [string, any]) => (
                            <span key={k} className="text-[8px] font-mono bg-muted rounded px-1">
                              {k}: {String(v).slice(0, 20)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">No duplicates detected.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tier distribution + weighting explanation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        {/* Tier distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Evidence Tier Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {["confirmed", "strong", "moderate", "weak", "unverified"].map((tier) => {
                const meta = TIER_COLOR[tier] ?? TIER_COLOR.unverified;
                const count = summary.tierDistribution?.find((t: any) => t.tier === tier)?.count ?? 0;
                const total = summary.weightedEvidence ?? 1;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <span className={cn("w-24 text-[10px] font-medium capitalize", meta.color)}>{tier}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full", meta.bg)} style={{ width: `${pct}%`, backgroundColor: tier === "confirmed" ? "#10b981" : tier === "strong" ? "#22c55e" : tier === "moderate" ? "#0ea5e9" : tier === "weak" ? "#f59e0b" : "#6b7280" }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-emerald-500">{summary.supports ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Supports</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-destructive">{summary.disputes ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Disputes</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-violet-500">{summary.independentCorroborations ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Independent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weighting model explanation */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Weighting Model</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-3">
              Instead of simple up/down votes, evidence weight is computed from
              multiple factors including submitter trust, corroboration count,
              independent sources, disputes, duplicates, and verification.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Support (+0.05 each, max +0.3)</p>
                  <p className="text-[9px] text-muted-foreground">Users corroborate the evidence</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5 p-2">
                <ThumbsDown className="h-4 w-4 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-destructive">Dispute (-0.08 each, max -0.4)</p>
                  <p className="text-[9px] text-muted-foreground">Users challenge the evidence</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 p-2">
                <Users className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400">Independent Corroboration (+0.1 each, max +0.3)</p>
                  <p className="text-[9px] text-muted-foreground">Different org, different device, no relationship</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
                <Copy className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Duplicate Penalty (-0.15)</p>
                  <p className="text-[9px] text-muted-foreground">Hash match, location proximity, or time proximity</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-sky-500/30 bg-sky-500/5 p-2">
                <Shield className="h-4 w-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Verification Bonus (+0.15)</p>
                  <p className="text-[9px] text-muted-foreground">Reviewer-verified evidence gets a bonus</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CorKpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{hint}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
