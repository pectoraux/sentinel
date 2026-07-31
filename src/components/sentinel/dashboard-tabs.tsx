"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users, Map, Box, Clock, Network, FileText, Radio, Scale, Shield, Bell, Satellite, Eye, Brain, Layers, TrendingUp, Crosshair, MessageSquare, Target, Award, AlertTriangle, Landmark, FlaskConical, BarChart3, Code2, ShieldAlert, Gauge, ClipboardCheck } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  short: string;
}

const TABS: Tab[] = [
  { id: "production", label: "Production", icon: ClipboardCheck, description: "M28 · Accessibility · Internationalization · Offline-first · Mobile optimization · Monitoring · Incident response · Operational runbooks · Final production audit · Deployment automation", short: "M28" },
  { id: "performance", label: "Performance", icon: Gauge, description: "M27 · Millions of users · Millions of events · Petabyte imagery · Stress testing · Caching · Horizontal scaling · Load testing · Optimization", short: "M27" },
  { id: "security", label: "Security", icon: ShieldAlert, description: "M26 · Zero Trust · Encryption · Rate limiting · WAF · Secret rotation · Pen testing · Threat detection · Backups · Disaster recovery", short: "M26" },
  { id: "developer", label: "Developer", icon: Code2, description: "M25 · REST API · GraphQL · Webhooks · SDK · Documentation · Third-party integrations", short: "M25" },
  { id: "analytics", label: "Analytics", icon: BarChart3, description: "M24 · Hotspots · Environmental KPIs · Response times · Community engagement · Trust metrics · Reward metrics", short: "M24" },
  { id: "simulation", label: "Simulation", icon: FlaskConical, description: "M23 · What if? · Increase inspections · Protect watershed · Close roads · Deploy drones · Predict outcomes", short: "M23" },
  { id: "government", label: "Gov Operations", icon: Landmark, description: "M22 · National dashboard · Regional dashboard · District dashboard · Investigation workflow · Inspection workflow · Case management", short: "M22" },
  { id: "fraud", label: "Fraud Detection", icon: AlertTriangle, description: "M21 · Fake evidence · Collusion · Sockpuppets · Location spoofing · Deepfakes · Vote rings · Reward farming", short: "M21" },
  { id: "rewards", label: "Reward Engine", icon: Award, description: "M20 · Donation pools · NGO funding · Government grants · Transparent distribution · Contribution scoring · Hash-chained ledger", short: "M20" },
  { id: "missions", label: "Mission System", icon: Target, description: "M19 · AI creates missions when confidence is low · Nearby trusted users gather evidence · Rewards based on verification quality", short: "M19" },
  { id: "copilot", label: "AI Copilot", icon: MessageSquare, description: "M18 · Natural language interface to the Digital Twin · Real LLM · Ask questions about mines, rivers, forests, predictions, confidence", short: "M18" },
  { id: "hotspots", label: "Prediction Engine", icon: Crosshair, description: "M17 · Predict illegal mining hotspots · Future expansion · Confidence · Probability · Explainability", short: "M17" },
  { id: "predictions", label: "Environmental Intelligence", icon: TrendingUp, description: "M16 · Predict sediment · River impact · Forest loss · Downstream effects · Protected area risk", short: "M16" },
  { id: "fusion", label: "Evidence Fusion", icon: Layers, description: "M15 · Merge AI + Citizens + Satellite + Drone + Sensors + Government into one confidence score", short: "M15" },
  { id: "observations", label: "AI Observations", icon: Brain, description: "M14 · AI creates Intelligence Events · Evidence · Confidence · Reasoning · Affected entities · Historical comparison", short: "M14" },
  { id: "cv", label: "Computer Vision", icon: Eye, description: "M13 · Real AI · VLM detection · Excavation · Roads · Tailings · Forest loss · Water · Buildings · Equipment", short: "M13" },
  { id: "satellite", label: "Satellite Ingestion", icon: Satellite, description: "M12 · Sentinel · Landsat · Raster pipeline · Tiling · Caching · Archive · Scheduling", short: "M12" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "M11 · Push · Email · SMS · In-app · Geofenced · Interest · Digest · Priority", short: "M11" },
  { id: "trust", label: "Civil Trust Engine", icon: Shield, description: "M10 · Accuracy · Reliability · Decay · Fraud resistance · 8-factor trust", short: "M10" },
  { id: "corroboration", label: "Corroboration Engine", icon: Scale, description: "M9 · Support · Dispute · Independent corroboration · Duplicate detection · Witness confidence · Evidence weighting", short: "M9" },
  { id: "intel", label: "Community Intelligence", icon: Radio, description: "M8 · Event-sourced · Subscribe · Comment · Share · Follow", short: "M8" },
  { id: "evidence", label: "Evidence Platform", icon: FileText, description: "M7 · Hashing · Tamper detection · Encryption · Versioning", short: "M7" },
  { id: "kg", label: "Knowledge Graph", icon: Network, description: "M6 · Graph traversal · Path finding · Centrality", short: "M6" },
  { id: "temporal", label: "Temporal Engine", icon: Clock, description: "M5 · Time travel · Version comparison · History replay", short: "M5" },
  { id: "twin", label: "Digital Twin", icon: Box, description: "M4 · Versioned entities · Relationships · History", short: "M4" },
  { id: "geo", label: "Geospatial", icon: Map, description: "M3 · GIS engine · Maps · Layers · Spatial queries", short: "M3" },
  { id: "identity", label: "Identity & Trust", icon: Users, description: "M2 · Organizations · Devices · Trust", short: "M2" },
  { id: "foundation", label: "Platform Foundation", icon: ShieldCheck, description: "M1 · Architecture & subsystems", short: "M1" },
];

