"use client";

import * as React from "react";
import {
  Accessibility, Languages, WifiOff, Smartphone, Activity, Siren, BookOpen, ClipboardCheck,
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Rocket, RotateCcw, Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DOMAIN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  accessibility: Accessibility, i18n: Languages, offline: WifiOff, mobile: Smartphone,
  monitoring: Activity, incident_response: Siren, runbooks: BookOpen, audit: ClipboardCheck,
};
const DOMAIN_COLOR: Record<string, string> = {
  accessibility: "#0ea5e9", i18n: "#22c55e", offline: "#f59e0b", mobile: "#a855f7",
  monitoring: "#14b8a6", incident_response: "#ef4444", runbooks: "#6366f1", audit: "#ec4899",
};
const DOMAIN_LABEL: Record<string, string> = {
  accessibility: "Accessibility", i18n: "Internationalization", offline: "Offline-First", mobile: "Mobile",
  monitoring: "Monitoring", incident_response: "Incident Response", runbooks: "Runbooks", audit: "Final Audit",
};
const SEVERITY_COLOR: Record<string, string> = { SEV1: "text-red-600", SEV2: "text-red-500", SEV3: "text-amber-500", SEV4: "text-sky-500", SEV5: "text-muted-foreground" };
const STATUS_COLOR: Record<string, string> = { passed: "text-emerald-500", warning: "text-amber-500", failed: "text-red-500", pending: "text-muted-foreground", not_applicable: "text-muted-foreground" };
const DEPLOY_STATUS_COLOR: Record<string, string> = { success: "text-emerald-500", failed: "text-red-500", rolled_back: "text-amber-500", building: "text-sky-500", deploying: "text-purple-500", idle: "text-muted-foreground" };

function timeAgo(d: string) { const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }

