"use client";

import * as React from "react";
import {
  Network,
  GitBranch,
  Search,
  Route,
  Layers3,
  Loader2,
  ChevronRight,
  ArrowRight,
  CircleDot,
  Unlink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EntityGraph, type GraphNode, type GraphEdge } from "./entity-graph";

const TYPE_COLOR: Record<string, string> = {
  river: "#0ea5e9", road: "#64748b", mine: "#ef4444", forest: "#22c55e",
  community: "#a78bfa", inspection: "#f59e0b", event: "#dc2626",
  concession: "#f97316", protected_area: "#8b5cf6", equipment: "#14b8a6", historical_imagery: "#6366f1",
};

const EDGE_COLOR: Record<string, string> = {
  affects: "#ef4444", threatens: "#dc2626", contains: "#22c55e", within: "#22c55e",
  near: "#64748b", connects_to: "#0ea5e9", monitors: "#14b8a6", supplies: "#0ea5e9",
  upstream: "#0ea5e9", downstream: "#0ea5e9", depends_on: "#f59e0b", borders: "#8b5cf6",
};

export function KnowledgeGraphDashboard({
  initialAnalytics,
  initialGraph,
}: {
  initialAnalytics: any;
  initialGraph: { nodes: GraphNode[]; edges: GraphEdge[]; stats: any };
}) {
  const [analytics, setAnalytics] = React.useState(initialAnalytics);
  const [graph, setGraph] = React.useState(initialGraph);
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [neighbors, setNeighbors] = React.useState<any>(null);
  const [loadingNeighbors, setLoadingNeighbors] = React.useState(false);

  // Path finder state
  const [pathFrom, setPathFrom] = React.useState("");
  const [pathTo, setPathTo] = React.useState("");
  const [pathResult, setPathResult] = React.useState<any>(null);
  const [loadingPath, setLoadingPath] = React.useState(false);

  const graphNodes = graph.nodes.map((n) => ({
    ...n,
    color: TYPE_COLOR[n.type] ?? "#6b7280",
  }));

  // Load neighbors when a node is selected
  React.useEffect(() => {
    if (!selectedNode) {
      setNeighbors(null);
      return;
    }
    setLoadingNeighbors(true);
    fetch(`/api/v1/twin/kg/neighbors?entityId=${selectedNode.id}&depth=2`)
      .then((r) => r.json())
      .then((data) => setNeighbors(data))
      .catch(() => setNeighbors(null))
      .finally(() => setLoadingNeighbors(false));
  }, [selectedNode]);

  const findPath = async () => {
    if (!pathFrom || !pathTo) return;
    setLoadingPath(true);
    try {
      const res = await fetch(`/api/v1/twin/kg/path?from=${pathFrom}&to=${pathTo}&maxDepth=5`);
      if (res.ok) setPathResult(await res.json());
    } catch {}
    setLoadingPath(false);
  };

  const refresh = React.useCallback(async () => {
    try {
      const [aRes, gRes] = await Promise.all([
        fetch("/api/v1/twin/kg/analytics", { cache: "no-store" }),
        fetch("/api/v1/twin/kg/graph", { cache: "no-store" }),
      ]);
      if (aRes.ok) setAnalytics(await aRes.json());
      if (gRes.ok) setGraph(await gRes.json());
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
        <KgKpi icon={Network} label="Nodes" value={analytics.graph?.stats?.nodeCount ?? 0} hint="entities" />
        <KgKpi icon={GitBranch} label="Edges" value={analytics.graph?.stats?.edgeCount ?? 0} hint="relationships" />
        <KgKpi icon={Layers3} label="Components" value={analytics.componentCount ?? 0} hint="connected" />
        <KgKpi icon={Network} label="Largest" value={analytics.largestComponentSize ?? 0} hint="component size" />
        <KgKpi icon={CircleDot} label="Density" value={`${((analytics.graph?.stats?.density ?? 0) * 100).toFixed(1)}%`} hint="graph" />
        <KgKpi icon={Unlink} label="Isolated" value={analytics.isolatedNodes?.length ?? 0} hint="no edges" />
      </div>

      {/* Graph + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Interactive graph */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Knowledge Graph</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {graph.stats?.nodeCount ?? 0} nodes · {graph.stats?.edgeCount ?? 0} edges
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
              {Object.entries(TYPE_COLOR).map(([key, color]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {key.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Neighbors explorer */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Neighbors</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selectedNode && neighbors ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: TYPE_COLOR[selectedNode.type] ?? "#6b7280" }} />
                  <p className="text-sm font-semibold leading-tight">{selectedNode.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {selectedNode.type.replace(/_/g, " ")} · {neighbors.neighbors?.length ?? 0} neighbors (2 hops)
                </p>
                <Separator />
                <div className="max-h-64 space-y-1 overflow-y-auto -mr-2 pr-2">
                  {neighbors.neighbors?.map((n: any) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNode(n)}
                      className="flex w-full items-center gap-1.5 rounded border border-border/40 bg-card/30 p-1.5 text-left hover:bg-accent/50 transition-colors"
                    >
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[n.type] ?? "#6b7280" }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium">{n.name}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {n.edgeType} · hop {n.depth} · s={n.strength?.toFixed(2)}
                        </p>
                      </div>
                    </button>
                  ))}
                  {neighbors.neighbors?.length === 0 && (
                    <p className="py-4 text-center text-[10px] text-muted-foreground">No neighbors found.</p>
                  )}
                </div>
              </div>
            ) : loadingNeighbors ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Click a node to explore its neighborhood.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Path finder + centrality */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        {/* Path finder */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Path Finder</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={pathFrom}
                  onChange={(e) => setPathFrom(e.target.value)}
                  className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <option value="">From...</option>
                  {graph.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <select
                  value={pathTo}
                  onChange={(e) => setPathTo(e.target.value)}
                  className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <option value="">To...</option>
                  {graph.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
                <button
                  onClick={findPath}
                  disabled={!pathFrom || !pathTo || loadingPath}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {loadingPath ? <Loader2 className="h-3 w-3 animate-spin" /> : "Find"}
                </button>
              </div>

              {pathResult && (
                <div className="mt-3 space-y-2">
                  {pathResult.shortest?.found ? (
                    <>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {pathResult.shortest.hops} hops
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {pathResult.pathCount} total paths found
                        </span>
                      </div>
                      <div className="space-y-1">
                        {pathResult.shortest.path.map((node: any, i: number) => (
                          <div key={node.id} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 flex-1 rounded border border-border/60 bg-card/40 p-1.5">
                              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[node.type] ?? "#6b7280" }} />
                              <span className="truncate text-[11px] font-medium">{node.name}</span>
                              <span className="ml-auto text-[9px] text-muted-foreground capitalize">{node.type.replace(/_/g, " ")}</span>
                            </div>
                            {i < pathResult.shortest.path.length - 1 && (
                              <div className="flex flex-col items-center px-1">
                                <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground" />
                                {node.edgeType && (
                                  <span className="text-[8px] text-muted-foreground" style={{ color: EDGE_COLOR[node.edgeType] }}>
                                    {node.edgeType}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">No path found between these entities.</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Centrality rankings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Centrality Rankings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-1.5 overflow-y-auto -mr-2 pr-2">
              {analytics.topNodes?.map((item: any, i: number) => (
                <div key={item.node.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[item.node.type] ?? "#6b7280" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.node.name}</p>
                    <p className="text-[9px] text-muted-foreground capitalize">{item.node.type.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-600 dark:text-emerald-400" title="out-degree">→{item.outDegree}</span>
                    <span className="text-sky-500" title="in-degree">←{item.inDegree}</span>
                    <span className="font-bold tabular-nums">{item.totalDegree}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relationship matrix + templates */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        {/* Relationship matrix */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Relationship Matrix</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-[10px] text-muted-foreground">
              How entity types connect: rows = source, columns = target, cells = edge count
            </p>
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-[10px] min-w-[400px]">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-muted-foreground">From \ To</th>
                    {Object.keys(analytics.relationshipMatrix ?? {}).map((fromType) => (
                      <th key={fromType} className="p-1 text-center" style={{ color: TYPE_COLOR[fromType] ?? "#6b7280" }}>
                        {fromType.slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analytics.relationshipMatrix ?? {}).map(([fromType, targets]) => (
                    <tr key={fromType}>
                      <td className="p-1 font-medium" style={{ color: TYPE_COLOR[fromType] ?? "#6b7280" }}>
                        {fromType.slice(0, 6)}
                      </td>
                      {Object.keys(analytics.relationshipMatrix ?? {}).map((toType) => {
                        const count = (targets as Record<string, number>)[toType] ?? 0;
                        return (
                          <td key={toType} className="p-1 text-center">
                            {count > 0 ? (
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                                style={{
                                  backgroundColor: count > 2 ? "#ef444433" : count > 1 ? "#f59e0b33" : "#64748b22",
                                  color: count > 2 ? "#ef4444" : count > 1 ? "#f59e0b" : "#64748b",
                                }}
                              >
                                {count}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Relationship templates */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Relationship Templates</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-1.5 overflow-y-auto -mr-2 pr-2">
              {[
                { from: "river", to: "community", type: "supplies", label: "River → Community (supplies)", color: "#0ea5e9" },
                { from: "mine", to: "river", type: "affects", label: "Mine → River (affects)", color: "#ef4444" },
                { from: "mine", to: "forest", type: "threatens", label: "Mine → Forest (threatens)", color: "#dc2626" },
                { from: "forest", to: "protected_area", type: "within", label: "Forest → Protected Area (within)", color: "#22c55e" },
                { from: "inspection", to: "mine", type: "monitors", label: "Inspection → Mine (monitors)", color: "#f59e0b" },
                { from: "historical_imagery", to: "event", type: "monitors", label: "Satellite Image → Event (detects)", color: "#6366f1" },
                { from: "concession", to: "mine", type: "contains", label: "Concession → Mine (contains)", color: "#f97316" },
                { from: "equipment", to: "river", type: "monitors", label: "Equipment → River (monitors)", color: "#14b8a6" },
                { from: "road", to: "community", type: "connects_to", label: "Road → Community (connects)", color: "#64748b" },
                { from: "community", to: "river", type: "depends_on", label: "Community → River (depends)", color: "#a78bfa" },
              ].map((t) => {
                const count = analytics.relationshipMatrix?.[t.from]?.[t.to] ?? 0;
                return (
                  <div key={t.label} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{t.label}</p>
                    </div>
                    <Badge variant={count > 0 ? "default" : "secondary"} className="text-[9px]">
                      {count} link{count !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KgKpi({
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
