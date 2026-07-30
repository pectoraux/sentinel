"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

export interface SubsystemHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  message?: string;
  critical: boolean;
}

export function HealthLiveView({
  initialChecks,
  initialStatus,
  initialUptime,
}: {
  initialChecks: SubsystemHealth[];
  initialStatus: string;
  initialUptime: number;
}) {
  const [checks, setChecks] = React.useState(initialChecks);
  const [status, setStatus] = React.useState(initialStatus);
  const [uptime, setUptime] = React.useState(initialUptime);
  const [loading, setLoading] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState(Date.now());

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/readiness", { cache: "no-store" });
      const data = await res.json();
      setChecks(data.checks ?? []);
      setStatus(data.status ?? "unhealthy");
      setUptime(data.uptime ?? 0);
      setLastUpdated(Date.now());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const overall = status as "healthy" | "degraded" | "unhealthy";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              overall === "healthy" && "bg-success animate-pulse",
              overall === "degraded" && "bg-warning",
              overall === "unhealthy" && "bg-destructive animate-pulse",
            )}
          />
          <div>
            <p className="text-sm font-semibold leading-none">
              {overall === "healthy"
                ? "All Systems Operational"
                : overall === "degraded"
                  ? "System Degraded"
                  : "System Unhealthy"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Uptime {formatUptime(uptime)} · last check{" "}
              {Math.round((Date.now() - lastUpdated) / 1000)}s ago
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {checks.map((check) => (
          <SubsystemCard key={check.name} check={check} />
        ))}
      </div>
    </div>
  );
}

function SubsystemCard({ check }: { check: SubsystemHealth }) {
  const color =
    check.status === "healthy"
      ? "text-success"
      : check.status === "degraded"
        ? "text-warning"
        : "text-destructive";
  const dot =
    check.status === "healthy"
      ? "bg-success"
      : check.status === "degraded"
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <div>
            <p className="text-sm font-medium leading-none capitalize">
              {check.name.replace(/-/g, " ")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              {check.critical ? "critical" : "non-critical"}
            </p>
          </div>
        </div>
        <span className={cn("text-xs font-semibold capitalize", color)}>
          {check.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {check.latencyMs}ms
        </span>
        {check.message && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
            {check.message}
          </span>
        )}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}
