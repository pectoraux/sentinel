import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Activity,
  Boxes,
  KeyRound,
  Flag,
  ScrollText,
  GitBranch,
  Radar,
  Database,
  HardDrive,
  Radio,
  Cpu,
  LineChart,
  Layers,
  ArrowRight,
  Lock,
  Server,
  GitPullRequestArrow,
  CheckCircle2,
  Building2,
  Users,
  Smartphone,
} from "lucide-react";

import { config, safeConfigSnapshot } from "@/config";
import { getHealthService } from "@/infrastructure/health";
import { getFeatureFlagService } from "@/modules/feature-flags";
import { getAuditService } from "@/modules/audit";
import { getIamService } from "@/modules/iam/application/services/iam.service";
import { metrics, getTelemetryState } from "@/infrastructure/observability";
import { db } from "@/lib/db";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FeatureFlagsPanel } from "@/components/sentinel/feature-flags-panel";
import { HealthLiveView } from "@/components/sentinel/health-live-view";
import { DashboardTabs } from "@/components/sentinel/dashboard-tabs";
import { IdentityDashboard } from "@/components/sentinel/identity-dashboard";
import { GeospatialDashboard } from "@/components/sentinel/geo/geospatial-dashboard";
import { TwinDashboard } from "@/components/sentinel/twin/twin-dashboard";
import { TemporalDashboard } from "@/components/sentinel/twin/temporal-dashboard";
import { KnowledgeGraphDashboard } from "@/components/sentinel/twin/knowledge-graph-dashboard";
import { EvidenceDashboard } from "@/components/sentinel/evidence/evidence-dashboard";
import { IntelligenceDashboard } from "@/components/sentinel/intelligence/intelligence-dashboard";
import { CorroborationDashboard } from "@/components/sentinel/corroboration/corroboration-dashboard";
import { TrustDashboard } from "@/components/sentinel/trust/trust-dashboard";
import { NotificationDashboard } from "@/components/sentinel/notifications/notification-dashboard";
import { SatelliteDashboard } from "@/components/sentinel/satellite/satellite-dashboard";
import { CVDashboard } from "@/components/sentinel/cv/cv-dashboard";
import { ObservationDashboard } from "@/components/sentinel/ai-observations/observation-dashboard";
import { FusionDashboard } from "@/components/sentinel/fusion/fusion-dashboard";
import { PredictionDashboard } from "@/components/sentinel/predictions/prediction-dashboard";
import { HotspotDashboard } from "@/components/sentinel/hotspots/hotspot-dashboard";
import { CopilotDashboard } from "@/components/sentinel/copilot/copilot-dashboard";
import { MissionDashboard } from "@/components/sentinel/missions/mission-dashboard";
import { RewardDashboard } from "@/components/sentinel/rewards/reward-dashboard";
import { FraudDashboard } from "@/components/sentinel/fraud/fraud-dashboard";
import { GovernmentDashboard } from "@/components/sentinel/government/government-dashboard";
import { SimulationDashboard } from "@/components/sentinel/simulation/simulation-dashboard";
import { getPOIService, getRegionService, getLayerService, getSpatialQueryService } from "@/modules/geo";
import { getTwinSummaryService, getTwinEntityService, ENTITY_TYPE_CATALOGUE, getTemporalService, getKnowledgeGraphService } from "@/modules/twin";
import { getEvidenceService, getCorroborationService } from "@/modules/evidence";
import { getCivilTrustService } from "@/modules/trust";
import { getIntelligenceService } from "@/modules/intelligence";
import { getNotificationService } from "@/modules/notifications";
import { getSatelliteIngestionService } from "@/modules/satellite";
import { getCVService } from "@/modules/cv";
import { getObservationService } from "@/modules/ai-observations";
import { getFusionService } from "@/modules/fusion";
import { getPredictionService } from "@/modules/predictions";
import { getHotspotService } from "@/modules/hotspots";
import { getCopilotService } from "@/modules/copilot";
import { getMissionService } from "@/modules/missions";
import { getRewardService } from "@/modules/rewards";
import { getFraudService } from "@/modules/fraud";
import { getGovernmentService } from "@/modules/government";
import { getSimulationService } from "@/modules/simulation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  // Fetch ALL dashboard data server-side in parallel (M1–M10).
  const [
    health,
    flags,
    audit,
    roles,
    telemetry,
    identitySummaryRaw,
    geoSummary,
    geoPoisRaw,
    geoRegionsRaw,
    geoLayersRaw,
    twinSummary,
    twinGraphRaw,
    temporalSummary,
    kgAnalytics,
    evidenceSummary,
    intelSummary,
    corroborationSummary,
    trustSummary,
    notificationSummary,
    satelliteSummary,
    cvSummary,
    observationSummary,
    fusionSummary,
    predictionSummary,
    hotspotSummary,
    copilotSummary,
    missionSummary,
    rewardSummary,
    fraudSummary,
    governmentSummary,
    simulationSummary,
  ] = await Promise.all([
    getHealthService().runAll(),
    getFeatureFlagService().list(),
    getAuditService().list({ limit: 12 }),
    getIamService().listRoles(),
    Promise.resolve(getTelemetryState()),
    fetchIdentitySummary(),
    getSpatialQueryService().summary(),
    getPOIService().list({ limit: 500 }),
    getRegionService().list(),
    getLayerService().list(),
    getTwinSummaryService().summary(),
    getTwinSummaryService().graph({ limit: 100 }),
    getTemporalService().temporalSummary(),
    getKnowledgeGraphService().analytics(),
    getEvidenceService().summary(),
    getIntelligenceService().summary(),
    getCorroborationService().summary(),
    getCivilTrustService().summary(),
    getNotificationService().summary(),
    getSatelliteIngestionService().summary(),
    getCVService().summary(),
    getObservationService().summary(),
    getFusionService().summary(),
    getPredictionService().summary(),
    getHotspotService().summary(),
    getCopilotService().summary(),
    getMissionService().summary(),
    getRewardService().summary(),
    getFraudService().summary(),
    getGovernmentService().summary(),
    getSimulationService().summary(),
  ]);

  // Transform KG graph nodes with type colors
  const kgGraph = {
    nodes: kgAnalytics.graph.nodes.map((n) => ({
      ...n,
      color: ENTITY_TYPE_CATALOGUE.find((t) => t.type === n.type)?.color ?? "#6b7280",
    })),
    edges: kgAnalytics.graph.edges,
    stats: kgAnalytics.graph.stats,
  };

  // Transform twin graph nodes with type colors
  const twinGraph = {
    nodes: twinGraphRaw.nodes.map((n) => ({
      ...n,
      color: ENTITY_TYPE_CATALOGUE.find((t) => t.type === n.type)?.color ?? "#6b7280",
    })),
    edges: twinGraphRaw.edges,
    stats: twinGraphRaw.stats,
  };

  // Transform geo data for the map client component
  const geoPois = geoPoisRaw.pois.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    status: p.status,
    severity: p.severity,
  }));
  const geoRegions = geoRegionsRaw.regions
    .filter((r) => r.geojson?.geometry?.type === "Polygon")
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      coordinates: r.geojson!.geometry.coordinates[0] as [number, number][],
      areaKm2: r.areaKm2,
    }));
  const geoLayers = geoLayersRaw.layers.map((l) => ({
    key: l.key,
    name: l.name,
    type: l.type,
    visible: l.visible,
    opacity: l.opacity,
  }));

  const metricsSnapshot = metrics.snapshot();
  const safeConfig = safeConfigSnapshot();

  const outboxPending = await db.outboxEvent
    .count({ where: { status: "pending" } })
    .catch(() => 0);
  const jobDepth = await db.jobRecord
    .count({ where: { status: "queued" } })
    .catch(() => 0);

  const subsystems = [
    { icon: Database, name: "Database", provider: String(safeConfig.DATABASE_PROVIDER), target: "PostgreSQL + PostGIS", detail: "Prisma ORM · transactional outbox" },
    { icon: HardDrive, name: "Object Storage", provider: String(safeConfig.STORAGE_PROVIDER), target: "S3 / MinIO / R2", detail: "Provider-agnostic port" },
    { icon: Radio, name: "Event Bus", provider: String(safeConfig.EVENT_BUS_PROVIDER), target: "Redis Pub/Sub · NATS", detail: "Domain events · outbox relay" },
    { icon: Cpu, name: "Background Jobs", provider: String(safeConfig.JOB_QUEUE_PROVIDER), target: "BullMQ (Redis)", detail: "Durable · retries · backoff" },
    { icon: KeyRound, name: "Authentication", provider: (safeConfig.AUTH_PROVIDERS as string[])?.join(", ") ?? "credentials", target: "NextAuth.js v4 · JWT", detail: "OAuth-ready (Google/GitHub/Azure)" },
    { icon: Flag, name: "Feature Flags", provider: String(safeConfig.FEATURE_FLAG_PROVIDER), target: "boolean · % · segment · env", detail: "Cached evaluation engine" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Sentinel</h1>
                <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wide">
                  M23 · Simulation Engine
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Community Intelligence &amp; Digital Twin Platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {config.NODE_ENV}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              v{config.NEXT_PUBLIC_APP_VERSION}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              API {config.NEXT_PUBLIC_API_VERSION}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero */}
        <section className="mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Simulation Engine
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                "What if?" scenario modeling for policy and operational interventions.
                Increase inspections, protect watersheds, close roads, deploy drones —
                the engine predicts outcomes across 5 dimensions: illegal mining rate,
                water quality, forest cover, economic impact, and enforcement cost.
                Compare scenarios to find the best intervention strategy.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
              <span>·</span>
              <span>auto-refresh 30s</span>
            </div>
          </div>
        </section>

        <DashboardTabs>
          {/* === M23: Simulation Engine (first child = first tab, default) === */}
          <SimulationDashboard initialSummary={simulationSummary} />

          {/* === M22: Government Operations Center (second child = second tab) === */}
          <GovernmentDashboard initialSummary={governmentSummary} />

          {/* === M21: Fraud Detection AI (second child = second tab) === */}
          <FraudDashboard initialSummary={fraudSummary} />

          {/* === M20: Reward Engine (second child = second tab) === */}
          <RewardDashboard initialSummary={rewardSummary} />

          {/* === M19: Mission System (second child = second tab) === */}
          <MissionDashboard initialSummary={missionSummary} />

          {/* === M18: Digital Twin AI Copilot (second child = second tab) === */}
          <CopilotDashboard initialSummary={copilotSummary} />

          {/* === M17: Prediction Engine (second child = second tab) === */}
          <HotspotDashboard initialSummary={hotspotSummary} />

          {/* === M16: Environmental Intelligence (second child = second tab) === */}
          <PredictionDashboard initialSummary={predictionSummary} />

          {/* === M15: Evidence Fusion Engine (second child = second tab) === */}
          <FusionDashboard initialSummary={fusionSummary} />

          {/* === M14: AI Observation Engine (second child = second tab) === */}
          <ObservationDashboard initialSummary={observationSummary} />

          {/* === M13: Computer Vision Platform (second child = second tab) === */}
          <CVDashboard initialSummary={cvSummary} />

          {/* === M12: Satellite Ingestion (second child = second tab) === */}
          <SatelliteDashboard initialSummary={satelliteSummary} />

          {/* === M11: Notification Platform (second child = second tab) === */}
          <NotificationDashboard initialSummary={notificationSummary} />

          {/* === M10: Civil Trust Engine (second child = second tab) === */}
          <TrustDashboard initialSummary={trustSummary} />

          {/* === M9: Corroboration Engine (second child = second tab) === */}
          <CorroborationDashboard initialSummary={corroborationSummary} />

          {/* === M8: Community Intelligence (third child = second tab) === */}
          <IntelligenceDashboard initialSummary={intelSummary} />

          {/* === M7: Evidence Platform (fourth child = third tab) === */}
          <EvidenceDashboard initialSummary={evidenceSummary} />

          {/* === M6: Knowledge Graph (fifth child = fourth tab) === */}
          <KnowledgeGraphDashboard initialAnalytics={kgAnalytics} initialGraph={kgGraph} />

          {/* === M5: Temporal Engine (sixth child = fifth tab) === */}
          <TemporalDashboard initialSummary={temporalSummary} />

          {/* === M4: Digital Twin (seventh child = sixth tab) === */}
          <TwinDashboard initialSummary={twinSummary} initialGraph={twinGraph} />

          {/* === M3: Geospatial (eighth child = seventh tab) === */}
          <GeospatialDashboard
            initialSummary={geoSummary}
            initialPois={geoPois}
            initialRegions={geoRegions}
            initialLayers={geoLayers}
          />

          {/* === M2: Identity & Trust (ninth child = eighth tab) === */}
          <IdentityDashboard initial={identitySummaryRaw} />

          {/* === M1: Foundation (tenth child = ninth tab) === */}
          <div>
            {/* KPI row */}
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi icon={Boxes} label="Subsystems" value={String(subsystems.length)} hint="operational" />
              <Kpi icon={Layers} label="Bounded Contexts" value="6" hint="iam · audit · flags · identity · geo · twin" />
              <Kpi icon={KeyRound} label="RBAC Roles" value={String(roles.length)} hint="seeded" />
              <Kpi icon={Flag} label="Feature Flags" value={String(flags.length)} hint={`${flags.filter((f) => f.enabled).length} active`} />
              <Kpi icon={GitBranch} label="Outbox Pending" value={String(outboxPending)} hint="events" />
              <Kpi icon={Activity} label="Job Queue" value={String(jobDepth)} hint="queued" />
            </section>

            {/* Health (live) */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">System Health &amp; Readiness</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <HealthLiveView
                  initialChecks={health.checks}
                  initialStatus={health.status}
                  initialUptime={health.uptime}
                />
              </CardContent>
            </Card>

            {/* Subsystems + flags */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Subsystem Architecture</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {subsystems.map((s) => (
                      <div key={s.name} className="rounded-lg border border-border bg-card/50 p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <s.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-none">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">{s.detail}</p>
                          </div>
                        </div>
                        <Separator className="my-2.5" />
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <p className="text-muted-foreground uppercase tracking-wide">Active</p>
                            <code className="font-mono text-foreground">{s.provider}</code>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground uppercase tracking-wide">Prod target</p>
                            <code className="font-mono text-foreground">{s.target}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <FeatureFlagsPanel initialFlags={flags} />
                </CardContent>
              </Card>
            </div>

            {/* Audit + RBAC */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScrollText className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">Audit Log</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">tamper-evident · {audit.total}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-y-auto -mr-2 pr-2 space-y-1.5">
                    {audit.entries.length === 0 && (
                      <p className="py-8 text-center text-xs text-muted-foreground">No audit entries yet.</p>
                    )}
                    {audit.entries.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2.5 rounded-md border border-border/60 bg-card/40 p-2.5">
                        <div className={"mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full " + (entry.outcome === "success" ? "bg-success" : entry.outcome === "failure" ? "bg-destructive" : "bg-warning")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <code className="truncate text-xs font-mono">{entry.action}</code>
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                              {new Date(entry.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {entry.actorType} · {entry.resource}{entry.resourceId ? `:${entry.resourceId.slice(0, 8)}` : ""}{entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">RBAC Explorer</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-y-auto -mr-2 pr-2 space-y-2">
                    {roles.map((role) => (
                      <div key={role.id} className="rounded-lg border border-border bg-card/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-medium">{role.key}</code>
                            {role.isSystem && <Badge variant="secondary" className="text-[9px] uppercase">system</Badge>}
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{role.userCount} users</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{role.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {role.permissions.slice(0, 6).map((p) => (
                            <span key={p.key} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono">{p.key}</span>
                          ))}
                          {role.permissions.length > 6 && (
                            <span className="text-[9px] text-muted-foreground">+{role.permissions.length - 6} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Architecture + API directory */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Architecture — DDD + Event Driven</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ArchitectureMap />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <GitPullRequestArrow className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">API Directory</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ApiDirectory />
                </CardContent>
              </Card>
            </div>

            {/* Observability */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Observability</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={telemetry.tracesActive ? "default" : "secondary"} className="text-[10px]">
                      Traces {telemetry.tracesActive ? "ON" : "OFF"}
                    </Badge>
                    <Badge variant={telemetry.metricsActive ? "default" : "secondary"} className="text-[10px]">
                      Metrics {telemetry.metricsActive ? "ON" : "OFF"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {metricsSnapshot.filter((m) => m.samples.length > 0).slice(0, 8).map((m) => (
                    <div key={m.name} className="rounded-lg border border-border bg-card/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{m.name}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{m.samples.reduce((a, s) => a + s.value, 0)}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{m.type}</p>
                    </div>
                  ))}
                  {metricsSnapshot.filter((m) => m.samples.length > 0).length === 0 && (
                    <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                      Metrics populate as the platform handles requests.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <CardTitle className="text-sm">Milestones Checklist</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    "M1: Monorepo · DDD · EDA",
                    "M1: Next.js App Router · TS",
                    "M1: PostgreSQL + PostGIS · Prisma",
                    "M1: Object Storage · Jobs · Event Bus",
                    "M1: Authentication · RBAC · Audit",
                    "M1: Feature Flags · Observability · Health",
                    "M1: API versioning · Config · Secrets",
                    "M1: Docker · CI/CD · Tests",
                    "M2: Organizations (Gov/NGO/Researcher)",
                    "M2: Members · Invitations · Roles",
                    "M2: Identity Verification workflow",
                    "M2: Trust Profile · Score · Badges",
                    "M2: Device Management",
                    "M2: Session Management",
                    "M2: Role Switching",
                    "M3: PostGIS · Spatial Queries · Indexing",
                    "M3: Map Rendering · Layers · Tiles",
                    "M3: Coordinate Transforms · Quadkeys",
                    "M3: Distance · Polygon · Nearest-Neighbor",
                    "M4: Versioned Entities (River/Road/Mine/Forest)",
                    "M4: Graph Relationships (affects/contains/monitors)",
                    "M4: Event History Timeline",
                    "M4: Historical Imagery & Change Detection",
                    "M5: Temporal Engine (Nothing Overwritten)",
                    "M5: Time Travel (Yesterday/Month/Year)",
                    "M5: Version Comparison & Diff",
                    "M5: History Replay (Day-by-Day)",
                    "M6: Knowledge Graph · Graph Traversal",
                    "M6: Shortest Path · Connected Components",
                    "M6: Degree Centrality · Relationship Matrix",
                    "M6: Typed Templates (River→Community, Mine→River)",
                    "M7: Universal Evidence (Image/Video/Audio/Doc/GPS)",
                    "M7: SHA-256 Hashing + Hash Chain Tamper Detection",
                    "M7: AES-256-GCM Encryption + KMS Keys",
                    "M7: GPS Tagging + Metadata + Version History",
                    "M8: Community Intelligence (Event-Sourced)",
                    "M8: Subscribe · Watch · Follow · Share · Comment",
                    "M8: Append-Only Event Stream · Projection Fold",
                    "M8: Evidence Attachment + Threaded Comments",
                    "M9: Corroboration Engine (Support/Dispute)",
                    "M9: Independent Corroboration + Duplicate Detection",
                    "M9: Witness Confidence + Evidence Weighting",
                    "M9: 5-Tier System (Unverified→Confirmed)",
                    "M10: Reward Engine (8-Factor)",
                    "M10: Accuracy · Reliability · False Reports",
                    "M10: Evidence Quality · Contribution Quality · Impact",
                    "M10: Decay (90-day half-life) · Fraud Resistance",
                    "M19: Mission System (AI-Dispatched)",
                    "M19: Low-Confidence Trigger · Trust Tier Eligibility",
                    "M19: Evidence Submission · Quality Verification",
                    "M19: Reward = Base × Priority × Quality",
                    "M20: Reward Engine (Donation/NGO/Grant)",
                    "M20: Hash-Chained Audit Ledger · No Crypto",
                    "M20: Merit-Based Distribution · Contribution Scoring",
                    "M21: Fraud Detection AI (7 Detectors)",
                    "M21: Fake Evidence · Collusion · Sockpuppets",
                    "M21: Location Spoofing · Deepfakes",
                    "M21: Vote Rings · Reward Farming",
                    "M22: Gov Operations Center (3-Tier)",
                    "M22: National · Regional · District Dashboards",
                    "M22: Investigation Workflow (9 steps)",
                    "M22: Inspection Workflow + Findings",
                    "M22: Case Management + Timeline Events",
                    "M23: Simulation Engine (What if?)",
                    "M23: Increase Inspections · Protect Watershed",
                    "M23: Close Roads · Deploy Drones · Combined",
                    "M23: 5 Outcome Dimensions (Mining · Water · Forest · Economic · Cost)",
                    "M23: Scenario Comparison + ROI Ranking",
                    "M24: Mobile App (next)",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                      <span className="text-foreground/80">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </DashboardTabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card/30">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Sentinel Platform · M23 — Simulation Engine</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Link href="/api/v1/info" className="hover:text-foreground transition-colors">API</Link>
            <Link href="/api/v1/health" className="hover:text-foreground transition-colors">Health</Link>
            <Link href="/api/v1/system" className="hover:text-foreground transition-colors">System</Link>
            <Link href="/api/v1/simulations/summary" className="hover:text-foreground transition-colors">Sim</Link>
            <Link href="/api/v1/government/summary" className="hover:text-foreground transition-colors">Govt</Link>
            <Link href="/api/v1/fraud/summary" className="hover:text-foreground transition-colors">Fraud</Link>
            <Link href="/api/v1/rewards/summary" className="hover:text-foreground transition-colors">Rewards</Link>
            <Link href="/api/v1/intelligence/summary" className="hover:text-foreground transition-colors">Intel</Link>
            <Link href="/api/v1/evidence/summary" className="hover:text-foreground transition-colors">Evidence</Link>
            <Link href="/api/v1/twin/kg/analytics" className="hover:text-foreground transition-colors">KG</Link>
            <Link href="/api/v1/twin/temporal/summary" className="hover:text-foreground transition-colors">Temporal</Link>
            <Link href="/api/v1/twin/summary" className="hover:text-foreground transition-colors">Twin</Link>
            <Link href="/api/v1/geo/summary" className="hover:text-foreground transition-colors">Geo</Link>
            <Link href="/api/v1/identity-summary" className="hover:text-foreground transition-colors">Identity</Link>
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secrets redacted</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side data fetch for the identity summary (inline to avoid an extra
// HTTP roundtrip on first render).
// ---------------------------------------------------------------------------

async function fetchIdentitySummary() {
  const [
    organizationsByType,
    organizationsByStatus,
    totalMembers,
    totalDevices,
    trustedDevices,
    verificationsByStatus,
    verificationsByType,
    trustTiers,
    topTrustProfiles,
    recentVerifications,
    recentOrgs,
  ] = await Promise.all([
    db.organization.groupBy({ by: ["type"], _count: true }),
    db.organization.groupBy({ by: ["status"], _count: true }),
    db.organizationMember.count({ where: { status: "active" } }),
    db.device.count(),
    db.device.count({ where: { status: "trusted" } }),
    db.identityVerification.groupBy({ by: ["status"], _count: true }),
    db.identityVerification.groupBy({ by: ["type"], _count: true }),
    db.trustProfile.groupBy({ by: ["tier"], _count: true }),
    db.trustProfile.findMany({
      take: 5,
      orderBy: { score: "desc" },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    }),
    db.identityVerification.findMany({
      take: 8,
      orderBy: { submittedAt: "desc" },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    db.organization.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    }),
  ]);

  return {
    organizations: {
      byType: organizationsByType.map((g) => ({ type: g.type, count: g._count })),
      byStatus: organizationsByStatus.map((g) => ({ status: g.status, count: g._count })),
      total: organizationsByType.reduce((s, g) => s + g._count, 0),
    },
    members: { total: totalMembers },
    devices: { total: totalDevices, trusted: trustedDevices, untrusted: totalDevices - trustedDevices },
    verifications: {
      byStatus: verificationsByStatus.map((g) => ({ status: g.status, count: g._count })),
      byType: verificationsByType.map((g) => ({ type: g.type, count: g._count })),
      total: verificationsByStatus.reduce((s, g) => s + g._count, 0),
    },
    trust: {
      byTier: trustTiers.map((g) => ({ tier: g.tier, count: g._count })),
      topProfiles: topTrustProfiles.map((p) => ({
        userId: p.userId,
        score: p.score,
        tier: p.tier,
        badges: p.badges ? JSON.parse(p.badges) : [],
        user: p.user,
      })),
    },
    recent: {
      verifications: recentVerifications.map((v) => ({
        id: v.id,
        type: v.type,
        status: v.status,
        submittedAt: v.submittedAt,
        user: v.user,
      })),
      organizations: recentOrgs.map((o) => ({
        id: o.id,
        key: o.key,
        name: o.name,
        type: o.type,
        status: o.status,
        country: o.country,
        memberCount: o._count.members,
        createdAt: o.createdAt,
      })),
    },
  };
}

// ---------------------------------------------------------------------------

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && (
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{hint}</span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ArchitectureMap() {
  const layers = [
    { title: "Presentation", icon: Server, color: "text-chart-1", items: ["Next.js App Router", "Server Components", "API Routes (v1)"] },
    { title: "Application", icon: Radar, color: "text-chart-2", items: ["Use-case Services", "DTOs / Mappers", "RBAC Guards"] },
    { title: "Domain", icon: Layers, color: "text-chart-3", items: ["Aggregate Roots", "Value Objects", "Domain Events"] },
    { title: "Infrastructure", icon: HardDrive, color: "text-chart-4", items: ["Prisma Repos", "Event Bus", "Storage · Jobs"] },
  ];
  return (
    <div className="space-y-2.5">
      {layers.map((layer, i) => (
        <div key={layer.title}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-2.5">
            <div className={"flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted " + layer.color}>
              <layer.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-none">{layer.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {layer.items.map((item) => (
                  <span key={item} className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-mono">{item}</span>
                ))}
              </div>
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="ml-6 flex h-3 items-center">
              <ArrowRight className="h-3 w-3 rotate-90 text-muted-foreground/50" />
            </div>
          )}
        </div>
      ))}
      <div className="mt-3 rounded-md bg-primary/5 p-2.5 text-[10px] text-muted-foreground">
        <span className="font-medium text-foreground">Pattern:</span> Transactional Outbox · CQRS read models · Ports &amp; Adapters · Domain events flow: Aggregate → Outbox (same tx) → Relay → Event Bus → Audit handler + projectors.
      </div>
    </div>
  );
}

function ApiDirectory() {
  const endpoints = [
    { method: "GET", path: "/api/v1/health", auth: false, desc: "Liveness probe" },
    { method: "GET", path: "/api/v1/readiness", auth: false, desc: "Readiness (all checks)" },
    { method: "GET", path: "/api/v1/system", auth: false, desc: "Architecture overview" },
    { method: "GET", path: "/api/v1/info", auth: false, desc: "API versioning directory" },
    { method: "GET", path: "/api/v1/identity-summary", auth: false, desc: "Identity platform metrics" },
    { method: "GET", path: "/api/v1/organizations", auth: true, desc: "List organizations" },
    { method: "GET", path: "/api/v1/devices", auth: true, desc: "List devices" },
    { method: "GET", path: "/api/v1/verifications", auth: true, desc: "List verifications" },
    { method: "GET", path: "/api/v1/trust", auth: true, desc: "Trust leaderboard" },
    { method: "GET", path: "/api/v1/role-switch", auth: true, desc: "Active role + history" },
  ];
  return (
    <div className="space-y-1">
      {endpoints.map((e) => (
        <Link
          key={e.path + e.method}
          href={e.path}
          className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-2.5 py-1.5 hover:bg-accent/50 transition-colors"
        >
          <span
            className={
              "inline-flex w-12 flex-shrink-0 justify-center rounded px-1.5 py-0.5 text-[9px] font-bold " +
              (e.method === "GET" ? "bg-success/15 text-success" : e.method === "PATCH" ? "bg-warning/15 text-warning-foreground" : "bg-primary/15 text-primary")
            }
          >
            {e.method}
          </span>
          <code className="flex-1 truncate text-xs font-mono">{e.path}</code>
          {e.auth ? (
            <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <span className="flex-shrink-0 text-[9px] text-muted-foreground">public</span>
          )}
        </Link>
      ))}
    </div>
  );
}
