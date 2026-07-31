"use client";

import * as React from "react";
import {
  Landmark,
  Map,
  MapPin,
  FileText,
  FolderSearch,
  Users,
  MapPin as MapPinIcon,
  FlaskConical,
  FileCheck,
  Eye,
  ArrowUp,
  CheckCircle2,
  Calendar,
  Clock,
  Gavel,
  Shield,
  AlertTriangle,
  TrendingUp,
  Building2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Status colors
const INV_STATUS_COLOR: Record<string, string> = {
  open: "text-amber-500",
  investigating: "text-sky-500",
  pending_review: "text-purple-500",
  recommended_action: "text-orange-500",
  closed: "text-emerald-500",
  escalated: "text-red-600",
};
const INSP_STATUS_COLOR: Record<string, string> = {
  scheduled: "text-amber-500",
  in_progress: "text-sky-500",
  completed: "text-emerald-500",
  cancelled: "text-muted-foreground",
  failed: "text-red-500",
};
const CASE_STATUS_COLOR: Record<string, string> = {
  filed: "text-amber-500",
  under_review: "text-sky-500",
  active: "text-purple-500",
  pending_hearing: "text-orange-500",
  adjudicated: "text-indigo-500",
  closed: "text-emerald-500",
  appealed: "text-red-600",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-slate-500",
  medium: "text-sky-500",
  high: "text-amber-500",
  urgent: "text-red-600",
};
const COMPLIANCE_COLOR: Record<string, string> = {
  compliant: "text-emerald-500",
  minor_violations: "text-yellow-500",
  major_violations: "text-amber-500",
  critical_violations: "text-red-600",
};
const LEVEL_COLOR: Record<string, string> = {
  national: "#dc2626",
  regional: "#f59e0b",
  district: "#0ea5e9",
};
const LEVEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  national: Landmark,
  regional: Map,
  district: MapPin,
};

const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  opened: FileText,
  evidence_collected: FolderSearch,
  witness_interviewed: Users,
  site_visited: MapPinIcon,
  lab_analysis: FlaskConical,
  report_filed: FileCheck,
  reviewed: Eye,
  escalated: ArrowUp,
  closed: CheckCircle2,
};
const CASE_EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  filed: FileText,
  assigned: CheckCircle2,
  hearing_scheduled: Calendar,
  evidence_submitted: FolderSearch,
  witness_added: Users,
  motion_filed: FileText,
  ruling: Gavel,
  adjourned: Clock,
  settled: CheckCircle2,
  closed: CheckCircle2,
  appealed: ArrowUp,
};

