"use client";

import * as React from "react";
import {
  Code2,
  Webhook,
  Key,
  Package,
  BookOpen,
  Plug,
  GitBranch,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Lock,
  ExternalLink,
  Copy,
  Zap,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  messaging: MessageSquare,
  gis: Map,
  monitoring: Activity,
  data: BarChart3,
  automation: Zap,
  security: Shield,
};

const CATEGORY_COLOR: Record<string, string> = {
  messaging: "#0ea5e9",
  gis: "#22c55e",
  monitoring: "#f59e0b",
  data: "#a855f7",
  automation: "#14b8a6",
  security: "#ef4444",
};

const SDK_COLOR: Record<string, string> = {
  javascript: "#f7df1e",
  python: "#3776ab",
  go: "#00add8",
  java: "#ed8b00",
  php: "#777bb4",
  ruby: "#cc342d",
};
const SDK_LABEL: Record<string, string> = {
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  java: "Java",
  php: "PHP",
  ruby: "Ruby",
};
const SDK_ICON: Record<string, string> = {
  javascript: "JS",
  python: "PY",
  go: "GO",
  java: "JV",
  php: "PHP",
  ruby: "RB",
};

function formatGHS(n: number) {
  if (Math.abs(n) >= 1_000_000) return `₵${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₵${(n / 1_000).toFixed(0)}K`;
  return `₵${n}`;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Static REST API directory (from domain)
const REST_ENDPOINTS = [
  { method: "GET", path: "/api/v1/health", desc: "Liveness probe", auth: false, cat: "Platform" },
  { method: "GET", path: "/api/v1/readiness", desc: "Readiness check", auth: false, cat: "Platform" },
  { method: "GET", path: "/api/v1/system", desc: "Architecture overview", auth: false, cat: "Platform" },
  { method: "GET", path: "/api/v1/identity-summary", desc: "Identity metrics", auth: false, cat: "Identity" },
  { method: "GET", path: "/api/v1/organizations", desc: "List organizations", auth: true, cat: "Identity" },
  { method: "GET", path: "/api/v1/evidence/summary", desc: "Evidence summary", auth: false, cat: "Evidence" },
  { method: "GET", path: "/api/v1/evidence", desc: "List evidence", auth: true, cat: "Evidence" },
  { method: "POST", path: "/api/v1/evidence", desc: "Upload evidence", auth: true, cat: "Evidence" },
  { method: "GET", path: "/api/v1/intelligence/summary", desc: "Intelligence summary", auth: false, cat: "Intelligence" },
  { method: "GET", path: "/api/v1/intelligence/events", desc: "List events", auth: true, cat: "Intelligence" },
  { method: "POST", path: "/api/v1/intelligence/events", desc: "Create event", auth: true, cat: "Intelligence" },
  { method: "GET", path: "/api/v1/corroboration/summary", desc: "Corroboration summary", auth: false, cat: "Corroboration" },
  { method: "GET", path: "/api/v1/trust/summary", desc: "Trust summary", auth: false, cat: "Trust" },
  { method: "GET", path: "/api/v1/notifications/summary", desc: "Notification summary", auth: false, cat: "Notifications" },
  { method: "GET", path: "/api/v1/satellite/summary", desc: "Satellite summary", auth: false, cat: "Satellite" },
  { method: "GET", path: "/api/v1/satellite/scenes", desc: "List scenes", auth: true, cat: "Satellite" },
  { method: "GET", path: "/api/v1/cv/summary", desc: "CV detection summary", auth: false, cat: "Computer Vision" },
  { method: "POST", path: "/api/v1/cv/detect", desc: "Run CV detection", auth: true, cat: "Computer Vision" },
  { method: "GET", path: "/api/v1/observations/summary", desc: "AI observations summary", auth: false, cat: "AI Observations" },
  { method: "GET", path: "/api/v1/fusion/summary", desc: "Fusion summary", auth: false, cat: "Fusion" },
  { method: "GET", path: "/api/v1/predictions/summary", desc: "Predictions summary", auth: false, cat: "Predictions" },
  { method: "GET", path: "/api/v1/predictions", desc: "List predictions", auth: true, cat: "Predictions" },
  { method: "GET", path: "/api/v1/hotspots/summary", desc: "Hotspots summary", auth: false, cat: "Hotspots" },
  { method: "GET", path: "/api/v1/hotspots", desc: "List hotspots", auth: true, cat: "Hotspots" },
  { method: "POST", path: "/api/v1/copilot/query", desc: "Ask AI Copilot", auth: true, cat: "Copilot" },
  { method: "GET", path: "/api/v1/missions/summary", desc: "Missions summary", auth: false, cat: "Missions" },
  { method: "GET", path: "/api/v1/missions", desc: "List missions", auth: true, cat: "Missions" },
  { method: "POST", path: "/api/v1/missions/{id}/accept", desc: "Accept mission", auth: true, cat: "Missions" },
  { method: "GET", path: "/api/v1/rewards/summary", desc: "Rewards summary", auth: false, cat: "Rewards" },
  { method: "GET", path: "/api/v1/rewards/pools", desc: "List pools", auth: true, cat: "Rewards" },
  { method: "POST", path: "/api/v1/rewards/contribute", desc: "Contribute to pool", auth: true, cat: "Rewards" },
  { method: "GET", path: "/api/v1/fraud/summary", desc: "Fraud summary", auth: false, cat: "Fraud" },
  { method: "GET", path: "/api/v1/fraud/alerts", desc: "List fraud alerts", auth: true, cat: "Fraud" },
  { method: "POST", path: "/api/v1/fraud/scan", desc: "Trigger fraud scan", auth: true, cat: "Fraud" },
  { method: "GET", path: "/api/v1/government/summary", desc: "Government summary", auth: false, cat: "Government" },
  { method: "GET", path: "/api/v1/government/dashboard", desc: "Gov dashboard", auth: false, cat: "Government" },
  { method: "GET", path: "/api/v1/government/investigations", desc: "List investigations", auth: true, cat: "Government" },
  { method: "GET", path: "/api/v1/government/inspections", desc: "List inspections", auth: true, cat: "Government" },
  { method: "GET", path: "/api/v1/government/cases", desc: "List cases", auth: true, cat: "Government" },
  { method: "GET", path: "/api/v1/simulations/summary", desc: "Simulation summary", auth: false, cat: "Simulation" },
  { method: "POST", path: "/api/v1/simulations/run", desc: "Run simulation", auth: true, cat: "Simulation" },
  { method: "GET", path: "/api/v1/analytics/summary", desc: "Analytics summary", auth: false, cat: "Analytics" },
  { method: "GET", path: "/api/v1/analytics/dashboard", desc: "Analytics dashboard", auth: false, cat: "Analytics" },
  { method: "GET", path: "/api/v1/dev/summary", desc: "Developer summary", auth: false, cat: "Developer" },
  { method: "GET", path: "/api/v1/dev/webhooks", desc: "List webhooks", auth: true, cat: "Developer" },
  { method: "POST", path: "/api/v1/dev/webhooks", desc: "Create webhook", auth: true, cat: "Developer" },
  { method: "GET", path: "/api/v1/dev/api-keys", desc: "List API keys", auth: true, cat: "Developer" },
  { method: "POST", path: "/api/v1/dev/api-keys", desc: "Create API key", auth: true, cat: "Developer" },
  { method: "GET", path: "/api/v1/dev/sdk", desc: "List SDK releases", auth: false, cat: "Developer" },
  { method: "GET", path: "/api/v1/dev/integrations", desc: "List integrations", auth: false, cat: "Developer" },
  { method: "GET", path: "/api/v1/dev/docs", desc: "API documentation", auth: false, cat: "Developer" },
  { method: "POST", path: "/api/v1/dev/graphql", desc: "GraphQL endpoint", auth: true, cat: "Developer" },
];

export function DeveloperDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [activeSection, setActiveSection] = React.useState<"api" | "webhooks" | "keys" | "sdk" | "integrations" | "docs" | "graphql">("api");
  const [webhooks, setWebhooks] = React.useState<any[]>(initialSummary.recentWebhooks ?? []);
  const [apiKeys, setApiKeys] = React.useState<any[]>(initialSummary.recentApiKeys ?? []);
  const [sdkReleases, setSdkReleases] = React.useState<any[]>([]);
  const [integrations, setIntegrations] = React.useState<any[]>([]);
  const [deliveries, setDeliveries] = React.useState<any[]>(initialSummary.recentDeliveries ?? []);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/v1/dev/summary", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setSummary(d);
        setWebhooks(d.recentWebhooks ?? []);
        setApiKeys(d.recentApiKeys ?? []);
        setDeliveries(d.recentDeliveries ?? []);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Fetch SDK releases and integrations on mount
  React.useEffect(() => {
    fetch("/api/v1/dev/sdk").then((r) => r.json()).then((d) => setSdkReleases(d.releases ?? [])).catch(() => {});
    fetch("/api/v1/dev/integrations").then((r) => r.json()).then((d) => setIntegrations(d.integrations ?? [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Top-level KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <DevKpi icon={Code2} label="API Endpoints" value={String(summary.apiEndpoints ?? 0)} hint={`${summary.apiCategories ?? 0} categories`} />
        <DevKpi icon={Webhook} label="Webhooks" value={String(summary.totalWebhooks ?? 0)} hint={`${summary.activeWebhooks ?? 0} active`} />
        <DevKpi icon={Activity} label="Deliveries" value={String(summary.totalDeliveries ?? 0)} hint={`${summary.deliverySuccessRate ?? 0}% success`} />
        <DevKpi icon={Key} label="API Keys" value={String(summary.totalApiKeys ?? 0)} hint={`${summary.activeApiKeys ?? 0} active`} />
        <DevKpi icon={Package} label="SDK Releases" value={String(summary.totalSdkReleases ?? 0)} hint={`${summary.sdkLanguages ?? 0} languages`} />
        <DevKpi icon={Plug} label="Integrations" value={String(summary.totalIntegrations ?? 0)} hint={`${summary.officialIntegrations ?? 0} official`} />
        <DevKpi icon={Zap} label="Webhook Events" value={String(summary.webhookEventTypes ?? 0)} hint="event types" />
        <DevKpi icon={GitBranch} label="GraphQL" value={summary.graphqlEnabled ? "Enabled" : "Off"} hint={`${summary.graphqlQueries ?? 0} queries`} />
      </div>

      {/* Section tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
        {([
          { id: "api", label: "REST API", icon: Code2 },
          { id: "webhooks", label: "Webhooks", icon: Webhook },
          { id: "keys", label: "API Keys", icon: Key },
          { id: "sdk", label: "SDK", icon: Package },
          { id: "integrations", label: "Integrations", icon: Plug },
          { id: "graphql", label: "GraphQL", icon: GitBranch },
          { id: "docs", label: "Docs", icon: BookOpen },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      {activeSection === "api" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">REST API Directory</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">{REST_ENDPOINTS.length} endpoints · v1</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-1 overflow-y-auto -mr-2 pr-2">
              {REST_ENDPOINTS.map((ep, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 hover:bg-accent/50 transition-colors">
                  <span className={cn("inline-flex w-14 flex-shrink-0 justify-center rounded px-1.5 py-0.5 text-[9px] font-bold", METHOD_COLOR[ep.method])}>
                    {ep.method}
                  </span>
                  <code className="flex-1 truncate text-xs font-mono">{ep.path}</code>
                  <span className="hidden sm:block text-[10px] text-muted-foreground flex-shrink-0">{ep.desc}</span>
                  {ep.auth ? <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" /> : <span className="flex-shrink-0 text-[9px] text-muted-foreground">public</span>}
                  <Badge variant="outline" className="text-[8px] flex-shrink-0">{ep.cat}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "webhooks" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Webhook Endpoints</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] space-y-2 overflow-y-auto -mr-2 pr-2">
                {webhooks.map((wh: any) => (
                  <div key={wh.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium">{wh.name}</p>
                      {wh.isActive ? (
                        <Badge variant="outline" className="text-[9px] text-emerald-500">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Inactive</Badge>
                      )}
                      <span className="ml-auto text-[9px] text-muted-foreground">{wh.deliveryCount} deliveries</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{wh.url}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {wh.events?.slice(0, 4).map((ev: string) => (
                        <span key={ev} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[8px] font-mono">{ev}</span>
                      ))}
                      {wh.events?.length > 4 && <span className="text-[8px] text-muted-foreground">+{wh.events.length - 4}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                      <span className="text-emerald-500">{wh.successCount} ✓</span>
                      <span className="text-red-500">{wh.failureCount} ✗</span>
                      {wh.lastDeliveryAt && <span className="text-muted-foreground ml-auto">{timeAgo(wh.lastDeliveryAt)}</span>}
                    </div>
                  </div>
                ))}
                {webhooks.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No webhooks yet.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Recent Deliveries</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto -mr-2 pr-2">
                {deliveries.map((d: any) => (
                  <div key={d.id} className="rounded border border-border/40 p-2">
                    <div className="flex items-center gap-2 text-[10px]">
                      <code className="font-mono text-[9px] bg-muted px-1 rounded">{d.eventType}</code>
                      {d.status === "success" ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-muted-foreground">{d.endpointName}</span>
                      {d.statusCode && <span className="text-muted-foreground">{d.statusCode}</span>}
                      <span className="ml-auto text-muted-foreground">{timeAgo(d.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {deliveries.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No deliveries yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === "keys" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">API Keys</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {apiKeys.map((k: any) => (
                <div key={k.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium">{k.name}</p>
                    <Badge variant="outline" className="text-[9px] text-emerald-500">{k.status}</Badge>
                    <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{k.keyPrefix}…</code>
                    <span className="ml-auto text-[9px] text-muted-foreground">{k.totalRequests.toLocaleString()} requests</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {k.scopes?.map((s: string) => (
                      <span key={s} className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[8px] font-mono">{s}</span>
                    ))}
                  </div>
                  {k.lastUsedAt && <p className="text-[9px] text-muted-foreground mt-1">Last used {timeAgo(k.lastUsedAt)}</p>}
                </div>
              ))}
              {apiKeys.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No API keys yet.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "sdk" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Official SDKs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sdkReleases.map((sdk: any) => {
                const color = SDK_COLOR[sdk.language] ?? "#6b7280";
                const icon = SDK_ICON[sdk.language] ?? "??";
                const label = SDK_LABEL[sdk.language] ?? sdk.language;
                return (
                  <div key={sdk.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold" style={{ backgroundColor: color + "20", color }}>
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{label}</p>
                        <code className="text-[9px] font-mono text-muted-foreground">v{sdk.version}</code>
                      </div>
                      {sdk.isLatest && <Badge variant="outline" className="text-[8px] text-emerald-500">Latest</Badge>}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1.5 truncate">{sdk.packageName}</p>
                    <div className="mt-2 rounded bg-muted/60 p-1.5 flex items-center gap-1.5">
                      <Terminal className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <code className="text-[9px] font-mono truncate flex-1">
                        {sdk.language === "javascript" ? "npm i @sentinel/sdk" :
                         sdk.language === "python" ? "pip install sentinel-africa" :
                         sdk.language === "go" ? "go get sentinel/sdk-go" :
                         sdk.language === "java" ? "mvn install com.sentinel:sdk" :
                         sdk.language === "php" ? "composer require sentinel/sdk" :
                         "gem install sentinel-sdk"}
                      </code>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px]">
                      <span className="text-muted-foreground">{sdk.downloadCount.toLocaleString()} downloads</span>
                      <a href={sdk.registryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                        Registry <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
              {sdkReleases.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground col-span-full">No SDK releases yet.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "integrations" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Third-Party Integrations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {integrations.map((integ: any) => {
                const color = CATEGORY_COLOR[integ.category] ?? "#6b7280";
                const Icon = CATEGORY_ICON[integ.category] ?? Plug;
                return (
                  <div key={integ.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", color }}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{integ.name}</p>
                        {integ.isOfficial && <Badge variant="outline" className="text-[8px] text-emerald-500">Official</Badge>}
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">{integ.description}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[9px]">
                      <Badge variant="outline" className="text-[8px] capitalize" style={{ color }}>{integ.category}</Badge>
                      <span className="text-muted-foreground">{integ.installCount} installs</span>
                    </div>
                    <a href={integ.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-0.5 text-[9px] text-primary hover:underline">
                      Docs <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                );
              })}
              {integrations.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground col-span-full">No integrations yet.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "graphql" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">GraphQL Schema</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">POST /api/v1/dev/graphql</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded border border-border/40 p-2 text-center">
                <p className="text-lg font-bold tabular-nums text-primary">{summary.graphqlTypes ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Types</p>
              </div>
              <div className="rounded border border-border/40 p-2 text-center">
                <p className="text-lg font-bold tabular-nums text-emerald-500">{summary.graphqlQueries ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Queries</p>
              </div>
              <div className="rounded border border-border/40 p-2 text-center">
                <p className="text-lg font-bold tabular-nums text-amber-500">{summary.graphqlMutations ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Mutations</p>
              </div>
            </div>
            <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Example Query</p>
            <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-3 overflow-x-auto">
              <pre className="text-[10px] font-mono text-slate-100 leading-relaxed">{`query {
  twinEntities(type: "mine", limit: 10) {
    nodes {
      id
      name
      type
      lat
      lng
    }
    totalCount
  }
  hotspots(type: "hotspot", limit: 5) {
    id
    locationName
    probability
    riskLevel
  }
  fraudAlerts(status: "detected", limit: 5) {
    id
    type
    severity
    confidence
  }
}`}</pre>
            </div>
            <p className="mt-3 mb-1.5 text-[10px] font-medium text-muted-foreground uppercase">Available Query Types</p>
            <div className="flex flex-wrap gap-1">
              {["health", "systemInfo", "twinEntities", "evidenceItems", "intelligenceEvents", "trustLeaderboard", "hotspots", "environmentalPredictions", "investigations", "inspections", "cases", "missions", "rewardPools", "fraudAlerts", "analyticsSummary"].map((q) => (
                <span key={q} className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-mono">{q}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === "docs" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Quick Start</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">1. Install SDK</p>
                  <div className="rounded bg-slate-900 dark:bg-slate-950 p-2 flex items-center gap-2">
                    <Terminal className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <code className="text-[10px] font-mono text-slate-100 flex-1">npm install @sentinel/sdk</code>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">2. Initialize</p>
                  <div className="rounded bg-slate-900 dark:bg-slate-950 p-2">
                    <pre className="text-[10px] font-mono text-slate-100">{`import { Sentinel } from '@sentinel/sdk';
const sentinel = new Sentinel({
  apiKey: 'sk_live_...'
});`}</pre>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">3. Query</p>
                  <div className="rounded bg-slate-900 dark:bg-slate-950 p-2">
                    <pre className="text-[10px] font-mono text-slate-100">{`const evidence = await sentinel
  .evidence.list({ limit: 10 });

const event = await sentinel.events
  .create({ title: 'Mining at Pra River',
    type: 'illegal_mining' });`}</pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Documentation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { title: "Authentication", desc: "API keys, scopes, Bearer token auth", icon: Lock },
                  { title: "Rate Limiting", desc: "100 req/min, 10K req/day, custom limits", icon: Activity },
                  { title: "Webhooks", desc: "19 event types, HMAC-SHA256 signing, retries", icon: Webhook },
                  { title: "GraphQL", desc: "15 queries, 6 mutations, flexible filtering", icon: GitBranch },
                  { title: "SDK", desc: "6 languages: JS, Python, Go, Java, PHP, Ruby", icon: Package },
                  { title: "Integrations", desc: "Slack, Teams, ArcGIS, Grafana, Zapier", icon: Plug },
                ].map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <a key={doc.title} href="/api/v1/dev/docs" className="flex items-center gap-2 rounded border border-border/40 p-2 hover:bg-accent/50 transition-colors">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{doc.title}</p>
                        <p className="text-[9px] text-muted-foreground">{doc.desc}</p>
                      </div>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DevKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

// Icons used in integration cards (imported at top but need local refs for map)
function MessageSquare({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
}
function Map({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
}
function BarChart3({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function Shield({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
