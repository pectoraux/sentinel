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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FoundationDashboardPage() {
  // Fetch all dashboard data server-side in parallel.
  const [health, flags, audit, roles, telemetry] = await Promise.all([
    getHealthService().runAll(),
    getFeatureFlagService().list(),
    getAuditService().list({ limit: 12 }),
    getIamService().listRoles(),
    Promise.resolve(getTelemetryState()),
  ]);

  const metricsSnapshot = metrics.snapshot();
  const safeConfig = safeConfigSnapshot();

  const outboxPending = await db.outboxEvent
    .count({ where: { status: "pending" } })
    .catch(() => 0);
  const jobDepth = await db.jobRecord
    .count({ where: { status: "queued" } })
    .catch(() => 0);

  const subsystems = [
    {
      icon: Database,
      name: "Database",
      provider: String(safeConfig.DATABASE_PROVIDER),
      target: "PostgreSQL + PostGIS",
      detail: "Prisma ORM · transactional outbox",
    },
    {
      icon: HardDrive,
      name: "Object Storage",
      provider: String(safeConfig.STORAGE_PROVIDER),
      target: "S3 / MinIO / R2",
      detail: "Provider-agnostic port",
    },
    {
      icon: Radio,
      name: "Event Bus",
      provider: String(safeConfig.EVENT_BUS_PROVIDER),
      target: "Redis Pub/Sub · NATS",
      detail: "Domain events · outbox relay",
    },
    {
      icon: Cpu,
      name: "Background Jobs",
      provider: String(safeConfig.JOB_QUEUE_PROVIDER),
      target: "BullMQ (Redis)",
      detail: "Durable · retries · backoff",
    },
    {
      icon: KeyRound,
      name: "Authentication",
      provider: (safeConfig.AUTH_PROVIDERS as string[])?.join(", ") ?? "credentials",
      target: "NextAuth.js v4 · JWT",
      detail: "OAuth-ready (Google/GitHub/Azure)",
    },
    {
      icon: Flag,
      name: "Feature Flags",
      provider: String(safeConfig.FEATURE_FLAG_PROVIDER),
      target: "boolean · % · segment · env",
      detail: "Cached evaluation engine",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ---------------------------------------------------------------- Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Sentinel</h1>
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex text-[10px] uppercase tracking-wide"
                >
                  M1 · Foundation
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Community Intelligence &amp; Digital Twin Platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wide"
            >
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

      {/* ---------------------------------------------------------------- Main */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero */}
        <section className="mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Platform Foundation
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Production-grade architecture for detecting, verifying and predicting
                illegal mining and environmental crimes across Africa. This milestone
                ships the foundation — maps, AI and the Digital Twin plug into these
                subsystems in later milestones.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
              <span>·</span>
              <span>auto-refresh 15s</span>
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            icon={Boxes}
            label="Subsystems"
            value={String(subsystems.length)}
            hint="operational"
          />
          <Kpi
            icon={Layers}
            label="Bounded Contexts"
            value="3"
            hint="iam · audit · flags"
          />
          <Kpi
            icon={KeyRound}
            label="RBAC Roles"
            value={String(roles.length)}
            hint="seeded"
          />
          <Kpi
            icon={Flag}
            label="Feature Flags"
            value={String(flags.length)}
            hint={`${flags.filter((f) => f.enabled).length} active`}
          />
          <Kpi
            icon={GitBranch}
            label="Outbox Pending"
            value={String(outboxPending)}
            hint="events"
          />
          <Kpi
            icon={Activity}
            label="Job Queue"
            value={String(jobDepth)}
            hint="queued"
          />
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

        {/* Two-column: subsystems + flags */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">
                  Subsystem Architecture
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {subsystems.map((s) => (
                  <div
                    key={s.name}
                    className="rounded-lg border border-border bg-card/50 p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <s.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">
                          {s.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                          {s.detail}
                        </p>
                      </div>
                    </div>
                    <Separator className="my-2.5" />
                    <div className="flex items-center justify-between text-[11px]">
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wide">
                          Active
                        </p>
                        <code className="font-mono text-foreground">
                          {s.provider}
                        </code>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground uppercase tracking-wide">
                          Prod target
                        </p>
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

        {/* Audit log + RBAC */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Audit Log</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  tamper-evident · {audit.total}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto -mr-2 pr-2 space-y-1.5">
                {audit.entries.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No audit entries yet. Trigger an action to populate.
                  </p>
                )}
                {audit.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2.5 rounded-md border border-border/60 bg-card/40 p-2.5"
                  >
                    <div
                      className={
                        "mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full " +
                        (entry.outcome === "success"
                          ? "bg-success"
                          : entry.outcome === "failure"
                            ? "bg-destructive"
                            : "bg-warning")
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <code className="truncate text-xs font-mono">
                          {entry.action}
                        </code>
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {entry.actorType} · {entry.resource}
                        {entry.resourceId ? `:${entry.resourceId.slice(0, 8)}` : ""}
                        {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
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
                  <div
                    key={role.id}
                    className="rounded-lg border border-border bg-card/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-medium">
                          {role.key}
                        </code>
                        {role.isSystem && (
                          <Badge variant="secondary" className="text-[9px] uppercase">
                            system
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {role.userCount} users
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {role.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {role.permissions.slice(0, 6).map((p) => (
                        <span
                          key={p.key}
                          className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono"
                        >
                          {p.key}
                        </span>
                      ))}
                      {role.permissions.length > 6 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{role.permissions.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Architecture map + API directory */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">
                  Architecture — DDD + Event Driven
                </CardTitle>
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
                <Badge
                  variant={telemetry.tracesActive ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  Traces {telemetry.tracesActive ? "ON" : "OFF"}
                </Badge>
                <Badge
                  variant={telemetry.metricsActive ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  Metrics {telemetry.metricsActive ? "ON" : "OFF"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {metricsSnapshot
                .filter((m) => m.samples.length > 0)
                .slice(0, 8)
                .map((m) => (
                  <div
                    key={m.name}
                    className="rounded-lg border border-border bg-card/50 p-3"
                  >
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                      {m.name}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {m.samples.reduce((a, s) => a + s.value, 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {m.type}
                    </p>
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

        {/* Production readiness checklist */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <CardTitle className="text-sm">
                Milestone 1 — Foundation Checklist
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Monorepo architecture",
                "Domain Driven Design",
                "Event Driven Architecture",
                "Next.js App Router",
                "TypeScript",
                "PostgreSQL + PostGIS",
                "Prisma ORM",
                "Object Storage abstraction",
                "Background Job system",
                "Event Bus",
                "Authentication architecture",
                "RBAC",
                "Audit Logs",
                "Feature Flag system",
                "Observability",
                "OpenTelemetry",
                "Health Checks",
                "API versioning",
                "Configuration system",
                "Secrets management",
                "Production Docker setup",
                "CI/CD",
                "Testing framework",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                  <span className="text-foreground/80">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* ---------------------------------------------------------------- Footer */}
      <footer className="mt-auto border-t border-border bg-card/30">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Sentinel Platform · Milestone 1 — Foundation</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Link
              href="/api/v1/info"
              className="hover:text-foreground transition-colors"
            >
              API
            </Link>
            <Link
              href="/api/v1/health"
              className="hover:text-foreground transition-colors"
            >
              Health
            </Link>
            <Link
              href="/api/v1/system"
              className="hover:text-foreground transition-colors"
            >
              System
            </Link>
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> Secrets redacted
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
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
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {hint}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

function ArchitectureMap() {
  const layers = [
    {
      title: "Presentation",
      icon: Server,
      color: "text-chart-1",
      items: ["Next.js App Router", "Server Components", "API Routes (v1)"],
    },
    {
      title: "Application",
      icon: Radar,
      color: "text-chart-2",
      items: ["Use-case Services", "DTOs / Mappers", "RBAC Guards"],
    },
    {
      title: "Domain",
      icon: Layers,
      color: "text-chart-3",
      items: ["Aggregate Roots", "Value Objects", "Domain Events"],
    },
    {
      title: "Infrastructure",
      icon: HardDrive,
      color: "text-chart-4",
      items: ["Prisma Repos", "Event Bus", "Storage · Jobs"],
    },
  ];
  return (
    <div className="space-y-2.5">
      {layers.map((layer, i) => (
        <div key={layer.title}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-2.5">
            <div
              className={
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted " +
                layer.color
              }
            >
              <layer.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-none">{layer.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {layer.items.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-mono"
                  >
                    {item}
                  </span>
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
        <span className="font-medium text-foreground">Pattern:</span>{" "}
        Transactional Outbox · CQRS read models · Ports &amp; Adapters · Domain
        events flow: Aggregate → Outbox (same tx) → Relay → Event Bus → Audit
        handler + future projectors.
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
    { method: "GET", path: "/api/v1/feature-flags", auth: false, desc: "List feature flags" },
    { method: "PATCH", path: "/api/v1/feature-flags", auth: true, desc: "Toggle a flag" },
    { method: "GET", path: "/api/v1/audit-logs", auth: true, desc: "Audit log entries" },
    { method: "GET", path: "/api/v1/roles", auth: true, desc: "RBAC roles" },
    { method: "GET", path: "/api/v1/metrics", auth: true, desc: "Observability metrics" },
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
              (e.method === "GET"
                ? "bg-success/15 text-success"
                : e.method === "PATCH"
                  ? "bg-warning/15 text-warning-foreground"
                  : "bg-primary/15 text-primary")
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