function formatGHS(n: number) {
  return `₵${n.toLocaleString("en-GH", { maximumFractionDigits: 0 })}`;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function GovernmentDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [dashboard, setDashboard] = React.useState<any>(null);
  const [level, setLevel] = React.useState<"national" | "regional" | "district">("national");
  const [region, setRegion] = React.useState<string>("Western");
  const [district, setDistrict] = React.useState<string>("Prestea-Huni Valley");
  const [selectedTab, setSelectedTab] = React.useState<"investigations" | "inspections" | "cases">("investigations");
  const [loadingDashboard, setLoadingDashboard] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/government/summary", { cache: "no-store" });
      if (r.ok) setSummary(await r.json());
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Fetch dashboard when level/region/district changes
  React.useEffect(() => {
    setLoadingDashboard(true);
    const params = new URLSearchParams({ level });
    if (level === "regional" || level === "district") params.set("region", region);
    if (level === "district") params.set("district", district);
    fetch(`/api/v1/government/dashboard?${params}`)
      .then((r) => r.json())
      .then((d) => setDashboard(d))
      .catch(() => {})
      .finally(() => setLoadingDashboard(false));
  }, [level, region, district]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <GovKpi icon={FileText} label="Investigations" value={summary.totalInvestigations ?? 0} hint="total" />
        <GovKpi icon={Calendar} label="Inspections" value={summary.totalInspections ?? 0} hint={`${summary.completedInspections ?? 0} done`} />
        <GovKpi icon={Gavel} label="Cases" value={summary.totalCases ?? 0} hint="total" />
        <GovKpi icon={AlertTriangle} label="Overdue" value={summary.overdueCases ?? 0} hint="SLA breached" />
        <GovKpi icon={TrendingUp} label="Est. Damages" value={formatGHS(summary.totalEstimatedDamagesGHS ?? 0)} hint="cases" />
        <GovKpi icon={CheckCircle2} label="Fines Imposed" value={formatGHS(summary.totalFinesImposedGHS ?? 0)} hint="collected" />
        <GovKpi icon={Shield} label="Est. Impact" value={formatGHS(summary.totalEstimatedImpactGHS ?? 0)} hint="investigations" />
        <GovKpi icon={FolderSearch} label="Findings" value={summary.totalFindings ?? 0} hint="violations" />
      </div>

      {/* Dashboard level toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Government Operations Center</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Level toggle */}
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                {(["national", "regional", "district"] as const).map((lv) => {
                  const Icon = LEVEL_ICON[lv];
                  const isActive = level === lv;
                  return (
                    <button
                      key={lv}
                      onClick={() => setLevel(lv)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize",
                        isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {lv}
                    </button>
                  );
                })}
              </div>
              {/* Region selector */}
              {level !== "national" && (
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {["Western", "Ashanti", "Eastern", "Central", "Western North", "Greater Accra"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
              {/* District selector */}
              {level === "district" && (
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {(region === "Western" ? ["Prestea-Huni Valley", "Tarkwa-Nsuaem", "Wassa Amenfi East"] :
                    region === "Ashanti" ? ["Obuasi Municipal", "Amansie Central", "Amansie West"] :
                    region === "Eastern" ? ["Atiwa East", "Atiwa West", "Kwaebibirem"] :
                    region === "Central" ? ["Upper Denkyira East", "Upper Denkyira West"] :
                    region === "Western North" ? ["Bibiani-Anhwiaso-Bekwai", "Sefwi-Wiawso"] :
                    ["Accra Metropolitan", "Ga West"]
                  ).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDashboard ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : dashboard ? (
            <div className="space-y-4">
              {/* Dashboard metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                <MetricBox label="Investigations" value={dashboard.metrics?.totals?.investigations ?? 0} color="#f59e0b" />
                <MetricBox label="Open" value={dashboard.metrics?.totals?.openInvestigations ?? 0} color="#0ea5e9" />
                <MetricBox label="Inspections" value={dashboard.metrics?.totals?.inspections ?? 0} color="#22c55e" />
                <MetricBox label="Completed" value={dashboard.metrics?.totals?.completedInspections ?? 0} color="#14b8a6" />
                <MetricBox label="Cases" value={dashboard.metrics?.totals?.cases ?? 0} color="#a855f7" />
                <MetricBox label="Closed Cases" value={dashboard.metrics?.totals?.closedCases ?? 0} color="#22c55e" />
              </div>

              {/* Regional/District breakdown */}
              {dashboard.regions && (
                <div>
                  <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Regional Breakdown</p>
                  <div className="space-y-1.5">
                    {dashboard.regions.map((r: any) => (
                      <div key={r.region} className="flex items-center gap-2 rounded border border-border/40 p-2">
                        <Map className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-xs font-medium">{r.region}</span>
                        <Badge variant="outline" className="text-[9px]">{r.investigations} inv</Badge>
                        <Badge variant="outline" className="text-[9px]">{r.inspections} insp</Badge>
                        <Badge variant="outline" className="text-[9px]">{r.cases} cases</Badge>
                        <span className={cn("text-[10px] font-bold", COMPLIANCE_COLOR[r.complianceScore >= 0.8 ? "compliant" : r.complianceScore >= 0.5 ? "minor_violations" : "major_violations"])}>
                          {Math.round(r.complianceScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.districts && (
                <div>
                  <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Districts in {region}</p>
                  <div className="space-y-1.5">
                    {dashboard.districts.map((d: any) => (
                      <div key={d.district} className="flex items-center gap-2 rounded border border-border/40 p-2">
                        <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-xs font-medium">{d.district}</span>
                        <Badge variant="outline" className="text-[9px]">{d.investigations} inv</Badge>
                        <Badge variant="outline" className="text-[9px]">{d.inspections} insp</Badge>
                        <Badge variant="outline" className="text-[9px]">{d.cases} cases</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.sites && dashboard.sites.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Sites in {district}</p>
                  <div className="space-y-1.5">
                    {dashboard.sites.map((s: any) => (
                      <div key={s.targetName} className="flex items-center gap-2 rounded border border-border/40 p-2">
                        <MapPinIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-xs font-medium">{s.targetName}</span>
                        <Badge variant="outline" className="text-[9px]">{s.targetType}</Badge>
                        <Badge variant="outline" className="text-[9px]">{s.inspectionCount} inspections</Badge>
                        {s.violationCount > 0 && <Badge variant="outline" className="text-[9px] text-red-500">{s.violationCount} violations</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-border/40 bg-card/40 p-2 text-center">
                  <p className="text-sm font-bold tabular-nums">{formatGHS(dashboard.metrics?.financials?.estimatedDamagesGHS ?? 0)}</p>
                  <p className="text-[8px] text-muted-foreground uppercase">Damages</p>
                </div>
                <div className="rounded border border-border/40 bg-card/40 p-2 text-center">
                  <p className="text-sm font-bold tabular-nums text-emerald-500">{formatGHS(dashboard.metrics?.financials?.finesImposedGHS ?? 0)}</p>
                  <p className="text-[8px] text-muted-foreground uppercase">Fines</p>
                </div>
                <div className="rounded border border-border/40 bg-card/40 p-2 text-center">
                  <p className="text-sm font-bold tabular-nums text-amber-500">{formatGHS(dashboard.metrics?.financials?.estimatedImpactGHS ?? 0)}</p>
                  <p className="text-[8px] text-muted-foreground uppercase">Impact</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Select a level to view dashboard.</p>
          )}
        </CardContent>
      </Card>

      {/* Workflow tabs */}
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {([
          { id: "investigations", label: "Investigations", icon: FileText, count: summary.totalInvestigations },
          { id: "inspections", label: "Inspections", icon: Calendar, count: summary.totalInspections },
          { id: "cases", label: "Cases", icon: Gavel, count: summary.totalCases },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              <span className="ml-1 rounded bg-muted/50 px-1 text-[9px] tabular-nums">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Workflow content */}
      {selectedTab === "investigations" && (
        <InvestigationsList summary={summary} />
      )}
      {selectedTab === "inspections" && (
        <InspectionsList summary={summary} />
      )}
      {selectedTab === "cases" && (
        <CasesList summary={summary} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investigations list
// ---------------------------------------------------------------------------
function InvestigationsList({ summary }: { summary: any }) {
  const investigations = summary.recentInvestigations ?? [];
  const [selected, setSelected] = React.useState<any>(null);
  const [detail, setDetail] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/v1/government/investigations/${selected.id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected?.id]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Investigations</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[480px] space-y-2 overflow-y-auto -mr-2 pr-2">
            {investigations.map((inv: any) => (
              <button
                key={inv.id}
                onClick={() => setSelected(inv)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  selected?.id === inv.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50",
                )}
              >
                <div className="flex items-start gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] capitalize">{inv.type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", PRIORITY_COLOR[inv.priority])}>{inv.priority}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", INV_STATUS_COLOR[inv.status])}>{inv.status.replace(/_/g, " ")}</Badge>
                  <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(inv.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs font-medium leading-tight line-clamp-2">{inv.title}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  {inv.region && <span>{inv.region}{inv.district ? ` · ${inv.district}` : ""}</span>}
                  {inv.agencyName && <span>· {inv.agencyName}</span>}
                  <span>· {inv.stepCount} steps · {inv.inspectionCount} inspections</span>
                </div>
              </button>
            ))}
            {investigations.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No investigations yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Detail panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Investigation Detail</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {selected ? (
            loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : detail ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium leading-tight">{detail.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{detail.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{detail.type.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">Priority:</span> <span className={cn("font-medium capitalize", PRIORITY_COLOR[detail.priority])}>{detail.priority}</span></div>
                  <div><span className="text-muted-foreground">Level:</span> <span className="font-medium capitalize">{detail.level}</span></div>
                  <div><span className="text-muted-foreground">Impact:</span> <span className="font-bold">{formatGHS(detail.estimatedImpactGHS)}</span></div>
                </div>

                {detail.triggerDescription && (
                  <div className="rounded border border-border/40 p-2">
                    <p className="text-[9px] text-muted-foreground uppercase">Trigger</p>
                    <p className="text-[10px] mt-0.5">{detail.triggerDescription}</p>
                  </div>
                )}

                {/* Workflow steps */}
                {detail.steps?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Workflow Timeline</p>
                    <div className="space-y-2">
                      {detail.steps.map((step: any, i: number) => {
                        const Icon = STEP_ICON[step.stepType] ?? FileText;
                        return (
                          <div key={step.id} className="flex items-start gap-2">
                            <div className="flex flex-col items-center">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                                <Icon className="h-3 w-3 text-primary" />
                              </div>
                              {i < detail.steps.length - 1 && <div className="w-px h-4 bg-border" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium">{step.title}</p>
                              <p className="text-[9px] text-muted-foreground line-clamp-2">{step.description}</p>
                              {step.outcome && <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">→ {step.outcome}</p>}
                              <p className="text-[8px] text-muted-foreground mt-0.5">{timeAgo(step.performedAt)}{step.performedByName ? ` · ${step.performedByName}` : ""}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {detail.recommendedAction && (
                  <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Recommended Action: {detail.recommendedAction.replace(/_/g, " ")}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Failed to load.</p>
            )
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Select an investigation to see details.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspections list
// ---------------------------------------------------------------------------
function InspectionsList({ summary }: { summary: any }) {
  const inspections = summary.recentInspections ?? [];
  const [selected, setSelected] = React.useState<any>(null);
  const [detail, setDetail] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/v1/government/inspections/${selected.id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected?.id]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Inspections</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[480px] space-y-2 overflow-y-auto -mr-2 pr-2">
            {inspections.map((insp: any) => (
              <button
                key={insp.id}
                onClick={() => setSelected(insp)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  selected?.id === insp.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50",
                )}
              >
                <div className="flex items-start gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] capitalize">{insp.type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", INSP_STATUS_COLOR[insp.status])}>{insp.status.replace(/_/g, " ")}</Badge>
                  {insp.complianceLevel && <Badge variant="outline" className={cn("text-[9px] capitalize", COMPLIANCE_COLOR[insp.complianceLevel])}>{insp.complianceLevel.replace(/_/g, " ")}</Badge>}
                  <span className="ml-auto text-[9px] text-muted-foreground">{insp.scheduledAt ? timeAgo(insp.scheduledAt) : ""}</span>
                </div>
                <p className="mt-1 text-xs font-medium leading-tight line-clamp-1">{insp.title}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{insp.targetName}</span>
                  {insp.region && <span>· {insp.region}</span>}
                  <span>· {insp.violationCount} violations · {insp.findingCount} findings</span>
                </div>
              </button>
            ))}
            {inspections.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No inspections yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Inspection Detail</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {selected ? (
            loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : detail ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium leading-tight">{detail.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{detail.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-muted-foreground">Target:</span> <span className="font-medium">{detail.targetName}</span></div>
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{detail.type.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">Inspector:</span> <span className="font-medium">{detail.inspectorName ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Agency:</span> <span className="font-medium">{detail.agencyName ?? "—"}</span></div>
                </div>
                {detail.complianceLevel && (
                  <div className="rounded border border-border/40 p-2 text-center">
                    <p className={cn("text-sm font-bold capitalize", COMPLIANCE_COLOR[detail.complianceLevel])}>{detail.complianceLevel.replace(/_/g, " ")}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Compliance Level</p>
                  </div>
                )}

                {/* Findings */}
                {detail.findings?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Findings ({detail.findings.length})</p>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto -mr-2 pr-2">
                      {detail.findings.map((f: any) => (
                        <div key={f.id} className="rounded border border-border/40 p-2">
                          <div className="flex items-center gap-2 text-[10px]">
                            <Badge variant="outline" className="text-[8px] capitalize">{f.findingType.replace(/_/g, " ")}</Badge>
                            <Badge variant="outline" className={cn("text-[8px] capitalize", PRIORITY_COLOR[f.severity] ?? "text-amber-500")}>{f.severity}</Badge>
                            {f.resolved && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-1">{f.description}</p>
                          {f.violation && <p className="text-[8px] text-red-500 mt-0.5">{f.violation}</p>}
                          {f.penalty && <p className="text-[8px] text-amber-600 dark:text-amber-400">{f.penalty}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.overallResult && (
                  <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Result: {detail.overallResult.replace(/_/g, " ")}</p>
                    {detail.followUpRequired && <p className="text-[9px] text-muted-foreground mt-0.5">Follow-up required</p>}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Failed to load.</p>
            )
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Select an inspection to see details.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cases list
// ---------------------------------------------------------------------------
function CasesList({ summary }: { summary: any }) {
  const cases = summary.recentCases ?? [];
  const [selected, setSelected] = React.useState<any>(null);
  const [detail, setDetail] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/v1/government/cases/${selected.id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected?.id]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Case Management</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[480px] space-y-2 overflow-y-auto -mr-2 pr-2">
            {cases.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  selected?.id === c.id ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:bg-accent/50",
                )}
              >
                <div className="flex items-start gap-2 flex-wrap">
                  <code className="text-[9px] font-mono font-bold text-primary">{c.caseNumber}</code>
                  <Badge variant="outline" className="text-[9px] capitalize">{c.type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", PRIORITY_COLOR[c.priority])}>{c.priority}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", CASE_STATUS_COLOR[c.status])}>{c.status.replace(/_/g, " ")}</Badge>
                  <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(c.filedAt)}</span>
                </div>
                <p className="mt-1 text-xs font-medium leading-tight line-clamp-2">{c.title}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  {c.leadAgencyName && <span>{c.leadAgencyName}</span>}
                  <span>· {formatGHS(c.estimatedDamagesGHS)} damages</span>
                  {c.finesImposedGHS > 0 && <span className="text-emerald-500">· {formatGHS(c.finesImposedGHS)} fines</span>}
                  <span>· {c.investigationCount} inv · {c.eventCount} events</span>
                </div>
              </button>
            ))}
            {cases.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No cases yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Case Detail</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {selected ? (
            loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : detail ? (
              <div className="space-y-3">
                <div>
                  <code className="text-[10px] font-mono font-bold text-primary">{detail.caseNumber}</code>
                  <p className="text-xs font-medium leading-tight mt-0.5">{detail.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{detail.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{detail.type.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">Level:</span> <span className="font-medium capitalize">{detail.level}</span></div>
                  <div><span className="text-muted-foreground">Defendant:</span> <span className="font-medium">{detail.defendantName ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Prosecutor:</span> <span className="font-medium">{detail.prosecutingAgencyName ?? "—"}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-border/40 p-2 text-center">
                    <p className="text-sm font-bold tabular-nums">{formatGHS(detail.estimatedDamagesGHS)}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Damages</p>
                  </div>
                  <div className="rounded border border-border/40 p-2 text-center">
                    <p className="text-sm font-bold tabular-nums text-emerald-500">{formatGHS(detail.finesImposedGHS)}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Fines</p>
                  </div>
                </div>

                {/* Linked investigations */}
                {detail.investigations?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Linked Investigations ({detail.investigations.length})</p>
                    <div className="space-y-1">
                      {detail.investigations.map((ci: any) => (
                        <div key={ci.id} className="rounded border border-border/40 p-1.5 text-[10px]">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate font-medium">{ci.investigation.title}</span>
                            <Badge variant="outline" className={cn("text-[8px] capitalize", INV_STATUS_COLOR[ci.investigation.status])}>{ci.investigation.status.replace(/_/g, " ")}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Case events timeline */}
                {detail.events?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Case Timeline ({detail.events.length} events)</p>
                    <div className="space-y-2">
                      {detail.events.map((e: any, i: number) => {
                        const Icon = CASE_EVENT_ICON[e.eventType] ?? FileText;
                        return (
                          <div key={e.id} className="flex items-start gap-2">
                            <div className="flex flex-col items-center">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                                <Icon className="h-2.5 w-2.5 text-primary" />
                              </div>
                              {i < detail.events.length - 1 && <div className="w-px h-3 bg-border" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium">{e.title}</p>
                              <p className="text-[9px] text-muted-foreground line-clamp-2">{e.description}</p>
                              <p className="text-[8px] text-muted-foreground mt-0.5">{timeAgo(e.eventDate)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {detail.resolution && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                    <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 capitalize">Resolution: {detail.resolution}</p>
                    {detail.resolutionNotes && <p className="text-[9px] text-muted-foreground mt-0.5">{detail.resolutionNotes}</p>}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Failed to load.</p>
            )
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Select a case to see details.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function GovKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
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

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded border border-border/40 bg-card/40 p-2 text-center">
      <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
