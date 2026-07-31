"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users, Map, Box, Clock, Network, FileText } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  short: string;
}

const TABS: Tab[] = [
  { id: "evidence", label: "Evidence Platform", icon: FileText, description: "M7 · Hashing · Tamper detection · Encryption · Versioning", short: "M7" },
  { id: "kg", label: "Knowledge Graph", icon: Network, description: "M6 · Graph traversal · Path finding · Centrality", short: "M6" },
  { id: "temporal", label: "Temporal Engine", icon: Clock, description: "M5 · Time travel · Version comparison · History replay", short: "M5" },
  { id: "twin", label: "Digital Twin", icon: Box, description: "M4 · Versioned entities · Relationships · History", short: "M4" },
  { id: "geo", label: "Geospatial", icon: Map, description: "M3 · GIS engine · Maps · Layers · Spatial queries", short: "M3" },
  { id: "identity", label: "Identity & Trust", icon: Users, description: "M2 · Organizations · Devices · Trust", short: "M2" },
  { id: "foundation", label: "Platform Foundation", icon: ShieldCheck, description: "M1 · Architecture & subsystems", short: "M1" },
];

export function DashboardTabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState<string>("evidence");

  const childrenArray = React.Children.toArray(children);
  const evidence = childrenArray[0] ?? null;
  const kg = childrenArray[1] ?? null;
  const temporal = childrenArray[2] ?? null;
  const twin = childrenArray[3] ?? null;
  const geo = childrenArray[4] ?? null;
  const identity = childrenArray[5] ?? null;
  const foundation = childrenArray[6] ?? null;

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
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
                <span className="sm:hidden">{tab.short}</span>
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
        {active === "evidence" && evidence}
        {active === "kg" && kg}
        {active === "temporal" && temporal}
        {active === "twin" && twin}
        {active === "geo" && geo}
        {active === "identity" && identity}
        {active === "foundation" && foundation}
      </div>
    </div>
  );
}