export function ProductionDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [activeSection, setActiveSection] = React.useState<"domains" | "incidents" | "runbooks" | "accessibility" | "i18n" | "deployments">("domains");

  const refresh = React.useCallback(async () => { try { const r = await fetch("/api/v1/production/summary", { cache: "no-store" }); if (r.ok) setSummary(await r.json()); } catch {} }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  const scoreColor = summary.color ?? "#64748b";
  const domains = summary.domains ?? [];

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <ProdKpi icon={ClipboardCheck} label="Readiness" value={`${summary.overallScore ?? 0}%`} hint={summary.level ?? "Unknown"} color={scoreColor} />
        <ProdKpi icon={CheckCircle2} label="Checks Passed" value={`${summary.passedChecks ?? 0}/${summary.totalChecks ?? 0}`} hint={`${summary.failedChecks ?? 0} failed`} color="text-emerald-500" />
        <ProdKpi icon={Siren} label="Active Incidents" value={String(summary.activeIncidents ?? 0)} hint={`${summary.sev1Count ?? 0} SEV1`} color="text-red-500" />
        <ProdKpi icon={Clock} label="Avg MTTR" value={`${summary.avgMttr ?? 0}m`} hint="mean time to resolve" color="text-amber-500" />
        <ProdKpi icon={Accessibility} label="A11y Score" value={`${summary.avgAccessibilityScore ?? 0}%`} hint="WCAG AA" color="text-sky-500" />
        <ProdKpi icon={BookOpen} label="Runbooks" value={String(summary.totalRunbooks ?? 0)} hint="active" color="text-indigo-500" />
        <ProdKpi icon={Globe} label="Locales" value={String(summary.activeLocales ?? 0)} hint={`of ${summary.totalLocales ?? 0}`} color="text-green-500" />
        <ProdKpi icon={Rocket} label="Prod Deploys" value={String(summary.prodDeploys ?? 0)} hint="successful" color="text-teal-500" />
      </div>

      {/* Section tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
        {([ { id: "domains", label: "8 Domains", icon: ClipboardCheck }, { id: "incidents", label: "Incidents", icon: Siren }, { id: "runbooks", label: "Runbooks", icon: BookOpen }, { id: "accessibility", label: "Accessibility", icon: Accessibility }, { id: "i18n", label: "I18n", icon: Globe }, { id: "deployments", label: "Deployments", icon: Rocket } ] as const).map((tab) => {
          const Icon = tab.icon; const isActive = activeSection === tab.id;
          return <button key={tab.id} onClick={() => setActiveSection(tab.id)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}><Icon className="h-3.5 w-3.5" /> {tab.label}</button>;
        })}
      </div>

      {/* Section content */}
      {activeSection === "domains" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Production Readiness — 8 Domains</CardTitle></div><Badge variant="outline" className="text-[10px]" style={{ color: scoreColor }}>{summary.overallScore}% ({summary.level})</Badge></div></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {domains.map((d: any) => {
                const Icon = DOMAIN_ICON[d.domain] ?? ClipboardCheck; const color = DOMAIN_COLOR[d.domain] ?? "#6b7280";
                return (
                  <div key={d.domain} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 mb-1.5"><div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}><Icon className="h-3.5 w-3.5" /></div><span className="text-[11px] font-medium" style={{ color }}>{DOMAIN_LABEL[d.domain] ?? d.domain}</span></div>
                    <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full transition-all" style={{ width: `${d.score}%`, backgroundColor: d.color }} /></div><span className="text-[10px] font-bold tabular-nums">{d.score}%</span></div>
                    <div className="mt-1.5 flex items-center gap-3 text-[9px]"><span className="text-emerald-500">{d.passed} ✓</span><span className="text-amber-500">{d.warning} ⚠</span><span className="text-red-500">{d.failed} ✗</span></div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "incidents" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Siren className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Incident Reports</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentIncidents ?? []).map((inc: any) => (
                <div key={inc.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[9px] font-bold", SEVERITY_COLOR[inc.severity])}>{inc.severity}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", inc.status === "resolved" ? "text-emerald-500" : inc.status === "mitigated" ? "text-amber-500" : "text-red-500")}>{inc.status}</Badge>
                    {inc.mttrMinutes && <span className="text-[9px] text-muted-foreground">MTTR: {inc.mttrMinutes}m</span>}
                    <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(inc.detectedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium leading-tight">{inc.title}</p>
                  {inc.oncallEngineer && <p className="text-[10px] text-muted-foreground mt-0.5">On-call: {inc.oncallEngineer}{inc.affectedUsers > 0 ? ` · ${inc.affectedUsers} users affected` : ""}</p>}
                  {inc.rootCause && <p className="text-[9px] text-muted-foreground mt-1 italic">Root cause: {inc.rootCause}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "runbooks" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Operational Runbooks</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.locales ?? []).length > 0 && (summary.recentDeployments ?? []).length > 0 && (summary.audits ?? []).length > 0 ? null : null}
              {/* Runbooks are fetched via the listRunbooks endpoint, but we show a summary from summary API if available */}
              <RunbooksSection />
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "accessibility" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Accessibility className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Accessibility Audits (WCAG 2.1 AA)</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.audits ?? []).map((a: any) => (
                <div key={a.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px]">{a.targetLevel}</Badge>
                    <Badge variant="outline" className={cn("text-[9px]", a.achievedLevel === "AA" ? "text-emerald-500" : "text-amber-500")}>Achieved: {a.achievedLevel ?? "none"}</Badge>
                    <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(a.auditedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium">{a.title}</p>
                  <code className="text-[9px] font-mono text-muted-foreground block mt-0.5">{a.pageUrl}</code>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                    <span className="text-emerald-500">{a.passedChecks} passed</span>
                    <span className="text-amber-500">{a.warningChecks} warnings</span>
                    <span className="text-red-500">{a.failedChecks} failed</span>
                    <span className="font-bold ml-auto" style={{ color: a.complianceScore >= 95 ? "#22c55e" : a.complianceScore >= 80 ? "#0ea5e9" : "#f59e0b" }}>{a.complianceScore}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${a.complianceScore}%`, backgroundColor: a.complianceScore >= 95 ? "#22c55e" : a.complianceScore >= 80 ? "#0ea5e9" : "#f59e0b" }} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "i18n" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Internationalization (i18n)</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(summary.locales ?? []).map((l: any) => (
                <div key={l.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] font-mono">{l.locale}</Badge>
                    <span className="text-xs font-medium">{l.language}</span>
                    <span className="text-[10px] text-muted-foreground">({l.nativeName})</span>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", l.status === "active" ? "text-emerald-500" : "text-amber-500")}>{l.status}</Badge>
                    {l.direction === "rtl" && <Badge variant="outline" className="text-[9px] text-purple-500">RTL</Badge>}
                    <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: l.translationPct >= 90 ? "#22c55e" : l.translationPct >= 70 ? "#0ea5e9" : "#f59e0b" }}>{l.translationPct}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{l.translatedKeys}/{l.totalKeys} keys translated</span>
                    {l.missingKeys > 0 && <span className="text-amber-500">{l.missingKeys} missing</span>}
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${l.translationPct}%`, backgroundColor: l.translationPct >= 90 ? "#22c55e" : l.translationPct >= 70 ? "#0ea5e9" : "#f59e0b" }} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "deployments" && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Deployment Pipeline</CardTitle></div></CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {(summary.recentDeployments ?? []).map((d: any) => (
                <div key={d.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] capitalize">{d.environment}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", DEPLOY_STATUS_COLOR[d.status])}>{d.status.replace(/_/g, " ")}</Badge>
                    {d.version && <code className="text-[9px] font-mono">v{d.version}</code>}
                    {d.branch && <code className="text-[9px] font-mono text-muted-foreground">{d.branch}</code>}
                    {d.durationSec && <span className="text-[9px] text-muted-foreground">{d.durationSec}s</span>}
                    <span className="ml-auto text-[9px] text-muted-foreground">{d.triggeredAt ? timeAgo(d.triggeredAt) : ""}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium">{d.name}</p>
                  {d.triggeredBy && <p className="text-[10px] text-muted-foreground mt-0.5">Triggered by: {d.triggeredBy}</p>}
                  {d.status === "rolled_back" && <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500"><RotateCcw className="h-2.5 w-2.5" /> Rolled back to previous version</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RunbooksSection() {
  const [runbooks, setRunbooks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { fetch("/api/v1/production/runbooks").then(r => r.json()).then(d => setRunbooks(d.runbooks ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <p className="py-8 text-center text-xs text-muted-foreground">Loading runbooks...</p>;
  if (runbooks.length === 0) return <p className="py-8 text-center text-xs text-muted-foreground">No runbooks found.</p>;
  return <>{runbooks.map((r: any) => (
    <div key={r.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[9px] capitalize">{r.category}</Badge>
        <Badge variant="outline" className={cn("text-[9px]", r.status === "active" ? "text-emerald-500" : "text-amber-500")}>{r.status}</Badge>
        <span className="text-[9px] text-muted-foreground">v{r.version}</span>
        {r.estimatedTime && <span className="text-[9px] text-muted-foreground">~{r.estimatedTime}min</span>}
      </div>
      <p className="mt-1 text-xs font-medium">{r.title}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
    </div>
  ))}</>;
}

function ProdKpi({ icon: Icon, label, value, hint, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between"><Icon className={cn("h-3.5 w-3.5 text-muted-foreground", color)} />{hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}</div>
      <p className={cn("mt-2 text-xl font-bold tabular-nums leading-none", color)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
