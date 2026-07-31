"use client";

import * as React from "react";
import {
  Box,
  GitBranch,
  History,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Clock,
  ArrowLeftRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EntityGraph, type GraphNode, type GraphEdge } from "./entity-graph";

const TYPE_META: Record<string, { label: string; color: string }> = {
  river: { label: "River", color: "#0ea5e9" },
  road: { label: "Road", color: "#64748b" },
  mine: { label: "Mine", color: "#ef4444" },
  forest: { label: "Forest", color: "#22c55e" },
  community: { label: "Community", color: "#a78bfa" },
  inspection: { label: "Inspection", color: "#f59e0b" },
  event: { label: "Event", color: "#dc2626" },
  concession: { label: "Concession", color: "#f97316" },
  protected_area: { label: "Protected Area", color: "#8b5cf6" },
  equipment: { label: "Equipment", color: "#14b8a6" },
  historical_imagery: { label: "Imagery", color: "#6366f1" },
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-muted-foreground",
  low: "text-sky-500",
  medium: "text-amber-500",
  high: "text-orange-500",
  critical: "text-destructive",
};

const REL_COLOR: Record<string, string> = {
  affects: "text-destructive",
  threatens: "text-destructive",
  contains: "text-emerald-500",
  near: "text-muted-foreground",
  monitors: "text-teal-500",
  depends_on: "text-amber-500",
  connects_to: "text-sky-500",
  upstream: "text-sky-500",
  downstream: "text-sky-500",
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

export function TwinDashboard({
  initialSummary,
  initialGraph,
}: {
  initialSummary: any;
  initialGraph: { nodes: GraphNode[]; edges: GraphEdge[]; stats: { nodeCount: number; edgeCount: number } };
}) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [graph, setGraph] = React.useState(initialGraph);
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [entityDetail, setEntityDetail] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const [sumRes, graphRes] = await Promise.all([
        fetch("/api/v1/twin/summary", { cache: "no-store" }),
        fetch("/api/v1/twin/graph", { cache: "no-store" }),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (graphRes.ok) setGraph(await graphRes.json());
    } catch {}
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Load entity detail when a node is selected
  React.useEffect(() => {
    if (!selectedNode) {
      setEntityDetail(null);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/v1/twin/entities/${selectedNode.id}`)
      .then((r) => r.json())
      .then((data) => setEntityDetail(data))
      .catch(() => setEntityDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedNode]);

  const graphNodes = graph.nodes.map((n) => ({
    ...n,
    color: TYPE_META[n.type]?.color ?? "#6b7280",
  }));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <TwinKpi icon={Box} label="Entities" value={summary.entities.total} hint={`${summary.entities.byType.length} types`} />
        <TwinKpi icon={GitBranch} label="Versions" value={summary.versions.total} hint="snapshots" />
        <TwinKpi icon={ArrowLeftRight} label="Relationships" value={summary.relationships.total} hint={`${summary.relationships.byType.length} types`} />
        <TwinKpi icon={History} label="Events" value={summary.events.total} hint="timeline" />
        <TwinKpi icon={AlertTriangle} label="Critical Events" value={summary.events.bySeverity.find((s: any) => s.severity === "critical")?.count ?? 0} hint="severity" />
        <TwinKpi icon={Box} label="Active Entities" value={summary.entities.byStatus.find((s: any) => s.status === "active")?.count ?? 0} hint="status" />
      </div>

      {/* Graph + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Entity graph */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Entity Relationship Graph</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {graph.stats.nodeCount} nodes · {graph.stats.edgeCount} edges
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[450px] w-full">
              <EntityGraph
                nodes={graphNodes}
                edges={graph.edges}
                onNodeClick={setSelectedNode}
                selectedId={selectedNode?.id}
              />
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">Types:</span>
              {Object.entries(TYPE_META).map(([key, meta]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected entity detail */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Entity Detail</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selectedNode && entityDetail ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: TYPE_META[selectedNode.type]?.color }} />
                    <p className="text-sm font-semibold leading-tight">{selectedNode.name}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground capitalize">
                    {selectedNode.type.replace(/_/g, " ")} · v{entityDetail.currentVersion}
                  </p>
                </div>
                {entityDetail.description && (
                  <p className="text-[11px] text-muted-foreground">{entityDetail.description}</p>
                )}

                {/* Metadata */}
                {entityDetail.metadata && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Metadata</p>
                    <div className="max-h-32 space-y-1 overflow-y-auto -mr-2 pr-2">
                      {Object.entries(entityDetail.metadata).slice(0, 8).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 text-[10px]">
                          <span className="text-muted-foreground">{k.replace(/_/g, " ")}:</span>
                          <span className="font-mono text-right truncate">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Relationships */}
                {entityDetail.relationshipsFrom?.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Outgoing</p>
                    <div className="space-y-1">
                      {entityDetail.relationshipsFrom.slice(0, 5).map((r: any) => (
                        <div key={r.id} className="flex items-center gap-1.5 text-[10px]">
                          <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className={cn("font-medium", REL_COLOR[r.type] ?? "text-muted-foreground")}>{r.type}</span>
                          <span className="text-muted-foreground truncate">{r.toEntity?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {entityDetail.relationshipsTo?.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Incoming</p>
                    <div className="space-y-1">
                      {entityDetail.relationshipsTo.slice(0, 5).map((r: any) => (
                        <div key={r.id} className="flex items-center gap-1.5 text-[10px]">
                          <ChevronRight className="h-2.5 w-2.5 flex-shrink-0 rotate-180" />
                          <span className={cn("font-medium", REL_COLOR[r.type] ?? "text-muted-foreground")}>{r.type}</span>
                          <span className="text-muted-foreground truncate">{r.fromEntity?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Recent events */}
                {entityDetail.events?.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Recent Events</p>
                    <div className="space-y-1">
                      {entityDetail.events.slice(0, 4).map((ev: any) => (
                        <div key={ev.id} className="flex items-start gap-1.5 text-[10px]">
                          <Clock className="h-2.5 w-2.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <span className={cn("font-medium", SEVERITY_COLOR[ev.severity] ?? "text-muted-foreground")}>{ev.title}</span>
                            <span className="text-muted-foreground ml-1">· {timeAgo(ev.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Version history link */}
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    {entityDetail.versions?.length ?? 0} versions recorded · v1 → v{entityDetail.currentVersion}
                  </p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Click a node in the graph to see entity details.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entity distribution + event timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Entity distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Entity Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.entities.byType.map((item: any) => {
                const meta = TYPE_META[item.type] ?? { label: item.type, color: "#6b7280" };
                const pct = summary.entities.total > 0 ? (item.count / summary.entities.total) * 100 : 0;
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
                <p className="text-lg font-bold tabular-nums">{summary.versions.total}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Versions</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.relationships.total}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Relationships</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.events.total}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Event Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 space-y-2 overflow-y-auto -mr-2 pr-2">
              {summary.recent.events.map((ev: any, i: number) => (
                <div key={ev.id} className="relative flex items-start gap-2.5 rounded-md border border-border/60 bg-card/40 p-2.5">
                  <div className={cn("mt-0.5 h-2 w-2 flex-shrink-0 rounded-full",
                    ev.severity === "critical" ? "bg-destructive" :
                    ev.severity === "high" ? "bg-orange-500" :
                    ev.severity === "medium" ? "bg-amber-500" :
                    ev.severity === "low" ? "bg-sky-500" : "bg-muted-foreground"
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium">{ev.title}</p>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">{timeAgo(ev.timestamp)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {ev.entity?.name ?? "Unknown"} · {ev.type}
                    </p>
                  </div>
                </div>
              ))}
              {summary.recent.events.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">No events recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TwinKpi({
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
