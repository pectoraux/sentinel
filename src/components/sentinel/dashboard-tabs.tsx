"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: Tab[] = [
  { id: "foundation", label: "Platform Foundation", icon: ShieldCheck, description: "M1 · Architecture & subsystems" },
  { id: "identity", label: "Identity & Trust", icon: Users, description: "M2 · Organizations · Devices · Trust" },
];

export function DashboardTabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState<string>("identity");

  const childrenArray = React.Children.toArray(children);
  const foundation = childrenArray[0] ?? null;
  const identity = childrenArray[1] ?? null;

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === "foundation" ? "M1" : "M2"}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {TABS.find((t) => t.id === active)?.description}
        </p>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {active === "foundation" && foundation}
        {active === "identity" && identity}
      </div>
    </div>
  );
}
