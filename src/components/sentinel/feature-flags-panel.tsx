"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  strategy: string;
  config: Record<string, unknown> | null;
  segments: Array<{ name: string; rule: Record<string, unknown>; priority: number }>;
  updatedAt: string;
}

const strategyColor: Record<string, string> = {
  boolean: "bg-secondary text-secondary-foreground",
  percentage: "bg-accent text-accent-foreground",
  segment: "bg-primary/10 text-primary",
  environment: "bg-warning/15 text-warning-foreground",
};

export function FeatureFlagsPanel({ initialFlags }: { initialFlags: FeatureFlag[] }) {
  const [flags, setFlags] = React.useState(initialFlags);
  const [pending, setPending] = React.useState<Record<string, boolean>>({});

  async function toggle(key: string, enabled: boolean) {
    setPending((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch("/api/v1/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (res.status === 401 || res.status === 403) {
        toast.error("Permission denied", {
          description: "Sign in as an admin to toggle feature flags.",
        });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled } : f)),
      );
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch (e) {
      toast.error("Failed to toggle flag", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Feature Flags</h3>
          <p className="text-xs text-muted-foreground">
            Runtime rollout control · {flags.length} flags registered
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {flags.filter((f) => f.enabled).length} active
        </Badge>
      </div>

      <div className="max-h-96 overflow-y-auto -mr-2 pr-2 space-y-2">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              flag.enabled
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card/50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono font-medium truncate">
                    {flag.key}
                  </code>
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                      strategyColor[flag.strategy] ?? "bg-muted",
                    )}
                  >
                    {flag.strategy}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {flag.name}
                  {flag.description ? ` · ${flag.description}` : ""}
                </p>
                {flag.strategy === "percentage" && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${flag.rolloutPercentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {flag.rolloutPercentage}%
                    </span>
                  </div>
                )}
              </div>
              <Switch
                checked={flag.enabled}
                disabled={pending[flag.key]}
                onCheckedChange={(v) => toggle(flag.key, v)}
                aria-label={`Toggle ${flag.key}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
