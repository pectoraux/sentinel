"use client";

import * as React from "react";
import { Satellite, Layers, Clock, Archive, Database, Cloud, Loader2, CheckCircle2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SAT_COLOR: Record<string, string> = { sentinel2: "#0ea5e9", landsat8: "#22c55e", sentinel1: "#f59e0b", landsat9: "#8b5cf6" };
const SAT_LABEL: Record<string, string> = { sentinel2: "Sentinel-2", landsat8: "Landsat-8", sentinel1: "Sentinel-1", landsat9: "Landsat-9" };
const STAGE_COLOR: Record<string, string> = { pending: "#64748b", downloading: "#0ea5e9", rectifying: "#8b5cf6", tiling: "#f59e0b", caching: "#14b8a6", ready: "#22c55e", archived: "#6b7280", failed: "#ef4444" };

function timeAgo(d: string) { const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff/60000); if (m<60) return `${m}m ago`; const h = Math.floor(m/60); if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; }
function formatBytes(b: number) { if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; if (b < 1073741824) return `${(b/1048576).toFixed(1)} MB`; return `${(b/1073741824).toFixed(2)} GB`; }

export function SatelliteDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const refresh = React.useCallback(async () => { try { const r = await fetch("/api/v1/satellite/summary", {cache:"no-store"}); if (r.ok) setSummary(await r.json()); } catch {} }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <SatKpi icon={Satellite} label="Scenes" value={summary.scenes?.total ?? 0} hint={`${summary.scenes?.bySatellite?.length ?? 0} satellites`} />
        <SatKpi icon={Layers} label="Tiles" value={summary.tiles?.total ?? 0} hint={`${summary.tiles?.cached ?? 0} cached`} />
        <SatKpi icon={Database} label="Cache Size" value={summary.tiles?.totalSizeFormatted ?? "0 B"} hint="storage" />
        <SatKpi icon={Cloud} label="Avg Cloud" value={`${(summary.scenes?.avgCloudCover ?? 0).toFixed(0)}%`} hint="cloud cover" />
        <SatKpi icon={Clock} label="Schedules" value={summary.schedules?.active ?? 0} hint="active" />
        <SatKpi icon={Archive} label="Archived" value={summary.scenes?.archived ?? 0} hint="historical" />
        <SatKpi icon={CheckCircle2} label="Ready" value={summary.scenes?.byStatus?.find((s:any)=>s.status==="ready")?.count ?? 0} hint="processed" />
        <SatKpi icon={Zap} label="Cache Hit" value={`${((summary.tiles?.total ?? 0) > 0 ? ((summary.tiles?.cached ?? 0) / summary.tiles?.total) * 100 : 0).toFixed(0)}%`} hint="hit rate" />
      </div>

      {/* Scene gallery + pipeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Satellite className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Recent Satellite Scenes</CardTitle></div>
              <div className="flex items-center gap-2">
                {summary.scenes?.bySatellite?.map((s:any) => (
                  <span key={s.satellite} className="flex items-center gap-1 text-[10px]">
                    <span className="h-2 w-2 rounded-full" style={{backgroundColor: SAT_COLOR[s.satellite] ?? "#6b7280"}} />
                    <span className="text-muted-foreground">{SAT_LABEL[s.satellite] ?? s.satellite}: {s.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[450px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {summary.recent?.map((sc:any) => (
                <div key={sc.id} className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md" style={{backgroundColor: (SAT_COLOR[sc.satellite] ?? "#6b7280") + "20", color: SAT_COLOR[sc.satellite] ?? "#6b7280"}}>
                    <Satellite className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium font-mono">{sc.sceneId}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span style={{color: SAT_COLOR[sc.satellite]}} className="font-medium">{SAT_LABEL[sc.satellite] ?? sc.satellite}</span>
                      <span>·</span>
                      <span>{sc.resolutionM}m res</span>
                      <span>·</span>
                      <span className={cn("font-medium", sc.cloudCover < 10 ? "text-emerald-500" : sc.cloudCover < 20 ? "text-amber-500" : "text-orange-500")}>{sc.cloudCover.toFixed(0)}% cloud</span>
                      <span>·</span>
                      <span>{sc.tileCount} tiles</span>
                      <span>·</span>
                      <span>{sc.sizeFormatted}</span>
                      <span className="ml-auto">{timeAgo(sc.acquisitionDate)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{backgroundColor: STAGE_COLOR[sc.processingStage] ?? "#6b7280"}} />
                      <span className="text-[9px] font-medium capitalize" style={{color: STAGE_COLOR[sc.processingStage] ?? "#6b7280"}}>{sc.processingStage}</span>
                      <Badge variant="outline" className={cn("text-[8px] capitalize ml-1", sc.status === "ready" ? "text-emerald-500" : sc.status === "archived" ? "text-muted-foreground" : "text-amber-500")}>{sc.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {(!summary.recent || summary.recent.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No satellite scenes yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline + cache */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Raster Pipeline</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {["pending","downloading","rectifying","tiling","caching","ready","archived"].map((stage, i) => {
                  const count = summary.scenes?.byStage?.find((s:any)=>s.stage===stage)?.count ?? 0;
                  const isCurrent = stage === "tiling" && count > 0;
                  return (
                    <div key={stage} className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", count > 0 ? "" : "opacity-30")} style={{backgroundColor: STAGE_COLOR[stage] ?? "#6b7280"}} />
                      <span className={cn("text-[10px] font-medium capitalize flex-1", count > 0 ? "" : "text-muted-foreground/50")}>{stage}</span>
                      {isCurrent && <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-500" />}
                      <span className="text-[10px] font-bold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Tile Cache</CardTitle></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div><p className="text-lg font-bold tabular-nums">{summary.tiles?.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Total Tiles</p></div>
                <div><p className="text-lg font-bold tabular-nums text-emerald-500">{summary.tiles?.cached ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Cached</p></div>
              </div>
              <Separator className="my-2" />
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums">{summary.tiles?.totalSizeFormatted ?? "0 B"}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Cache Size</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedules + features */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Ingestion Schedules</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: "Prestea Mining Belt — Sentinel-2 Weekly", freq: "Weekly", sat: "sentinel2" },
                { name: "Atewa Forest — Landsat-8 Biweekly", freq: "Weekly", sat: "landsat8" },
                { name: "Pra River Basin — Sentinel-2 Daily", freq: "Daily", sat: "sentinel2" },
                { name: "Tarkwa Gold Belt — Sentinel-1 SAR", freq: "Weekly", sat: "sentinel1" },
              ].map((s) => (
                <div key={s.name} className="flex items-center gap-2 rounded border border-border/60 bg-card/40 p-2">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{backgroundColor: SAT_COLOR[s.sat] ?? "#6b7280"}} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{s.name}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{s.freq}</Badge>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Active" />
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.schedules?.active ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Active</p></div>
              <div><p className="text-lg font-bold tabular-nums">{summary.scenes?.archived ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Archived</p></div>
              <div><p className="text-lg font-bold tabular-nums">{(summary.scenes?.avgCloudCover ?? 0).toFixed(0)}%</p><p className="text-[9px] text-muted-foreground uppercase">Avg Cloud</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Satellite className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Pipeline Features</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { icon: Satellite, label: "Multi-Satellite", desc: "Sentinel-2 (ESA), Landsat-8 (NASA/USGS), Sentinel-1 SAR", color: "#0ea5e9" },
                { icon: Layers, label: "Raster Pipeline", desc: "Download → Rectify → Tile → Cache → Archive", color: "#22c55e" },
                { icon: Layers, label: "XYZ Tiling", desc: "Multi-resolution pyramid (z8–z14) with quadkey indexing", color: "#f59e0b" },
                { icon: Database, label: "Tile Caching", desc: "LRU eviction, access tracking, integrity checksums", color: "#14b8a6" },
                { icon: Archive, label: "Historical Archive", desc: "Long-term scene storage with metadata", color: "#8b5cf6" },
                { icon: Cloud, label: "Metadata Tracking", desc: "Cloud cover, sun angle, bands, resolution, sensor", color: "#6366f1" },
                { icon: Clock, label: "Scheduling", desc: "Daily/weekly/monthly cron schedules with cloud filters", color: "#ef4444" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-2">
                  <f.icon className="h-4 w-4 flex-shrink-0" style={{color: f.color}} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium">{f.label}</p>
                    <p className="text-[9px] text-muted-foreground">{f.desc}</p>
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

function SatKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
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
