"use client";

import * as React from "react";
import {
  Map as MapIcon,
  Layers as LayersIcon,
  Crosshair,
  Radio,
  MapPin,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  Grid2x2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CanvasMap, type MapPOI, type MapRegion, type MapLayer } from "./canvas-map";

interface GeoSummary {
  pointsOfInterest: {
    total: number;
    byType: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  regions: {
    total: number;
    byType: { type: string; count: number }[];
    totalAreaKm2: number;
  };
  layers: { total: number; active: number };
  database: { provider: string; spatialEngine: string };
}

const POI_TYPE_META: Record<string, { label: string; color: string }> = {
  mining_site: { label: "Mining Sites", color: "#ef4444" },
  incident: { label: "Incidents", color: "#dc2626" },
  water_body: { label: "Water Bodies", color: "#0ea5e9" },
  settlement: { label: "Settlements", color: "#a78bfa" },
  sensor_station: { label: "Sensors", color: "#10b981" },
  checkpoint: { label: "Checkpoints", color: "#f59e0b" },
};

export function GeospatialDashboard({
  initialSummary,
  initialPois,
  initialRegions,
  initialLayers,
}: {
  initialSummary: GeoSummary;
  initialPois: MapPOI[];
  initialRegions: MapRegion[];
  initialLayers: MapLayer[];
}) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [pois] = React.useState(initialPois);
  const [regions] = React.useState(initialRegions);
  const [layers, setLayers] = React.useState(initialLayers);
  const [center, setCenter] = React.useState({ lng: -1.8, lat: 6.0 }); // Ghana center
  const [zoom, setZoom] = React.useState(8);
  const [selectedPOI, setSelectedPOI] = React.useState<MapPOI | null>(null);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showTiles, setShowTiles] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [queryResult, setQueryResult] = React.useState<{ pois: Array<MapPOI & { distance?: number }>; type: string } | null>(null);

  // Layer toggle
  const toggleLayer = React.useCallback(async (key: string, visible: boolean) => {
    setLayers((prev) => prev.map((l) => (l.key === key ? { ...l, visible } : l)));
    // Persist to backend (fire-and-forget)
    fetch(`/api/v1/geo/layers/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible }),
    }).catch(() => {});
  }, []);

  // Spatial query: nearest POIs to map center
  const runNearestQuery = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/geo/nearest?lng=${center.lng}&lat=${center.lat}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setQueryResult({ pois: data.pois, type: "nearest" });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [center]);

  // Spatial query: within radius of map center
  const runRadiusQuery = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/geo/within-radius?lng=${center.lng}&lat=${center.lat}&radius=20000`);
      if (res.ok) {
        const data = await res.json();
        setQueryResult({ pois: data.pois, type: "radius" });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [center]);

  // Refresh summary
  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/geo/summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const visiblePOICount = pois.filter((p) => {
    const layerKey = p.type === "water_body" ? "water-bodies"
      : p.type === "settlement" ? "settlements"
      : "mining-sites";
    return layers.find((l) => l.key === layerKey)?.visible;
  }).length;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <GeoKpi icon={MapPin} label="Points of Interest" value={summary.pointsOfInterest.total} hint={`${summary.pointsOfInterest.byType.length} types`} />
        <GeoKpi icon={Radio} label="Spatial Regions" value={summary.regions.total} hint={`${summary.regions.totalAreaKm2.toFixed(0)} km²`} />
        <GeoKpi icon={LayersIcon} label="Map Layers" value={summary.layers.total} hint={`${summary.layers.active} active`} />
        <GeoKpi icon={Crosshair} label="Visible POIs" value={visiblePOICount} hint="on map" />
        <GeoKpi icon={Search} label="Query Results" value={queryResult?.pois.length ?? 0} hint={queryResult?.type ?? "none"} />
        <GeoKpi
          icon={Grid3x3}
          label="Spatial Engine"
          value={summary.database.provider === "postgresql" ? "PG" : "TS"}
          hint={summary.database.provider === "postgresql" ? "PostGIS" : "Haversine"}
        />
      </div>

      {/* Map + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Map */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Geospatial Map — Ghana Mining Belt</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={cn("inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors", showGrid ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                >
                  <Grid2x2 className="h-3 w-3" /> Grid
                </button>
                <button
                  onClick={() => setShowTiles(!showTiles)}
                  className={cn("inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors", showTiles ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                >
                  <Grid3x3 className="h-3 w-3" /> Tiles
                </button>
                <Separator orientation="vertical" className="h-5" />
                <button onClick={() => setZoom(Math.min(18, zoom + 1))} className="rounded border border-border p-1 hover:bg-accent">
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setZoom(Math.max(1, zoom - 1))} className="rounded border border-border p-1 hover:bg-accent">
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setCenter({ lng: -1.8, lat: 6.0 }); setZoom(8); }} className="rounded border border-border p-1 hover:bg-accent">
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[450px] w-full">
              <CanvasMap
                pois={pois}
                regions={regions}
                layers={layers}
                center={center}
                zoom={zoom}
                onCenterChange={setCenter}
                onZoomChange={setZoom}
                onPOIClick={setSelectedPOI}
                showGrid={showGrid}
                showTiles={showTiles}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="font-medium">Legend:</span>
              {Object.entries(POI_TYPE_META).map(([key, meta]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: layers + queries */}
        <div className="space-y-4">
          {/* Layer control */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <LayersIcon className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Layers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 space-y-2 overflow-y-auto -mr-2 pr-2">
                {layers.map((layer) => (
                  <div key={layer.key} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card/40 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{layer.name}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{layer.type} · {layer.source}</p>
                    </div>
                    <Switch
                      checked={layer.visible}
                      onCheckedChange={(v) => toggleLayer(layer.key, v)}
                      aria-label={`Toggle ${layer.name}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Spatial queries */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Spatial Queries</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Center: {center.lat.toFixed(3)}°, {center.lng.toFixed(3)}° · zoom {zoom}
              </p>
              <div className="space-y-2">
                <button
                  onClick={runNearestQuery}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Search className="h-3 w-3" />
                  Nearest 5 POIs
                </button>
                <button
                  onClick={runRadiusQuery}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Radio className="h-3 w-3" />
                  Within 20km Radius
                </button>
              </div>
              {queryResult && (
                <div className="mt-3 space-y-1">
                  <Separator className="mb-2" />
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {queryResult.type === "nearest" ? "Nearest POIs" : `Within 20km (${queryResult.pois.length})`}
                  </p>
                  <div className="max-h-40 space-y-1 overflow-y-auto -mr-2 pr-2">
                    {queryResult.pois.map((poi, i) => (
                      <button
                        key={poi.id}
                        onClick={() => {
                          setCenter({ lng: poi.lng, lat: poi.lat });
                          setZoom(Math.max(zoom, 12));
                          setSelectedPOI(poi);
                        }}
                        className="flex w-full items-center gap-2 rounded border border-border/40 bg-card/30 p-1.5 text-left hover:bg-accent/50 transition-colors"
                      >
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium">{poi.name}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {poi.type.replace(/_/g, " ")}
                            {poi.distance ? ` · ${(poi.distance / 1000).toFixed(1)}km` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected POI detail + POI distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Selected Point</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selectedPOI ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: POI_TYPE_META[selectedPOI.type]?.color ?? "#6b7280" }} />
                  <p className="text-sm font-semibold">{selectedPOI.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Type</p>
                    <p className="font-medium">{selectedPOI.type.replace(/_/g, " ")}</p>
                  </div>
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                    <p className="font-medium capitalize">{selectedPOI.status}</p>
                  </div>
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Latitude</p>
                    <p className="font-mono font-medium">{selectedPOI.lat.toFixed(6)}°</p>
                  </div>
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Longitude</p>
                    <p className="font-mono font-medium">{selectedPOI.lng.toFixed(6)}°</p>
                  </div>
                  {selectedPOI.severity && (
                    <div className="col-span-2 rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Severity</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-1 text-[10px] capitalize",
                          selectedPOI.severity === "critical" && "border-destructive/50 text-destructive",
                          selectedPOI.severity === "high" && "border-orange-500/50 text-orange-600 dark:text-orange-400",
                          selectedPOI.severity === "medium" && "border-amber-500/50 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {selectedPOI.severity}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Click a POI on the map to see details.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">POI Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.pointsOfInterest.byType.map((item) => {
                const meta = POI_TYPE_META[item.type] ?? { label: item.type, color: "#6b7280" };
                const pct = summary.pointsOfInterest.total > 0 ? (item.count / summary.pointsOfInterest.total) * 100 : 0;
                return (
                  <div key={item.type} className="flex items-center gap-2">
                    <span className="w-24 text-[10px] font-medium">{meta.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{item.count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.regions.total}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Regions</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.regions.totalAreaKm2.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground uppercase">km² Area</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.layers.active}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Active Layers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GeoKpi({
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
