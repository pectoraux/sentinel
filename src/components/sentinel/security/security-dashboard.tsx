"use client";

import * as React from "react";
import {
  ShieldCheck,
  Lock,
  Gauge,
  ShieldAlert,
  RefreshCw,
  Sword,
  Radar,
  DatabaseBackup,
  ServerOff,
  ScrollText,
  Shield,
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DOMAIN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  zero_trust: ShieldCheck,
  encryption: Lock,
  rate_limiting: Gauge,
  waf: ShieldAlert,
  secret_rotation: RefreshCw,
  pen_testing: Sword,
  threat_detection: Radar,
  backup: DatabaseBackup,
  disaster_recovery: ServerOff,
  audit: ScrollText,
};
const DOMAIN_COLOR: Record<string, string> = {
  zero_trust: "#0ea5e9",
  encryption: "#22c55e",
  rate_limiting: "#f59e0b",
  waf: "#ef4444",
  secret_rotation: "#a855f7",
  pen_testing: "#14b8a6",
  threat_detection: "#dc2626",
  backup: "#3b82f6",
  disaster_recovery: "#f97316",
  audit: "#64748b",
};
const DOMAIN_LABEL: Record<string, string> = {
  zero_trust: "Zero Trust",
  encryption: "Encryption",
  rate_limiting: "Rate Limiting",
  waf: "WAF",
  secret_rotation: "Secret Rotation",
  pen_testing: "Pen Testing",
  threat_detection: "Threat Detection",
  backup: "Backups",
  disaster_recovery: "Disaster Recovery",
  audit: "Audit",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-muted-foreground",
  low: "text-sky-500",
  medium: "text-amber-500",
  high: "text-red-500",
  critical: "text-red-600",
};
const STATUS_COLOR: Record<string, string> = {
  active: "text-red-500",
  blocked: "text-amber-500",
  resolved: "text-emerald-500",
  false_positive: "text-muted-foreground",
};
const THREAT_TYPE_COLOR: Record<string, string> = {
  brute_force: "#ef4444",
  credential_stuffing: "#dc2626",
  sql_injection: "#f59e0b",
  xss: "#f59e0b",
  ddos: "#dc2626",
  bot: "#a855f7",
  scraping: "#0ea5e9",
  privilege_escalation: "#dc2626",
  data_exfiltration: "#dc2626",
  malware: "#ef4444",
  anomalous_access: "#f59e0b",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function formatBytes(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}KB`;
  return `${n}B`;
}

export function SecurityDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [activeSection, setActiveSection] = React.useState<"domains" | "threats" | "events" | "backups" | "pentests" | "secrets" | "dr">("domains");

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/security/summary", { cache: "no-store" });
      if (r.ok) setSummary(await r.json());
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const domains = summary.domains ?? [];
  const scoreColor = summary.color ?? "#64748b";

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Top-level KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <SecurityKpi icon={Shield} label="Security Score" value={`${summary.overallScore ?? 0}%`} hint={summary.level ?? "Unknown"} color={scoreColor} />
        <SecurityKpi icon={AlertCircle} label="Active Events" value={String(summary.activeEvents ?? 0)} hint={`${summary.criticalEvents ?? 0} critical`} color="text-red-500" />
        <SecurityKpi icon={Radar} label="Threats" value={String(summary.totalThreats ?? 0)} hint={`${summary.activeThreats ?? 0} active`} color="text-amber-500" />
        <SecurityKpi icon={ShieldAlert} label="Block Rate" value={`${summary.blockRate ?? 0}%`} hint="threats blocked" color="text-emerald-500" />
        <SecurityKpi icon={DatabaseBackup} label="Backups" value={String(summary.totalBackups ?? 0)} hint={`${summary.completedBackups ?? 0} done`} color="text-sky-500" />
        <SecurityKpi icon={Sword} label="Pen Tests" value={String(summary.totalPenTests ?? 0)} hint={`${summary.pendingRemediation ?? 0} pending`} color="text-teal-500" />
        <SecurityKpi icon={RefreshCw} label="Secrets" value={String(summary.totalSecrets ?? 0)} hint={`${summary.pendingRotations ?? 0} pending`} color="text-purple-500" />
        <SecurityKpi icon={ServerOff} label="DR Ready" value={`${summary.readyDrPlans ?? 0}/${summary.totalDrPlans ?? 0}`} hint="plans ready" color="text-orange-500" />
      </div>

      {/* Section tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
        {([
          { id: "domains", label: "10 Domains", icon: Shield },
          { id: "threats", label: "Threats", icon: Radar },
          { id: "events", label: "Events", icon: Activity },
          { id: "backups", label: "Backups", icon: DatabaseBackup },
          { id: "pentests", label: "Pen Tests", icon: Sword },
          { id: "secrets", label: "Secrets", icon: RefreshCw },
          { id: "dr", label: "DR Plans", icon: ServerOff },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      {activeSection === "domains" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Security Posture — 10 Domains</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]" style={{ color: scoreColor }}>Score: {summary.overallScore}%</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {domains.map((d: any) => {
                const Icon = DOMAIN_ICON[d.domain] ?? Shield;
                const color = DOMAIN_COLOR[d.domain] ?? "#6b7280";
                const compliance = Math.round(d.complianceScore);
                return (
                  <div key={d.domain} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color }}>{DOMAIN_LABEL[d.domain] ?? d.domain}</span>
                    </div>
                    {/* Compliance bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${compliance}%`,
                            backgroundColor: compliance >= 90 ? "#22c55e" : compliance >= 75 ? "#0ea5e9" : compliance >= 60 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums">{compliance}%</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{d.violationCount} violations</span>
                      {d.activeThreats > 0 && <span className="text-red-500">{d.activeThreats} threats</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "threats" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Threat Indicators</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentThreats ?? []).map((t: any) => {
                const threatColor = THREAT_TYPE_COLOR[t.type] ?? "#6b7280";
                return (
                  <div key={t.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] capitalize" style={{ color: threatColor }}>
                        {t.type.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[t.severity])}>{t.severity}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[t.status])}>{t.status}</Badge>
                      <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(t.detectedAt)}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-tight">{t.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      {t.sourceIp && <span>IP: {t.sourceIp}</span>}
                      {t.sourceCountry && <span>· {t.sourceCountry}</span>}
                      {t.targetEndpoint && <span>· {t.targetEndpoint}</span>}
                      {t.detectionMethod && <span>· via {t.detectionMethod}</span>}
                    </div>
                    {t.confidence && (
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground">Confidence:</span>
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full" style={{ width: `${t.confidence * 100}%`, backgroundColor: threatColor }} />
                        </div>
                        <span className="font-bold tabular-nums">{Math.round(t.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!summary.recentThreats || summary.recentThreats.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No threats detected.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "events" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Security Events</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentEvents ?? []).map((e: any) => {
                const Icon = DOMAIN_ICON[e.domain] ?? Activity;
                const color = DOMAIN_COLOR[e.domain] ?? "#6b7280";
                return (
                  <div key={e.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="h-3 w-3 flex-shrink-0" style={{ color }} />
                      <Badge variant="outline" className="text-[9px]" style={{ color }}>{DOMAIN_LABEL[e.domain] ?? e.domain}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[e.severity])}>{e.severity}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", e.status === "resolved" ? "text-emerald-500" : "text-amber-500")}>{e.status}</Badge>
                      <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(e.detectedAt)}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-tight">{e.title}</p>
                    {e.sourceIp && <p className="text-[10px] text-muted-foreground mt-0.5">Source: {e.sourceIp}{e.targetResource ? ` → ${e.targetResource}` : ""}</p>}
                  </div>
                );
              })}
              {(!summary.recentEvents || summary.recentEvents.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No security events.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "backups" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DatabaseBackup className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Backup Records</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Health: {summary.backupHealthScore ?? 0}%</Badge>
                {summary.backupEncrypted && <Badge variant="outline" className="text-[10px] text-emerald-500"><Lock className="h-2.5 w-2.5 mr-0.5" />Encrypted</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentBackups ?? []).map((b: any) => (
                <div key={b.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] capitalize">{b.type}</Badge>
                    <Badge variant="outline" className="text-[9px] capitalize">{b.target}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", b.status === "verified" ? "text-emerald-500" : b.status === "completed" ? "text-sky-500" : b.status === "failed" ? "text-red-500" : "text-muted-foreground")}>
                      {b.status}
                    </Badge>
                    {b.encrypted && <Lock className="h-3 w-3 text-emerald-500" />}
                    <span className="ml-auto text-[9px] text-muted-foreground">{b.completedAt ? timeAgo(b.completedAt) : timeAgo(b.createdAt)}</span>
                  </div>
                  <code className="text-[10px] font-mono text-muted-foreground mt-0.5 block">{b.key}</code>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{formatBytes(b.sizeBytes)}</span>
                    {b.verificationStatus && (
                      <span className={cn("capitalize", b.verificationStatus === "passed" ? "text-emerald-500" : "text-amber-500")}>
                        Verify: {b.verificationStatus}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(!summary.recentBackups || summary.recentBackups.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No backups yet.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "pentests" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sword className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Penetration Test Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(summary.recentPenTests ?? []).map((p: any) => (
                <div key={p.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium flex-1 min-w-0">{p.title}</p>
                    <Badge variant="outline" className="text-[9px] capitalize">{p.type.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", p.remediationStatus === "completed" ? "text-emerald-500" : p.remediationStatus === "in_progress" ? "text-amber-500" : "text-muted-foreground")}>
                      {p.remediationStatus.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{new Date(p.testDate).toLocaleDateString()}</span>
                  </div>
                  {/* Findings breakdown */}
                  <div className="mt-2 flex items-center gap-3 text-[10px]">
                    {p.criticalCount > 0 && <span className="text-red-600 font-medium">{p.criticalCount} critical</span>}
                    {p.highCount > 0 && <span className="text-red-500">{p.highCount} high</span>}
                    {p.mediumCount > 0 && <span className="text-amber-500">{p.mediumCount} medium</span>}
                    {p.lowCount > 0 && <span className="text-sky-500">{p.lowCount} low</span>}
                    <span className="text-muted-foreground">{p.totalFindings} total · {p.remediatedCount} remediated</span>
                  </div>
                  {/* Remediation progress */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-emerald-500" style={{ width: `${p.totalFindings > 0 ? (p.remediatedCount / p.totalFindings) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums">{p.totalFindings > 0 ? Math.round((p.remediatedCount / p.totalFindings) * 100) : 0}%</span>
                  </div>
                </div>
              ))}
              {(!summary.recentPenTests || summary.recentPenTests.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No pen test reports.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "secrets" && (
        <SecretRotationSection />
      )}

      {activeSection === "dr" && (
        <DrPlansSection />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Secret Rotation section (fetches from API)
// ---------------------------------------------------------------------------
function SecretRotationSection() {
  const [secrets, setSecrets] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/v1/security/secrets").then((r) => r.json()).then((d) => setSecrets(d.rotations ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const SECRET_COLOR: Record<string, string> = {
    api_key: "#0ea5e9",
    jwt_secret: "#f59e0b",
    database_password: "#ef4444",
    encryption_key: "#22c55e",
    tls_cert: "#a855f7",
    oauth_secret: "#14b8a6",
    webhook_secret: "#64748b",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Secret Rotation Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
            {secrets.map((s: any) => {
              const color = SECRET_COLOR[s.secretType] ?? "#6b7280";
              const isPending = s.rotationStatus === "scheduled";
              const isOverdue = s.nextRotationAt && new Date(s.nextRotationAt) < new Date();
              return (
                <div key={s.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                      <Lock className="h-3 w-3" />
                    </div>
                    <p className="text-xs font-medium flex-1 min-w-0">{s.secretName}</p>
                    <Badge variant="outline" className="text-[9px]" style={{ color }}>{s.secretType.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", s.rotationStatus === "completed" ? "text-emerald-500" : isOverdue ? "text-red-500" : "text-amber-500")}>
                      {s.rotationStatus}
                      {isOverdue && " (overdue)"}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>v{s.currentVersion}</span>
                    <span>· Rotate every {s.rotationIntervalDays}d</span>
                    {s.lastRotatedAt && <span>· Last: {timeAgo(s.lastRotatedAt)}</span>}
                    {s.nextRotationAt && <span>· Next: {timeAgo(s.nextRotationAt)}</span>}
                  </div>
                </div>
              );
            })}
            {secrets.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No secret rotations tracked.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DR Plans section (fetches from API)
// ---------------------------------------------------------------------------
function DrPlansSection() {
  const [plans, setPlans] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/v1/security/dr-plans").then((r) => r.json()).then((d) => setPlans(d.plans ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const STATUS_COLOR: Record<string, string> = {
    ready: "text-emerald-500",
    degraded: "text-amber-500",
    not_ready: "text-red-500",
    unknown: "text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ServerOff className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Disaster Recovery Plans</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {plans.map((p: any) => (
              <div key={p.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium flex-1 min-w-0">{p.name}</p>
                  <Badge variant="outline" className="text-[9px] capitalize">{p.type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[p.computedStatus ?? p.readinessStatus])}>
                    {(p.computedStatus ?? p.readinessStatus).replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded border border-border/40 p-1.5">
                    <p className="text-[10px] font-bold tabular-nums">{p.rpoMinutes}m</p>
                    <p className="text-[8px] text-muted-foreground uppercase">RPO</p>
                  </div>
                  <div className="rounded border border-border/40 p-1.5">
                    <p className="text-[10px] font-bold tabular-nums">{p.rtoMinutes}m</p>
                    <p className="text-[8px] text-muted-foreground uppercase">RTO</p>
                  </div>
                  <div className="rounded border border-border/40 p-1.5">
                    <p className={cn("text-[10px] font-bold tabular-nums", STATUS_COLOR[p.computedStatus ?? p.readinessStatus])}>{p.computedScore ?? Math.round(p.readinessScore * 100)}%</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Score</p>
                  </div>
                  <div className="rounded border border-border/40 p-1.5">
                    <p className="text-[10px] font-bold tabular-nums">{p.lastTestDurationMin ?? "—"}m</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Test Dur</p>
                  </div>
                </div>
                {p.lastTestedAt && (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span>Last tested: {timeAgo(p.lastTestedAt)}</span>
                    {p.lastTestStatus && <span className={cn("capitalize", p.lastTestStatus === "passed" ? "text-emerald-500" : p.lastTestStatus === "failed" ? "text-red-500" : "text-amber-500")}>· {p.lastTestStatus}</span>}
                  </div>
                )}
              </div>
            ))}
            {plans.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No DR plans.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityKpi({ icon: Icon, label, value, hint, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-3.5 w-3.5 text-muted-foreground", color)} />
        {hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}
      </div>
      <p className={cn("mt-2 text-xl font-bold tabular-nums leading-none", color)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
