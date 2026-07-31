/**
 * Sentinel — Developer Platform Domain
 * =============================================================================
 * Exposes the Sentinel platform to third-party developers via:
 *   1. REST API       — versioned, documented, API-key authenticated
 *   2. GraphQL        — flexible query language for the Digital Twin
 *   3. Webhooks       — event-driven push notifications
 *   4. SDK            — official SDKs for JavaScript, Python, Go
 *   5. Documentation  — interactive API docs, tutorials, code examples
 *   6. Integrations   — third-party platform integrations (Slack, Teams, ArcGIS)
 * =============================================================================
 */

import { createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Webhook event types
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | "evidence.created"
  | "evidence.verified"
  | "evidence.disputed"
  | "alert.detected"
  | "alert.confirmed"
  | "alert.resolved"
  | "investigation.opened"
  | "investigation.closed"
  | "inspection.scheduled"
  | "inspection.completed"
  | "case.filed"
  | "case.closed"
  | "mission.created"
  | "mission.completed"
  | "reward.distributed"
  | "fraud.detected"
  | "hotspot.predicted"
  | "prediction.updated"
  | "simulation.completed";

export const WEBHOOK_EVENT_META: Record<
  WebhookEventType,
  { label: string; category: string; description: string }
> = {
  "evidence.created": { label: "Evidence Created", category: "Evidence", description: "New evidence item uploaded" },
  "evidence.verified": { label: "Evidence Verified", category: "Evidence", description: "Evidence item verified by inspector" },
  "evidence.disputed": { label: "Evidence Disputed", category: "Evidence", description: "Evidence item disputed by community" },
  "alert.detected": { label: "Alert Detected", category: "Fraud", description: "Fraud alert detected by AI" },
  "alert.confirmed": { label: "Alert Confirmed", category: "Fraud", description: "Fraud alert confirmed by investigator" },
  "alert.resolved": { label: "Alert Resolved", category: "Fraud", description: "Fraud alert resolved" },
  "investigation.opened": { label: "Investigation Opened", category: "Government", description: "New investigation opened" },
  "investigation.closed": { label: "Investigation Closed", category: "Government", description: "Investigation closed with resolution" },
  "inspection.scheduled": { label: "Inspection Scheduled", category: "Government", description: "Field inspection scheduled" },
  "inspection.completed": { label: "Inspection Completed", category: "Government", description: "Inspection completed with findings" },
  "case.filed": { label: "Case Filed", category: "Government", description: "Legal case filed" },
  "case.closed": { label: "Case Closed", category: "Government", description: "Case closed with resolution" },
  "mission.created": { label: "Mission Created", category: "Mission", description: "Evidence-gathering mission created" },
  "mission.completed": { label: "Mission Completed", category: "Mission", description: "Mission completed and verified" },
  "reward.distributed": { label: "Reward Distributed", category: "Reward", description: "Reward distributed from pool" },
  "fraud.detected": { label: "Fraud Detected", category: "Fraud", description: "Fraud detected by AI detector" },
  "hotspot.predicted": { label: "Hotspot Predicted", category: "Prediction", description: "New illegal mining hotspot predicted" },
  "prediction.updated": { label: "Prediction Updated", category: "Prediction", description: "Environmental prediction updated" },
  "simulation.completed": { label: "Simulation Completed", category: "Simulation", description: "Simulation scenario completed" },
};

// ---------------------------------------------------------------------------
// API key scopes
// ---------------------------------------------------------------------------

export type ApiScope =
  | "read:evidence"
  | "write:evidence"
  | "read:events"
  | "write:events"
  | "read:trust"
  | "read:hotspots"
  | "read:predictions"
  | "read:investigations"
  | "write:investigations"
  | "read:inspections"
  | "write:inspections"
  | "read:cases"
  | "write:cases"
  | "read:rewards"
  | "write:rewards"
  | "read:missions"
  | "write:missions"
  | "read:fraud"
  | "write:webhooks"
  | "read:webhooks"
  | "read:analytics"
  | "read:simulations"
  | "write:simulations"
  | "admin";

export const API_SCOPE_META: Record<ApiScope, { label: string; description: string; category: string }> = {
  "read:evidence": { label: "Read Evidence", description: "View evidence items", category: "Evidence" },
  "write:evidence": { label: "Write Evidence", description: "Upload new evidence", category: "Evidence" },
  "read:events": { label: "Read Events", description: "View intelligence events", category: "Intelligence" },
  "write:events": { label: "Write Events", description: "Create intelligence events", category: "Intelligence" },
  "read:trust": { label: "Read Trust", description: "View trust profiles and scores", category: "Trust" },
  "read:hotspots": { label: "Read Hotspots", description: "View hotspot predictions", category: "Prediction" },
  "read:predictions": { label: "Read Predictions", description: "View environmental predictions", category: "Prediction" },
  "read:investigations": { label: "Read Investigations", description: "View government investigations", category: "Government" },
  "write:investigations": { label: "Write Investigations", description: "Create/update investigations", category: "Government" },
  "read:inspections": { label: "Read Inspections", description: "View field inspections", category: "Government" },
  "write:inspections": { label: "Write Inspections", description: "Create/update inspections", category: "Government" },
  "read:cases": { label: "Read Cases", description: "View legal cases", category: "Government" },
  "write:cases": { label: "Write Cases", description: "Create/update cases", category: "Government" },
  "read:rewards": { label: "Read Rewards", description: "View reward pools and distributions", category: "Rewards" },
  "write:rewards": { label: "Write Rewards", description: "Contribute to reward pools", category: "Rewards" },
  "read:missions": { label: "Read Missions", description: "View evidence-gathering missions", category: "Missions" },
  "write:missions": { label: "Write Missions", description: "Accept/submit missions", category: "Missions" },
  "read:fraud": { label: "Read Fraud", description: "View fraud alerts", category: "Fraud" },
  "write:webhooks": { label: "Write Webhooks", description: "Create/manage webhooks", category: "Developer" },
  "read:webhooks": { label: "Read Webhooks", description: "View webhook endpoints", category: "Developer" },
  "read:analytics": { label: "Read Analytics", description: "View analytics KPIs", category: "Analytics" },
  "read:simulations": { label: "Read Simulations", description: "View simulation scenarios", category: "Simulation" },
  "write:simulations": { label: "Write Simulations", description: "Run new simulations", category: "Simulation" },
  admin: { label: "Admin", description: "Full admin access (all scopes)", category: "Admin" },
};

// ---------------------------------------------------------------------------
// SDK languages
// ---------------------------------------------------------------------------

export type SdkLanguage = "javascript" | "python" | "go" | "java" | "php" | "ruby";

export const SDK_LANGUAGE_META: Record<SdkLanguage, {
  label: string;
  color: string;
  icon: string;
  registry: string;
  installCmd: string;
  packageName: string;
}> = {
  javascript: { label: "JavaScript / TypeScript", color: "#f7df1e", icon: "JS", registry: "npm", installCmd: "npm install @sentinel/sdk", packageName: "@sentinel/sdk" },
  python: { label: "Python", color: "#3776ab", icon: "PY", registry: "PyPI", installCmd: "pip install sentinel-africa", packageName: "sentinel-africa" },
  go: { label: "Go", color: "#00add8", icon: "GO", registry: "Go modules", installCmd: "go get github.com/sentinel-africa/sdk-go", packageName: "github.com/sentinel-africa/sdk-go" },
  java: { label: "Java", color: "#ed8b00", icon: "JV", registry: "Maven Central", installCmd: "mvn install com.sentinel:sdk:1.0.0", packageName: "com.sentinel:sdk" },
  php: { label: "PHP", color: "#777bb4", icon: "PHP", registry: "Packagist", installCmd: "composer require sentinel/sdk", packageName: "sentinel/sdk" },
  ruby: { label: "Ruby", color: "#cc342d", icon: "RB", registry: "RubyGems", installCmd: "gem install sentinel-sdk", packageName: "sentinel-sdk" },
};

// ---------------------------------------------------------------------------
// Integration categories & platforms
// ---------------------------------------------------------------------------

export type IntegrationCategory = "messaging" | "gis" | "monitoring" | "data" | "automation" | "security";

export const INTEGRATION_CATEGORY_META: Record<IntegrationCategory, { label: string; color: string; description: string }> = {
  messaging: { label: "Messaging", color: "#0ea5e9", description: "Send alerts to chat platforms (Slack, Teams, Discord)" },
  gis: { label: "GIS & Mapping", color: "#22c55e", description: "Integrate with GIS platforms (ArcGIS, QGIS, Google Maps)" },
  monitoring: { label: "Monitoring", color: "#f59e0b", description: "Connect to monitoring dashboards (Grafana, Datadog)" },
  data: { label: "Data & BI", color: "#a855f7", description: "Export data to BI tools (Power BI, Tableau, Looker)" },
  automation: { label: "Automation", color: "#14b8a6", description: "Automate workflows (Zapier, n8n, IFTTT)" },
  security: { label: "Security", color: "#ef4444", description: "Security integrations (SIEM, SOAR, audit)" },
};

// ---------------------------------------------------------------------------
// REST API directory — the full endpoint catalog
// ---------------------------------------------------------------------------

export interface ApiEndpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  scope?: ApiScope;
  category: string;
  version: string;
}

