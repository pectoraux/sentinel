"use client";

import * as React from "react";
import {
  Clock,
  History,
  GitCompare,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Calendar,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_COLOR: Record<string, string> = {
  river: "#0ea5e9", road: "#64748b", mine: "#ef4444", forest: "#22c55e",
  community: "#a78bfa", inspection: "#f59e0b", event: "#dc2626",
  concession: "#f97316", protected_area: "#8b5cf6", equipment: "#14b8a6", historical_imagery: "#6366f1",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-muted-foreground", low: "text-sky-500",
  medium: "text-amber-500", high: "text-orange-500", critical: "text-destructive",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function TemporalDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [loading, setLoading] = React.useState(false);

  // Time travel state
  const [timePreset, setTimePreset] = React.useState<"now" | "yesterday" | "last_month" | "last_year">("now");
  const [systemState, setSystemState] = React.useState<any>(null);

  // Timeline state
  const [timeline, setTimeline] = React.useState<any>(null);

  // Replay state
  const [replay, setReplay] = React.useState<any>(null);
  const [replayIdx, setReplayIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  // Version comparison state
  const [compareResult, setCompareResult] = React.useState<any>(null);

  // Load system state at time
  const loadStateAtTime = React.useCallback(async (preset: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/twin/temporal/at-time?preset=${preset}`);
      if (res.ok) {
        const data = await res.json();
        setSystemState(data);
      }
    } catch {}
    setLoading(false);
  }, []);

  // Load timeline
  const loadTimeline = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/twin/temporal/timeline?limit=100");
      if (res.ok) setTimeline(await res.json());
    } catch {}
  }, []);

  // Load replay
  const loadReplay = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/twin/temporal/replay?limit=200");
      if (res.ok) {
        const data = await res.json();
        setReplay(data);
        setReplayIdx(0);
      }
    } catch {}
  }, []);

  // Auto-load on mount
  React.useEffect(() => {
    loadStateAtTime("now");
    loadTimeline();
    loadReplay();
  }, [loadStateAtTime, loadTimeline, loadReplay]);

  // Replay player
  React.useEffect(() => {
    if (!playing || !replay) return;
    const id = setInterval(() => {
      setReplayIdx((prev) => {
        if (prev >= replay.replay.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [playing, replay]);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/twin/temporal/summary?preset=all", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const totalVersions = summary.totalVersions ?? 0;
  const totalEvents = summary.totalEvents ?? 0;
  const dayCount = summary.changesByDay?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <TempKpi icon={History} label="Total Versions" value={totalVersions} hint="snapshots" />
        <TempKpi icon={Clock} label="Total Events" value={totalEvents} hint="timeline" />
        <TempKpi icon={Calendar} label="Active Days" value={dayCount} hint="with changes" />
        <TempKpi icon={GitCompare} label="Entity Types" value={summary.entitiesByType?.length ?? 0} hint="tracked" />
        <TempKpi icon={Clock} label="Critical Events" value={summary.eventsBySeverity?.find((s: any) => s.severity === "critical")?.count ?? 0} hint="severity" />
        <TempKpi icon={History} label="Time Range" value={`${Math.round((new Date(summary.range?.latest ?? Date.now()).getTime() - new Date(summary.range?.earliest ?? Date.now()).getTime()) / (365 * 24 * 60 * 60 * 1000) * 12) / 12}y`} hint="span" />
      </div>

      {/* Time travel + system state */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Time Travel — System State</CardTitle>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {/* Time preset selector */}
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                { key: "now", label: "Now" },
                { key: "yesterday", label: "Yesterday" },
                { key: "last_month", label: "Last Month" },
                { key: "last_year", label: "Last Year" },
              ] as const).map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setTimePreset(p.key);
                    loadStateAtTime(p.key);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    timePreset === p.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>

            {/* System state at time */}
            {systemState && (
              <div>
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Querying at: <code className="font-mono">{new Date(systemState.queriedAt).toLocaleString()}</code>
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {systemState.entityCount} entities existed
                  </Badge>
                </div>
                <div className="max-h-64 space-y-1.5 overflow-y-auto -mr-2 pr-2">
                  {systemState.states?.slice(0, 20).map((s: any) => (
                    <div key={s.entityId} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[s.type] ?? "#6b7280" }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {s.type.replace(/_/g, " ")} · v{s.version}
                          {s.snapshot?.status && ` · ${s.snapshot.status}`}
                        </p>
                      </div>
                      {s.isCurrent ? (
                        <Badge variant="outline" className="text-[9px] text-emerald-500">current</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-amber-500">historical</Badge>
                      )}
                    </div>
                  ))}
                  {systemState.states?.length > 20 && (
                    <p className="py-1 text-center text-[10px] text-muted-foreground">
                      + {systemState.states.length - 20} more entities...
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version comparison */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Version Comparison</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <VersionComparison onResult={setCompareResult} />
            {compareResult && !compareResult.error && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>v{compareResult.v1.version}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>v{compareResult.v2.version}</span>
                  <span className="ml-auto">{compareResult.fieldCount} fields changed</span>
                </div>
                <Separator />
                <div className="max-h-40 space-y-1 overflow-y-auto -mr-2 pr-2">
                  {Object.entries(compareResult.diff).map(([key, val]: [string, any]) => (
                    <div key={key} className="rounded border border-border/60 bg-card/40 p-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">{key.replace(/_/g, " ")}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                        <span className="rounded bg-destructive/10 px-1 py-0.5 font-mono text-destructive line-through">
                          {val.from === null ? "null" : typeof val.from === "object" ? JSON.stringify(val.from) : String(val.from)}
                        </span>
                        <ArrowRight className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                        <span className="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-emerald-600 dark:text-emerald-400">
                          {val.to === null ? "null" : typeof val.to === "object" ? JSON.stringify(val.to) : String(val.to)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Replay player + system timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Replay player */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">History Replay</CardTitle>
              </div>
              {replay && (
                <Badge variant="outline" className="text-[10px]">
                  Day {replayIdx + 1} / {replay.dayCount}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {replay && replay.replay.length > 0 ? (
              <div>
                {/* Player controls */}
                <div className="mb-3 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setReplayIdx(Math.max(0, replayIdx - 1))}
                    className="rounded border border-border p-1.5 hover:bg-accent disabled:opacity-50"
                    disabled={replayIdx === 0}
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPlaying(!playing)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {playing ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={() => setReplayIdx(Math.min(replay.replay.length - 1, replayIdx + 1))}
                    className="rounded border border-border p-1.5 hover:bg-accent disabled:opacity-50"
                    disabled={replayIdx >= replay.replay.length - 1}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${((replayIdx + 1) / replay.replay.length) * 100}%` }}
                  />
                </div>

                {/* Current day's changes */}
                {replay.replay[replayIdx] && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold">{replay.replay[replayIdx].date}</p>
                      <span className="text-[10px] text-muted-foreground">{replay.replay[replayIdx].changeCount} changes</span>
                    </div>
                    <div className="max-h-48 space-y-1 overflow-y-auto -mr-2 pr-2">
                      {replay.replay[replayIdx].changes.map((c: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 rounded border border-border/60 bg-card/40 p-1.5">
                          <div className={cn("mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                            c.kind === "version" ? "bg-primary" :
                            c.severity === "critical" ? "bg-destructive" :
                            c.severity === "high" ? "bg-orange-500" :
                            c.severity === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                          )} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">
                              {c.kind === "version" ? `v${c.version}: ${c.changeReason}` : c.title}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {c.entity?.name ?? "Unknown"}
                              {c.kind === "event" && ` · ${c.eventType}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Loading replay...</p>
            )}
          </CardContent>
        </Card>

        {/* System timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">System Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {timeline && timeline.timeline ? (
              <div className="max-h-72 space-y-1.5 overflow-y-auto -mr-2 pr-2">
                {timeline.timeline.slice(0, 50).map((entry: any, i: number) => (
                  <div key={i} className="relative flex items-start gap-2.5 rounded-md border border-border/60 bg-card/40 p-2">
                    <div className={cn("mt-0.5 h-2 w-2 flex-shrink-0 rounded-full",
                      entry.kind === "version" ? "bg-primary" :
                      entry.severity === "critical" ? "bg-destructive" :
                      entry.severity === "high" ? "bg-orange-500" :
                      entry.severity === "medium" ? "bg-amber-500" :
                      entry.severity === "low" ? "bg-sky-500" : "bg-muted-foreground"
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-medium">
                          {entry.kind === "version" ? `v${entry.version}: ${entry.changeReason}` : entry.title}
                        </p>
                        <span className="flex-shrink-0 text-[9px] text-muted-foreground tabular-nums">
                          {timeAgo(entry.timestamp)}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {entry.entity?.name ?? "Unknown"}
                        {entry.kind === "version" ? ` · ${entry.entity?.type ?? ""}` : ` · ${entry.eventType}`}
                        {entry.severity && entry.severity !== "info" && (
                          <span className={cn("ml-1 font-medium", SEVERITY_COLOR[entry.severity])}>· {entry.severity}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                {timeline.timeline.length > 50 && (
                  <p className="py-1 text-center text-[10px] text-muted-foreground">
                    + {timeline.timeline.length - 50} more changes...
                  </p>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Loading timeline...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Changes per day chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Changes Over Time</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {summary.changesByDay && summary.changesByDay.length > 0 ? (
            <div className="flex h-32 items-end gap-px">
              {summary.changesByDay.map((day: any) => {
                const maxCount = Math.max(...summary.changesByDay.map((d: any) => d.count));
                const heightPct = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="group relative flex-1 min-w-[2px] flex flex-col justify-end"
                    title={`${day.date}: ${day.count} changes`}
                  >
                    <div
                      className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors"
                      style={{ height: `${heightPct}%`, minHeight: "2px" }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No changes recorded.</p>
          )}
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{summary.range?.earliest ? new Date(summary.range.earliest).toLocaleDateString() : ""}</span>
            <span>{summary.changesByDay?.length ?? 0} active days</span>
            <span>{summary.range?.latest ? new Date(summary.range.latest).toLocaleDateString() : ""}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version comparison sub-component
// ---------------------------------------------------------------------------

function VersionComparison({ onResult }: { onResult: (r: any) => void }) {
  const [entityId, setEntityId] = React.useState("");
  const [v1, setV1] = React.useState("1");
  const [v2, setV2] = React.useState("2");
  const [loading, setLoading] = React.useState(false);
  const [entities, setEntities] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch("/api/v1/twin/entities?limit=100")
      .then((r) => r.json())
      .then((data) => setEntities(data.entities ?? []))
      .catch(() => {});
  }, []);

  const compare = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/twin/entities/${entityId}/compare?v1=${v1}&v2=${v2}`);
      if (res.ok) onResult(await res.json());
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <select
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
        className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
      >
        <option value="">Select entity...</option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} (v{e.currentVersion})
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={v1}
          onChange={(e) => setV1(e.target.value)}
          min="1"
          className="w-16 rounded border border-border bg-card px-2 py-1.5 text-xs"
          placeholder="v1"
        />
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <input
          type="number"
          value={v2}
          onChange={(e) => setV2(e.target.value)}
          min="1"
          className="w-16 rounded border border-border bg-card px-2 py-1.5 text-xs"
          placeholder="v2"
        />
        <button
          onClick={compare}
          disabled={!entityId || loading}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Compare"}
        </button>
      </div>
    </div>
  );
}

function TempKpi({
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
