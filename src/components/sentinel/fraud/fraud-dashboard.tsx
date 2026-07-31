"use client";

import * as React from "react";
import {
  FileX,
  Users,
  UserX,
  MapPinOff,
  Brain,
  Repeat,
  Coins,
  AlertTriangle,
  Shield,
  Activity,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
  Gavel,
  TrendingUp,
  Radar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  fake_evidence: FileX,
  collusion: Users,
  sockpuppet: UserX,
  location_spoofing: MapPinOff,
  deepfake: Brain,
  vote_ring: Repeat,
  reward_farming: Coins,
};
const TYPE_COLOR: Record<string, string> = {
  fake_evidence: "#ef4444",
  collusion: "#f59e0b",
  sockpuppet: "#a78bfa",
  location_spoofing: "#0ea5e9",
  deepfake: "#ec4899",
  vote_ring: "#14b8a6",
  reward_farming: "#84cc16",
};
const TYPE_LABEL: Record<string, string> = {
  fake_evidence: "Fake Evidence",
  collusion: "Collusion",
  sockpuppet: "Sockpuppet",
  location_spoofing: "Location Spoofing",
  deepfake: "Deepfake",
  vote_ring: "Vote Ring",
  reward_farming: "Reward Farming",
};
const SEVERITY_COLOR: Record<string, string> = {
  low: "text-slate-500",
  medium: "text-amber-500",
  high: "text-red-500",
  critical: "text-red-600",
};
const STATUS_COLOR: Record<string, string> = {
  detected: "text-amber-500",
  investigating: "text-sky-500",
  confirmed: "text-red-600",
  dismissed: "text-muted-foreground",
  resolved: "text-emerald-500",
  escalated: "text-purple-500",
};
const RISK_COLOR: Record<string, string> = {
  clean: "#22c55e",
  low_risk: "#eab308",
  moderate_risk: "#f59e0b",
  high_risk: "#ef4444",
  critical: "#dc2626",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function formatGHS(n: number) {
  return `₵${n.toLocaleString("en-GH", { maximumFractionDigits: 0 })}`;
}

export function FraudDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [alerts, setAlerts] = React.useState<any[]>(initialSummary.recentAlerts ?? []);
  const [selected, setSelected] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Action state
  const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({});
  const [resolveOpen, setResolveOpen] = React.useState<Record<string, boolean>>({});
  const [resolveChoice, setResolveChoice] = React.useState<Record<string, string>>({});
  const [scanning, setScanning] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  React.useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    fetch(`/api/v1/fraud/alerts/${selected.id}`)
      .then((r) => r.json())
      .then((d) => setSelected(d))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selected?.id]);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/fraud/summary", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setSummary(d);
        setAlerts(d.recentAlerts ?? []);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // --- Run scan
  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/v1/fraud/scan", { method: "POST" });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const totalNew = data?.totalAlerts ?? data?.newAlerts ?? "";
        showToast(totalNew ? `Scan complete — ${totalNew} alerts now tracked` : "Scan complete");
        await refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message ?? `Scan failed (${res.status})`);
      }
    } catch {
      showToast("Network error");
    } finally {
      setScanning(false);
    }
  };

  // --- Investigate
  const investigate = async (alertId: string) => {
    setActionLoading((s) => ({ ...s, [`inv-${alertId}`]: true }));
    try {
      const res = await fetch(`/api/v1/fraud/alerts/${alertId}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings: { reviewedBy: "demo-user", manual: true },
          recommendedAction: "review_evidence",
          notes: "Investigation opened from dashboard",
        }),
      });
      if (res.ok) {
        showToast("Investigation opened");
        await refresh();
        if (selected?.id === alertId) {
          fetch(`/api/v1/fraud/alerts/${alertId}`)
            .then((r) => r.json())
            .then((d) => setSelected(d))
            .catch(() => {});
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message ?? `Investigate failed (${res.status})`);
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading((s) => ({ ...s, [`inv-${alertId}`]: false }));
    }
  };

  // --- Resolve
  const resolveAlert = async (alertId: string) => {
    const resolution = resolveChoice[alertId] ?? "dismissed";
    setActionLoading((s) => ({ ...s, [`res-${alertId}`]: true }));
    try {
      const res = await fetch(`/api/v1/fraud/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          notes: `Resolved from dashboard as ${resolution}`,
        }),
      });
      if (res.ok) {
        setResolveOpen((s) => ({ ...s, [alertId]: false }));
        showToast(`Alert ${resolution}`);
        await refresh();
        if (selected?.id === alertId) {
          fetch(`/api/v1/fraud/alerts/${alertId}`)
            .then((r) => r.json())
            .then((d) => setSelected(d))
            .catch(() => {});
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message ?? `Resolve failed (${res.status})`);
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading((s) => ({ ...s, [`res-${alertId}`]: false }));
    }
  };

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400 shadow-lg backdrop-blur">
          {toast}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <FraudKpi icon={AlertTriangle} label="Total Alerts" value={summary.totalAlerts ?? 0} hint="all detectors" />
        <FraudKpi icon={XCircle} label="Critical" value={summary.criticalAlerts ?? 0} hint="immediate action" />
        <FraudKpi icon={Eye} label="Investigating" value={summary.byStatus?.find((s: any) => s.status === "investigating")?.count ?? 0} hint="open cases" />
        <FraudKpi icon={Gavel} label="Confirmed" value={summary.byStatus?.find((s: any) => s.status === "confirmed")?.count ?? 0} hint="verified fraud" />
        <FraudKpi icon={Activity} label="Signals" value={summary.totalSignals ?? 0} hint="indicators" />
        <FraudKpi icon={Shield} label="Risk Profiles" value={summary.totalRiskProfiles ?? 0} hint="users tracked" />
        <FraudKpi icon={UserX} label="High-Risk Users" value={summary.highRiskUsers ?? 0} hint="need review" />
        <FraudKpi icon={Coins} label="Est. Impact" value={formatGHS(summary.estimatedImpactGHS ?? 0)} hint="fraud GHS" />
      </div>

      {/* Alerts + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Fraud Alerts</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">7 detectors · AI-powered</Badge>
                <Button size="sm" onClick={runScan} disabled={scanning} className="h-7 gap-1 text-xs">
                  {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
                  Run Scan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {alerts.map((alert: any) => {
                const Icon = TYPE_ICON[alert.type] ?? AlertTriangle;
                const color = TYPE_COLOR[alert.type] ?? "#6b7280";
                const canInvestigate = alert.status === "detected";
                const canResolve = alert.status === "investigating" || alert.status === "detected";
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      selected?.id === alert.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50",
                    )}
                  >
                    <button
                      onClick={() => setSelected(alert)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[9px]" style={{ color }}>{TYPE_LABEL[alert.type] ?? alert.type}</Badge>
                            <Badge variant="outline" className={cn("text-[9px] capitalize font-medium", SEVERITY_COLOR[alert.severity])}>{alert.severity}</Badge>
                            <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[alert.status])}>{alert.status}</Badge>
                            <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(alert.detectedAt)}</span>
                          </div>
                          <p className="mt-1 text-xs font-medium leading-tight line-clamp-2">{alert.title}</p>
                          <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground">Confidence</span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div className="h-full" style={{ width: `${alert.confidence * 100}%`, backgroundColor: color }} />
                              </div>
                              <span className="font-bold tabular-nums">{Math.round(alert.confidence * 100)}%</span>
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{alert.signalCount} signals</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Action buttons */}
                    {(canInvestigate || canResolve) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
                        {canInvestigate && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => investigate(alert.id)}
                            disabled={actionLoading[`inv-${alert.id}`]}
                            className="h-7 gap-1 text-xs"
                          >
                            {actionLoading[`inv-${alert.id}`] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                            Investigate
                          </Button>
                        )}
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResolveOpen((s) => ({ ...s, [alert.id]: !s[alert.id] }))}
                            className="h-7 gap-1 text-xs"
                          >
                            <Gavel className="h-3 w-3" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    )}

                    {resolveOpen[alert.id] && (
                      <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resolution</p>
                        <div className="flex flex-wrap gap-1">
                          {["dismissed", "confirmed", "escalated"].map((r) => (
                            <button
                              key={r}
                              onClick={() => setResolveChoice((s) => ({ ...s, [alert.id]: r }))}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors capitalize",
                                (resolveChoice[alert.id] ?? "dismissed") === r
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-card hover:bg-accent text-muted-foreground",
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setResolveOpen((s) => ({ ...s, [alert.id]: false }))} disabled={actionLoading[`res-${alert.id}`]} className="h-7 text-xs">
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => resolveAlert(alert.id)}
                            disabled={actionLoading[`res-${alert.id}`]}
                            className="h-7 gap-1 text-xs"
                          >
                            {actionLoading[`res-${alert.id}`] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Confirm Resolution
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {alerts.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No fraud alerts detected.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Alert Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selected ? (
              loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[9px]" style={{ color: TYPE_COLOR[selected.type] }}>
                        {TYPE_LABEL[selected.type] ?? selected.type}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[selected.severity])}>{selected.severity}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[selected.status])}>{selected.status}</Badge>
                    </div>
                    <p className="text-xs font-medium leading-tight">{selected.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{selected.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-sm font-bold tabular-nums">{Math.round(selected.confidence * 100)}%</p>
                      <p className="text-[8px] text-muted-foreground uppercase">Confidence</p>
                    </div>
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-sm font-bold tabular-nums">{Math.round(selected.riskScore * 100)}%</p>
                      <p className="text-[8px] text-muted-foreground uppercase">Risk Score</p>
                    </div>
                  </div>

                  {/* Signals */}
                  {selected.signals?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">Detection Signals ({selected.signals.length})</p>
                      <div className="max-h-48 space-y-1.5 overflow-y-auto -mr-2 pr-2">
                        {selected.signals.map((sig: any) => (
                          <div key={sig.id} className="rounded border border-border/40 p-2">
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="font-medium flex-shrink-0">{sig.signalType.replace(/_/g, " ")}</span>
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full bg-primary" style={{ width: `${sig.confidence * 100}%` }} />
                              </div>
                              <span className="font-bold tabular-nums">{Math.round(sig.confidence * 100)}%</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{sig.description}</p>
                            <p className="text-[8px] text-muted-foreground/70 mt-0.5">Detector: {sig.detector}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investigation */}
                  {selected.investigation && (
                    <>
                      <Separator />
                      <div>
                        <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">Investigation</p>
                        <div className="rounded border border-border/40 p-2 space-y-1 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium capitalize">{selected.investigation.status.replace(/_/g, " ")}</span>
                          </div>
                          {selected.investigation.recommendedAction && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Recommended</span>
                              <span className="font-medium capitalize">{selected.investigation.recommendedAction.replace(/_/g, " ")}</span>
                            </div>
                          )}
                          {selected.investigation.penaltyApplied > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Penalty</span>
                              <span className="font-bold text-red-500">-{Math.round(selected.investigation.penaltyApplied * 100)}% trust</span>
                            </div>
                          )}
                          {selected.investigation.notes && (
                            <p className="text-[9px] text-muted-foreground italic pt-1">{selected.investigation.notes}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Target users */}
                  {selected.targetUserIds?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">Target Users ({selected.targetUserIds.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {selected.targetUserIds.slice(0, 5).map((uid: string) => (
                          <span key={uid} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[8px] font-mono">{uid.slice(0, 8)}</span>
                        ))}
                        {selected.targetUserIds.length > 5 && <span className="text-[8px] text-muted-foreground">+{selected.targetUserIds.length - 5} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select an alert to see details.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fraud type distribution + detection methods */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Alerts by Fraud Type</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byType?.map((t: any) => {
                const Icon = TYPE_ICON[t.type] ?? AlertTriangle;
                const color = TYPE_COLOR[t.type] ?? "#6b7280";
                const maxCount = Math.max(...(summary.byType?.map((tt: any) => tt.count) ?? [1]), 1);
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <Icon className="h-3 w-3 flex-shrink-0" style={{ color }} />
                    <span className="w-28 text-[10px] font-medium">{TYPE_LABEL[t.type] ?? t.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${(t.count / maxCount) * 100}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-6 text-right text-[10px] font-bold tabular-nums">{t.count}</span>
                  </div>
                );
              })}
              {(!summary.byType || summary.byType.length === 0) && (
                <p className="py-4 text-center text-xs text-muted-foreground">No fraud type data yet.</p>
              )}
            </div>
            <Separator className="my-3" />
            {/* Severity breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {["low", "medium", "high", "critical"].map((sev) => {
                const count = summary.bySeverity?.find((s: any) => s.severity === sev)?.count ?? 0;
                return (
                  <div key={sev} className="rounded border border-border/40 p-2">
                    <p className={cn("text-lg font-bold tabular-nums capitalize", SEVERITY_COLOR[sev])}>{count}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{sev}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">7 Fraud Detectors</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { type: "fake_evidence", signals: "Hash duplicates · Metadata mismatches · Broken chains · Impossible timestamps" },
                { type: "collusion", signals: "Circular corroboration · Identical submissions · Coordinated timing" },
                { type: "sockpuppet", signals: "Shared devices · Shared IPs · Correlated login timing" },
                { type: "location_spoofing", signals: "Impossible travel · GPS/EXIF mismatch · Identical coords" },
                { type: "deepfake", signals: "AI tool signatures · Missing EXIF · Editing software traces" },
                { type: "vote_ring", signals: "Coordinated voting · Circular support · Mutual-only corroboration" },
                { type: "reward_farming", signals: "Bulk low-quality · Repeated evidence · High-volume submissions" },
              ].map((d) => {
                const Icon = TYPE_ICON[d.type] ?? AlertTriangle;
                const color = TYPE_COLOR[d.type] ?? "#6b7280";
                return (
                  <div key={d.type} className="flex items-start gap-2 rounded border border-border/40 p-2">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium" style={{ color }}>{TYPE_LABEL[d.type]}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{d.signals}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Multi-Signal Detection</p>
                <p className="text-[9px] text-muted-foreground">Each alert aggregates multiple signals. Confidence = 1 - ∏(1 - signal_confidence). Risk = weighted average of signal weights.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High-risk users */}
      {summary.topRiskUsers?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">High-Risk Users</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summary.topRiskUsers.map((u: any) => {
                const color = RISK_COLOR[u.riskLevel] ?? "#6b7280";
                return (
                  <div key={u.userId} className="rounded border border-border/60 bg-card/50 p-2.5">
                    <div className="flex items-center justify-between">
                      <code className="text-[10px] font-mono font-medium">{u.userId.slice(0, 12)}…</code>
                      <Badge variant="outline" className="text-[9px] capitalize" style={{ color }}>{u.riskLevel.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full" style={{ width: `${u.riskScore * 100}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums">{Math.round(u.riskScore * 100)}%</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{u.alertCount} alerts · {u.confirmedAlertCount} confirmed</span>
                      {u.trustPenalty > 0 && <span className="text-red-500 font-medium">-{Math.round(u.trustPenalty * 100)}% trust</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FraudKpi({
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
        {hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