export const REST_API_DIRECTORY: ApiEndpoint[] = [
  // Platform
  { method: "GET", path: "/api/v1/health", description: "Liveness probe", auth: false, category: "Platform", version: "v1" },
  { method: "GET", path: "/api/v1/readiness", description: "Readiness check (all subsystems)", auth: false, category: "Platform", version: "v1" },
  { method: "GET", path: "/api/v1/system", description: "Architecture overview", auth: false, category: "Platform", version: "v1" },
  { method: "GET", path: "/api/v1/info", description: "API versioning directory", auth: false, category: "Platform", version: "v1" },
  // Identity
  { method: "GET", path: "/api/v1/identity-summary", description: "Identity platform metrics", auth: false, category: "Identity", version: "v1" },
  { method: "GET", path: "/api/v1/organizations", description: "List organizations", auth: true, scope: "read:trust", category: "Identity", version: "v1" },
  { method: "GET", path: "/api/v1/devices", description: "List devices", auth: true, scope: "read:trust", category: "Identity", version: "v1" },
  { method: "GET", path: "/api/v1/trust", description: "Trust leaderboard", auth: true, scope: "read:trust", category: "Identity", version: "v1" },
  // Evidence
  { method: "GET", path: "/api/v1/evidence/summary", description: "Evidence platform summary", auth: false, category: "Evidence", version: "v1" },
  { method: "GET", path: "/api/v1/evidence", description: "List evidence items", auth: true, scope: "read:evidence", category: "Evidence", version: "v1" },
  { method: "POST", path: "/api/v1/evidence", description: "Upload new evidence", auth: true, scope: "write:evidence", category: "Evidence", version: "v1" },
  { method: "GET", path: "/api/v1/evidence/{id}", description: "Get evidence by ID", auth: true, scope: "read:evidence", category: "Evidence", version: "v1" },
  // Intelligence
  { method: "GET", path: "/api/v1/intelligence/summary", description: "Intelligence events summary", auth: false, category: "Intelligence", version: "v1" },
  { method: "GET", path: "/api/v1/intelligence/events", description: "List intelligence events", auth: true, scope: "read:events", category: "Intelligence", version: "v1" },
  { method: "POST", path: "/api/v1/intelligence/events", description: "Create intelligence event", auth: true, scope: "write:events", category: "Intelligence", version: "v1" },
  // Corroboration
  { method: "GET", path: "/api/v1/corroboration/summary", description: "Corroboration summary", auth: false, category: "Corroboration", version: "v1" },
  { method: "POST", path: "/api/v1/corroboration", description: "Add corroboration (support/dispute)", auth: true, scope: "read:events", category: "Corroboration", version: "v1" },
  // Trust
  { method: "GET", path: "/api/v1/trust/summary", description: "Civil trust summary", auth: false, category: "Trust", version: "v1" },
  // Notifications
  { method: "GET", path: "/api/v1/notifications/summary", description: "Notification summary", auth: false, category: "Notifications", version: "v1" },
  // Satellite
  { method: "GET", path: "/api/v1/satellite/summary", description: "Satellite ingestion summary", auth: false, category: "Satellite", version: "v1" },
  { method: "GET", path: "/api/v1/satellite/scenes", description: "List satellite scenes", auth: true, scope: "read:events", category: "Satellite", version: "v1" },
  // Computer Vision
  { method: "GET", path: "/api/v1/cv/summary", description: "CV detection summary", auth: false, category: "Computer Vision", version: "v1" },
  { method: "POST", path: "/api/v1/cv/detect", description: "Run CV detection on image", auth: true, scope: "write:evidence", category: "Computer Vision", version: "v1" },
  // AI Observations
  { method: "GET", path: "/api/v1/observations/summary", description: "AI observations summary", auth: false, category: "AI Observations", version: "v1" },
  // Fusion
  { method: "GET", path: "/api/v1/fusion/summary", description: "Evidence fusion summary", auth: false, category: "Fusion", version: "v1" },
  // Predictions
  { method: "GET", path: "/api/v1/predictions/summary", description: "Environmental predictions summary", auth: false, category: "Predictions", version: "v1" },
  { method: "GET", path: "/api/v1/predictions", description: "List predictions", auth: true, scope: "read:predictions", category: "Predictions", version: "v1" },
  // Hotspots
  { method: "GET", path: "/api/v1/hotspots/summary", description: "Hotspot predictions summary", auth: false, category: "Hotspots", version: "v1" },
  { method: "GET", path: "/api/v1/hotspots", description: "List hotspot predictions", auth: true, scope: "read:hotspots", category: "Hotspots", version: "v1" },
  // Copilot
  { method: "POST", path: "/api/v1/copilot/query", description: "Ask the AI Copilot a question", auth: true, scope: "read:events", category: "Copilot", version: "v1" },
  // Missions
  { method: "GET", path: "/api/v1/missions/summary", description: "Mission system summary", auth: false, category: "Missions", version: "v1" },
  { method: "GET", path: "/api/v1/missions", description: "List missions", auth: true, scope: "read:missions", category: "Missions", version: "v1" },
  { method: "POST", path: "/api/v1/missions/{id}/accept", description: "Accept a mission", auth: true, scope: "write:missions", category: "Missions", version: "v1" },
  { method: "POST", path: "/api/v1/missions/{id}/submit", description: "Submit mission evidence", auth: true, scope: "write:missions", category: "Missions", version: "v1" },
  // Rewards
  { method: "GET", path: "/api/v1/rewards/summary", description: "Reward engine summary", auth: false, category: "Rewards", version: "v1" },
  { method: "GET", path: "/api/v1/rewards/pools", description: "List reward pools", auth: true, scope: "read:rewards", category: "Rewards", version: "v1" },
  { method: "POST", path: "/api/v1/rewards/contribute", description: "Contribute to a reward pool", auth: true, scope: "write:rewards", category: "Rewards", version: "v1" },
  // Fraud
  { method: "GET", path: "/api/v1/fraud/summary", description: "Fraud detection summary", auth: false, category: "Fraud", version: "v1" },
  { method: "GET", path: "/api/v1/fraud/alerts", description: "List fraud alerts", auth: true, scope: "read:fraud", category: "Fraud", version: "v1" },
  { method: "POST", path: "/api/v1/fraud/scan", description: "Trigger fraud scan", auth: true, scope: "admin", category: "Fraud", version: "v1" },
  // Government
  { method: "GET", path: "/api/v1/government/summary", description: "Government operations summary", auth: false, category: "Government", version: "v1" },
  { method: "GET", path: "/api/v1/government/dashboard", description: "Government dashboard (national/regional/district)", auth: false, category: "Government", version: "v1" },
  { method: "GET", path: "/api/v1/government/investigations", description: "List investigations", auth: true, scope: "read:investigations", category: "Government", version: "v1" },
  { method: "GET", path: "/api/v1/government/inspections", description: "List inspections", auth: true, scope: "read:inspections", category: "Government", version: "v1" },
  { method: "GET", path: "/api/v1/government/cases", description: "List cases", auth: true, scope: "read:cases", category: "Government", version: "v1" },
  // Simulation
  { method: "GET", path: "/api/v1/simulations/summary", description: "Simulation engine summary", auth: false, category: "Simulation", version: "v1" },
  { method: "POST", path: "/api/v1/simulations/run", description: "Run a simulation scenario", auth: true, scope: "write:simulations", category: "Simulation", version: "v1" },
  // Analytics
  { method: "GET", path: "/api/v1/analytics/summary", description: "Analytics summary", auth: false, category: "Analytics", version: "v1" },
  { method: "GET", path: "/api/v1/analytics/dashboard", description: "Full analytics dashboard", auth: false, category: "Analytics", version: "v1" },
  // Developer
  { method: "GET", path: "/api/v1/dev/summary", description: "Developer platform summary", auth: false, category: "Developer", version: "v1" },
  { method: "GET", path: "/api/v1/dev/webhooks", description: "List webhook endpoints", auth: true, scope: "read:webhooks", category: "Developer", version: "v1" },
  { method: "POST", path: "/api/v1/dev/webhooks", description: "Create webhook endpoint", auth: true, scope: "write:webhooks", category: "Developer", version: "v1" },
  { method: "GET", path: "/api/v1/dev/api-keys", description: "List API keys", auth: true, scope: "admin", category: "Developer", version: "v1" },
  { method: "POST", path: "/api/v1/dev/api-keys", description: "Create API key", auth: true, scope: "admin", category: "Developer", version: "v1" },
  { method: "GET", path: "/api/v1/dev/sdk", description: "List SDK releases", auth: false, category: "Developer", version: "v1" },
  { method: "GET", path: "/api/v1/dev/integrations", description: "List third-party integrations", auth: false, category: "Developer", version: "v1" },
  { method: "GET", path: "/api/v1/dev/docs", description: "API documentation", auth: false, category: "Developer", version: "v1" },
  { method: "POST", path: "/api/v1/dev/graphql", description: "GraphQL endpoint", auth: true, scope: "read:events", category: "Developer", version: "v1" },
];