export function DashboardTabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState<string>("production");

  const childrenArray = React.Children.toArray(children);
  const production = childrenArray[0] ?? null;
  const performance = childrenArray[1] ?? null;
  const security = childrenArray[2] ?? null;
  const developer = childrenArray[3] ?? null;
  const analytics = childrenArray[4] ?? null;
  const simulation = childrenArray[5] ?? null;
  const government = childrenArray[6] ?? null;
  const fraud = childrenArray[7] ?? null;
  const rewards = childrenArray[8] ?? null;
  const missions = childrenArray[9] ?? null;
  const copilot = childrenArray[10] ?? null;
  const hotspots = childrenArray[11] ?? null;
  const predictions = childrenArray[12] ?? null;
  const fusion = childrenArray[13] ?? null;
  const observations = childrenArray[14] ?? null;
  const cv = childrenArray[15] ?? null;
  const satellite = childrenArray[16] ?? null;
  const notifications = childrenArray[17] ?? null;
  const trust = childrenArray[18] ?? null;
  const corroboration = childrenArray[19] ?? null;
  const intel = childrenArray[20] ?? null;
  const evidence = childrenArray[21] ?? null;
  const kg = childrenArray[22] ?? null;
  const temporal = childrenArray[23] ?? null;
  const twin = childrenArray[24] ?? null;
  const geo = childrenArray[25] ?? null;
  const identity = childrenArray[26] ?? null;
  const foundation = childrenArray[27] ?? null;

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
        {active === "production" && production}
        {active === "performance" && performance}
        {active === "security" && security}
        {active === "developer" && developer}
        {active === "analytics" && analytics}
        {active === "simulation" && simulation}
        {active === "government" && government}
        {active === "fraud" && fraud}
        {active === "rewards" && rewards}
        {active === "missions" && missions}
        {active === "copilot" && copilot}
        {active === "hotspots" && hotspots}
        {active === "predictions" && predictions}
        {active === "fusion" && fusion}
        {active === "observations" && observations}
        {active === "cv" && cv}
        {active === "satellite" && satellite}
        {active === "notifications" && notifications}
        {active === "trust" && trust}
        {active === "corroboration" && corroboration}
        {active === "intel" && intel}
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
