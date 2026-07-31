"use client";

import * as React from "react";
import { Eye, Mountain, Route, Trash2, TreePine, Droplets, Building2, Truck, Loader2, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  excavation: { label: "Excavation", icon: Mountain, color: "#ef4444" },
  roads: { label: "Roads", icon: Route, color: "#64748b" },
  tailings: { label: "Tailings", icon: Trash2, color: "#f97316" },
  forest_loss: { label: "Forest Loss", icon: TreePine, color: "#22c55e" },
  water_changes: { label: "Water Changes", icon: Droplets, color: "#0ea5e9" },
  buildings: { label: "Buildings", icon: Building2, color: "#a78bfa" },
  equipment: { label: "Equipment", icon: Truck, color: "#14b8a6" },
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-sky-500", medium: "text-amber-500", high: "text-orange-500", critical: "text-destructive",
};

function timeAgo(d: string) { const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff/60000); if (m<60) return `${m}m ago`; const h = Math.floor(m/60); if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; }

export function CVDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [results, setResults] = React.useState<any[]>(initialSummary.recent ?? []);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const [sumRes, resRes] = await Promise.all([
        fetch("/api/v1/cv/summary", { cache: "no-store" }),
        fetch("/api/v1/cv/results?limit=50", { cache: "no-store" }),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (resRes.ok) { const d = await resRes.json(); setResults(d.results ?? []); }
    } catch {}
  }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  const filteredResults = selectedType ? results.filter((r: any) => r.type === selectedType) : results;

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <CVKpi icon={Eye} label="Total" value={summary.total ?? 0} hint="detections" />
        <CVKpi icon={Zap} label="Detected" value={summary.detected ?? 0} hint={`${((summary.detectionRate ?? 0) * 100).toFixed(0)}% rate`} />
        <CVKpi icon={AlertTriangle} label="Avg Conf" value={`${((summary.avgConfidence ?? 0) * 100).toFixed(0)}%`} hint="confidence" />
        <CVKpi icon={Eye} label="Batches" value={summary.batches?.completed ?? 0} hint="completed" />
        {Object.entries(TYPE_META).slice(0, 4).map(([key, meta]) => {
          const typeData = summary.byType?.find((t: any) => t.type === key);
          return <CVKpi key={key} icon={meta.icon} label={meta.label} value={typeData?.count ?? 0} hint={typeData ? `${(typeData.avgConfidence * 100).toFixed(0)}% conf` : "none"} />;
        })}
      </div>

      {/* Detection results + type filter */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        {/* Results gallery */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><CardTitle className="text-sm">AI Detection Results</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">Real VLM AI · {results.length} results</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Type filter */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={() => setSelectedType(null)} className={cn("rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors", !selectedType ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent/50")}>All Types</button>
              {Object.entries(TYPE_META).map(([key, meta]) => (
                <button key={key} onClick={() => setSelectedType(key)} className={cn("flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors", selectedType === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent/50")}>
                  <meta.icon className="h-2.5 w-2.5" style={{ color: meta.color }} />
                  {meta.label}
                </button>
              ))}
            </div>

            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {filteredResults.map((r: any) => {
                const meta = TYPE_META[r.type] ?? TYPE_META.equipment;
                const Icon = meta.icon;
                return (
                  <div key={r.id} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors", r.detected ? "border-primary/30 bg-primary/5" : "border-border bg-card/30")}>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: meta.color + "20", color: meta.color }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{meta.label}</p>
                        {r.detected ? (
                          <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400">DETECTED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">Not Found</Badge>
                        )}
                        {r.severity && <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[r.severity])}>{r.severity}</Badge>}
                        <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{r.description}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full" style={{ width: `${r.confidence * 100}%`, backgroundColor: meta.color }} />
                          </span>
                          <span className="font-bold tabular-nums">{(r.confidence * 100).toFixed(0)}%</span>
                        </span>
                        <span>·</span>
                        <span>{(r.processingMs / 1000).toFixed(1)}s</span>
                        <span>·</span>
                        <span className="font-mono text-[9px] truncate">{r.imageUrl}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredResults.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No detection results yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Type distribution + AI info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Detection by Type</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(TYPE_META).map(([key, meta]) => {
                  const typeData = summary.byType?.find((t: any) => t.type === key);
                  const count = typeData?.count ?? 0;
                  const maxCount = Math.max(...(summary.byType?.map((t: any) => t.count) ?? [1]), 1);
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <meta.icon className="h-3 w-3 flex-shrink-0" style={{ color: meta.color }} />
                      <span className="w-20 text-[10px] font-medium">{meta.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                      </div>
                      <span className="w-8 text-right text-[10px] font-bold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold tabular-nums">{summary.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Total</p></div>
                <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.detected ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Detected</p></div>
                <div><p className="text-lg font-bold tabular-nums">{((summary.avgConfidence ?? 0) * 100).toFixed(0)}%</p><p className="text-[9px] text-muted-foreground uppercase">Avg Conf</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Real AI Engine</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                  <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" /><p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">VLM (Vision Language Model)</p></div>
                  <p className="text-[9px] text-muted-foreground mt-1">Real AI via z-ai-web-dev-sdk — analyzes actual image pixels</p>
                </div>
                <div className="rounded border border-sky-500/30 bg-sky-500/5 p-2">
                  <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">7 Detection Types</p>
                  <p className="text-[9px] text-muted-foreground">Excavation, Roads, Tailings, Forest Loss, Water Changes, Buildings, Equipment</p>
                </div>
                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Structured Output</p>
                  <p className="text-[9px] text-muted-foreground">JSON: detected, confidence, severity, area, description</p>
                </div>
                <div className="rounded border border-violet-500/30 bg-violet-500/5 p-2">
                  <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400">Batch Processing</p>
                  <p className="text-[9px] text-muted-foreground">Run all 7 types on satellite scenes or evidence images</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CVKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
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