// ---------------------------------------------------------------------------
// GraphQL schema definition (SDL)
// ---------------------------------------------------------------------------

export const GRAPHQL_SCHEMA_SDL = `# Sentinel — GraphQL Schema
# =============================================================================
# Flexible query language for the Sentinel Digital Twin. Query mines, rivers,
# forests, evidence, events, investigations, cases, predictions, and more.
# =============================================================================

type Query {
  # Platform
  health: HealthStatus!
  systemInfo: SystemInfo!

  # Digital Twin (M4)
  twinEntity(id: ID!): TwinEntity
  twinEntities(type: String, limit: Int = 20, offset: Int = 0): TwinEntityConnection!

  # Evidence (M7)
  evidence(id: ID!): Evidence
  evidenceItems(type: String, verified: Boolean, limit: Int = 20, offset: Int = 0): EvidenceConnection!

  # Intelligence Events (M8)
  intelligenceEvent(id: ID!): IntelligenceEvent
  intelligenceEvents(type: String, status: String, limit: Int = 20, offset: Int = 0): IntelligenceEventConnection!

  # Trust (M10)
  trustProfile(userId: ID!): TrustProfile
  trustLeaderboard(limit: Int = 10): [TrustProfile!]!

  # Hotspots (M17)
  hotspot(id: ID!): HotspotPrediction
  hotspots(type: String, riskLevel: String, limit: Int = 20): [HotspotPrediction!]!

  # Environmental Predictions (M16)
  environmentalPredictions(type: String, riskLevel: String, limit: Int = 20): [EnvironmentalPrediction!]!

  # Government (M22)
  investigations(status: String, region: String, limit: Int = 20): [Investigation!]!
  inspections(status: String, region: String, limit: Int = 20): [Inspection!]!
  cases(status: String, region: String, limit: Int = 20): [Case!]!

  # Missions (M19)
  missions(status: String, limit: Int = 20): [Mission!]!

  # Rewards (M20)
  rewardPools(status: String, limit: Int = 20): [RewardPool!]!

  # Fraud (M21)
  fraudAlerts(type: String, status: String, limit: Int = 20): [FraudAlert!]!

  # Analytics (M24)
  analyticsSummary: AnalyticsSummary!
  analyticsCategory(category: String!): AnalyticsCategory
}

type Mutation {
  # Evidence (M7)
  createEvidence(input: CreateEvidenceInput!): Evidence!

  # Intelligence (M8)
  createIntelligenceEvent(input: CreateEventInput!): IntelligenceEvent!

  # Missions (M19)
  acceptMission(missionId: ID!): Mission!
  submitMission(missionId: ID!, evidenceIds: [ID!]!): Mission!

  # Rewards (M20)
  contributeToPool(poolId: ID!, amount: Float!): RewardContribution!

  # Simulation (M23)
  runSimulation(input: SimulationInput!): SimulationScenario!

  # Developer (M25)
  createWebhook(input: CreateWebhookInput!): WebhookEndpoint!
  createApiKey(input: CreateApiKeyInput!): ApiKey!
}

# --- Types ---

type HealthStatus {
  status: String!
  uptime: Float
  checks: [HealthCheck!]!
}

type HealthCheck {
  name: String!
  status: String!
  latency: Int
}

type SystemInfo {
  version: String!
  apiVersion: String!
  environment: String!
}

type TwinEntity {
  id: ID!
  key: String!
  name: String!
  type: String!
  lat: Float
  lng: Float
  status: String
  metadata: JSON
  createdAt: DateTime!
}

type TwinEntityConnection {
  nodes: [TwinEntity!]!
  totalCount: Int!
}

type Evidence {
  id: ID!
  key: String!
  title: String!
  type: String!
  checksum: String!
  verified: Boolean!
  lat: Float
  lng: Float
  createdAt: DateTime!
}

type EvidenceConnection {
  nodes: [Evidence!]!
  totalCount: Int!
}

type IntelligenceEvent {
  id: ID!
  key: String!
  title: String!
  type: String!
  status: String!
  severity: String!
  lat: Float
  lng: Float
  createdAt: DateTime!
}

type IntelligenceEventConnection {
  nodes: [IntelligenceEvent!]!
  totalCount: Int!
}

type TrustProfile {
  userId: ID!
  score: Float!
  tier: String!
  accuracy: Float!
  reliability: Float!
  totalReports: Int!
}

type HotspotPrediction {
  id: ID!
  type: String!
  locationName: String
  probability: Float!
  riskLevel: String!
  expansionDirection: String
  expansionRadiusKm: Float
}

type EnvironmentalPrediction {
  id: ID!
  type: String!
  targetName: String!
  riskScore: Float!
  riskLevel: String!
  timeframe: String!
}

type Investigation {
  id: ID!
  key: String!
  title: String!
  type: String!
  status: String!
  priority: String!
  region: String
  agencyName: String
}

type Inspection {
  id: ID!
  key: String!
  title: String!
  status: String!
  targetName: String!
  complianceLevel: String
  violationCount: Int!
}

type Case {
  id: ID!
  caseNumber: String!
  title: String!
  type: String!
  status: String!
  priority: String!
  estimatedDamagesGHS: Float!
}

type Mission {
  id: ID!
  key: String!
  title: String!
  type: String!
  status: String!
  priority: String!
  baseReward: Int!
}

type RewardPool {
  id: ID!
  name: String!
  type: String!
  totalFunds: Float!
  availableFunds: Float!
  distributedFunds: Float!
}

type FraudAlert {
  id: ID!
  key: String!
  type: String!
  severity: String!
  status: String!
  title: String!
  confidence: Float!
  riskScore: Float!
}

type AnalyticsSummary {
  totalCategories: Int!
  totalKpis: Int!
  totalGood: Int!
  totalWarning: Int!
  totalCritical: Int!
  healthScore: Int!
}

type AnalyticsCategory {
  category: String!
  label: String!
  kpiCount: Int!
  healthScore: Int!
}

type WebhookEndpoint {
  id: ID!
  key: String!
  name: String!
  url: String!
  events: [String!]!
  isActive: Boolean!
}

type ApiKey {
  id: ID!
  keyPrefix: String!
  name: String!
  scopes: [String!]!
  status: String!
}

# --- Inputs ---

input CreateEvidenceInput {
  title: String!
  type: String!
  storageKey: String!
  checksum: String!
  lat: Float
  lng: Float
}

input CreateEventInput {
  title: String!
  type: String!
  severity: String
  lat: Float
  lng: Float
  description: String
}

input SimulationInput {
  name: String!
  interventionType: String!
  timeHorizonMonths: Int!
  region: String
}

input CreateWebhookInput {
  name: String!
  url: String!
  events: [String!]!
}

input CreateApiKeyInput {
  name: String!
  scopes: [String!]!
}

# --- Scalars ---

scalar DateTime
scalar JSON
`;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Generate a new API key with the sk_live_ prefix.
 */
export function generateApiKey(env: "live" | "test" = "live"): { key: string; keyPrefix: string } {
  const prefix = env === "live" ? "sk_live_" : "sk_test_";
  const random = randomBytes(24).toString("hex");
  const key = `${prefix}${random}`;
  const keyPrefix = key.slice(0, 16);
  return { key, keyPrefix };
}

/**
 * Generate a webhook signing secret.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a webhook key (human-readable identifier).
 */
export function generateWebhookKey(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
  const random = randomBytes(4).toString("hex");
  return `wh-${slug}-${random}`;
}

/**
 * Compute HMAC signature for webhook payload.
 */
export function computeWebhookSignature(secret: string, payload: string): string {
  return createHash("sha256").update(secret + payload).digest("hex");
}

/**
 * Mask an API key for display (show only prefix + last 4 chars).
 */
export function maskApiKey(key: string): string {
  if (key.length <= 20) return key.slice(0, 8) + "…";
  return key.slice(0, 12) + "…" + key.slice(-4);
}
