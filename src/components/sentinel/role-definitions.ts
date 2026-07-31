/**
 * Sentinel — Role-based navigation definitions
 * ----------------------------------------------------------------------------
 * Each role has access to ALL features relevant to their role. No placeholders.
 */

import {
  Home, PlusCircle, Map as MapIcon, Radio, FileText, Target, Award,
  MessageSquare, LayoutDashboard, ShieldCheck, FolderSearch, Gavel,
  Landmark, BarChart3, FlaskConical, AlertTriangle, Sparkles,
  ShieldAlert, Gauge, Code2, ClipboardCheck, Shield, Settings,
  Bell, Eye, Satellite, Brain, Layers, TrendingUp, Crosshair,
  Scale, Network, Clock, Box, Users, type LucideIcon,
} from "lucide-react";

export type RoleKey = "citizen" | "inspector" | "official" | "admin";
export type BadgeTone = "default" | "success" | "warning" | "destructive" | "outline";

export interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tabId?: string;
  group: string;
  badge?: string;
  badgeTone?: BadgeTone;
  shortcut?: string;
}

export interface NavGroup {
  label: string;
  hint?: string;
  items: NavItem[];
}

export interface RoleConfig {
  id: RoleKey;
  label: string;
  shortLabel: string;
  description: string;
  tagline: string;
  icon: LucideIcon;
  accent: RoleAccent;
  defaultTabId?: string;
  groups: NavGroup[];
}

export type RoleAccent = "emerald" | "sky" | "violet" | "amber";

// Tab order — MUST match children in AppShell
export const TAB_ORDER = [
  "production", "performance", "security", "developer", "analytics",
  "simulation", "government", "fraud", "rewards", "missions",
  "copilot", "autonomous", "hotspots", "predictions", "fusion",
  "observations", "cv", "satellite", "notifications", "trust",
  "corroboration", "intel", "evidence", "kg", "temporal", "twin",
  "geo", "identity", "foundation",
] as const;

export type TabId = (typeof TAB_ORDER)[number];
export const TAB_INDEX: Record<string, number> = Object.fromEntries(TAB_ORDER.map((id, i) => [id, i]));

export interface QuickAction {
  id: string; label: string; description: string; icon: LucideIcon; shortcut?: string;
  kind: "toggle-sidebar" | "toggle-theme" | "open-notifications" | "open-help" | "open-api-docs";
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-toggle-sidebar", label: "Toggle sidebar", description: "Collapse or expand the navigation sidebar", icon: LayoutDashboard, shortcut: "⌘B", kind: "toggle-sidebar" },
  { id: "qa-toggle-theme", label: "Toggle theme", description: "Switch between light and dark appearance", icon: Settings, shortcut: "⌘D", kind: "toggle-theme" },
  { id: "qa-notifications", label: "Open notifications", description: "View your latest alerts and updates", icon: Bell, shortcut: "⌘\\", kind: "open-notifications" },
  { id: "qa-help", label: "Help & Support", description: "Documentation, keyboard shortcuts, and contact", icon: ShieldCheck, shortcut: "?", kind: "open-help" },
  { id: "qa-api-docs", label: "View API documentation", description: "Open the REST + GraphQL developer reference", icon: Code2, kind: "open-api-docs" },
];

// ---------------------------------------------------------------------------
// CITIZEN REPORTER — Full access to reporting, community, evidence, rewards, AI
// ---------------------------------------------------------------------------
function buildCitizenGroups(): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { id: "citizen-overview", label: "Overview", description: "Your activity, missions, and rewards at a glance", icon: Home, group: "Overview", tabId: "analytics" },
        { id: "citizen-report", label: "Report Event", description: "Quickly report an incident you witnessed", icon: PlusCircle, group: "Overview", badge: "Quick", badgeTone: "success", tabId: "intel" },
      ],
    },
    {
      label: "Discover",
      items: [
        { id: "citizen-map", label: "Map", description: "Geospatial intelligence with real-time incidents", icon: MapIcon, group: "Discover", tabId: "geo" },
        { id: "citizen-feed", label: "Community Feed", description: "Live community intelligence stream", icon: Radio, group: "Discover", tabId: "intel" },
        { id: "citizen-hotspots", label: "Hotspots", description: "Illegal mining hotspot predictions near you", icon: Crosshair, group: "Discover", tabId: "hotspots" },
        { id: "citizen-predictions", label: "Environmental Threats", description: "Environmental risk predictions for your area", icon: TrendingUp, group: "Discover", tabId: "predictions" },
      ],
    },
    {
      label: "Contribute",
      items: [
        { id: "citizen-evidence", label: "My Evidence", description: "Evidence you've submitted — hashed and tamper-proof", icon: FileText, group: "Contribute", tabId: "evidence" },
        { id: "citizen-corroboration", label: "Corroboration", description: "Support or dispute evidence from other citizens", icon: Scale, group: "Contribute", tabId: "corroboration" },
        { id: "citizen-missions", label: "Missions", description: "AI-dispatched missions near you", icon: Target, group: "Contribute", tabId: "missions" },
        { id: "citizen-rewards", label: "Rewards", description: "Your earned contributions and payouts", icon: Award, group: "Contribute", tabId: "rewards" },
      ],
    },
    {
      label: "My Account",
      items: [
        { id: "citizen-trust", label: "My Trust Score", description: "Your civil trust tier and reputation", icon: Shield, group: "My Account", tabId: "trust" },
        { id: "citizen-notifications", label: "Notifications", description: "Your alerts and updates", icon: Bell, group: "My Account", tabId: "notifications" },
        { id: "citizen-identity", label: "My Profile", description: "Identity verification and devices", icon: Users, group: "My Account", tabId: "identity" },
      ],
    },
    {
      label: "Assistant",
      items: [
        { id: "citizen-copilot", label: "AI Copilot", description: "Ask the digital twin about incidents near you", icon: MessageSquare, group: "Assistant", tabId: "copilot", shortcut: "⌘J" },
        { id: "citizen-autonomous", label: "AI Investigations", description: "Autonomous AI investigations triggered by your reports", icon: Sparkles, group: "Assistant", tabId: "autonomous" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// FIELD INSPECTOR — Inspections, investigations, evidence, cases
// ---------------------------------------------------------------------------
function buildInspectorGroups(): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { id: "insp-dashboard", label: "Dashboard", description: "Government operations overview", icon: LayoutDashboard, group: "Overview", tabId: "government" },
        { id: "insp-map", label: "Map", description: "Geospatial intelligence with inspection sites", icon: MapIcon, group: "Overview", tabId: "geo" },
      ],
    },
    {
      label: "Field Work",
      items: [
        { id: "insp-inspections", label: "My Inspections", description: "Scheduled and completed field inspections", icon: ShieldCheck, group: "Field Work", tabId: "government" },
        { id: "insp-investigations", label: "Investigations", description: "Active investigations you're assigned to", icon: FileText, group: "Field Work", tabId: "government" },
        { id: "insp-cases", label: "Cases", description: "Legal cases you're involved in", icon: Gavel, group: "Field Work", tabId: "government" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { id: "insp-evidence", label: "Evidence Queue", description: "Evidence awaiting your review", icon: FolderSearch, group: "Intelligence", tabId: "evidence", badge: "12", badgeTone: "warning" },
        { id: "insp-corroboration", label: "Corroboration", description: "Evidence support and dispute review", icon: Scale, group: "Intelligence", tabId: "corroboration" },
        { id: "insp-fraud", label: "Fraud Detection", description: "Detected fraud alerts requiring review", icon: AlertTriangle, group: "Intelligence", tabId: "fraud", badge: "3", badgeTone: "destructive" },
        { id: "insp-autonomous", label: "AI Investigations", description: "Autonomous AI investigations", icon: Sparkles, group: "Intelligence", tabId: "autonomous" },
      ],
    },
    {
      label: "Analysis",
      items: [
        { id: "insp-hotspots", label: "Hotspots", description: "Illegal mining hotspot predictions", icon: Crosshair, group: "Analysis", tabId: "hotspots" },
        { id: "insp-predictions", label: "Environmental Threats", description: "Environmental risk predictions", icon: TrendingUp, group: "Analysis", tabId: "predictions" },
        { id: "insp-observations", label: "AI Observations", description: "AI-generated intelligence observations", icon: Brain, group: "Analysis", tabId: "observations" },
        { id: "insp-fusion", label: "Evidence Fusion", description: "Fused confidence scores from all sources", icon: Layers, group: "Analysis", tabId: "fusion" },
      ],
    },
    {
      label: "Assistant",
      items: [
        { id: "insp-copilot", label: "AI Copilot", description: "Ask about investigations, evidence, or cases", icon: MessageSquare, group: "Assistant", tabId: "copilot", shortcut: "⌘J" },
        { id: "insp-notifications", label: "Notifications", description: "Your alerts and assignments", icon: Bell, group: "Assistant", tabId: "notifications" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// GOVERNMENT OFFICIAL — Full operations, analytics, simulation, fraud
// ---------------------------------------------------------------------------
function buildOfficialGroups(): NavGroup[] {
  return [
    {
      label: "National",
      items: [
        { id: "off-national", label: "National Dashboard", description: "Country-wide operations overview", icon: Landmark, group: "National", tabId: "government" },
        { id: "off-analytics", label: "Analytics", description: "Platform-wide KPIs and metrics", icon: BarChart3, group: "National", tabId: "analytics" },
      ],
    },
    {
      label: "Operations",
      items: [
        { id: "off-investigations", label: "Investigations", description: "All investigations across all regions", icon: FileText, group: "Operations", tabId: "government" },
        { id: "off-inspections", label: "Inspections", description: "Field inspection management", icon: ShieldCheck, group: "Operations", tabId: "government" },
        { id: "off-cases", label: "Cases", description: "Legal and administrative case management", icon: Gavel, group: "Operations", tabId: "government" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { id: "off-simulation", label: "Simulation", description: "What-if scenario modeling for policy decisions", icon: FlaskConical, group: "Intelligence", tabId: "simulation" },
        { id: "off-fraud", label: "Fraud Detection", description: "AI-powered fraud detection across the platform", icon: AlertTriangle, group: "Intelligence", tabId: "fraud", badge: "3", badgeTone: "destructive" },
        { id: "off-autonomous", label: "Auto-Investigator", description: "Autonomous AI environmental investigations", icon: Sparkles, group: "Intelligence", tabId: "autonomous" },
      ],
    },
    {
      label: "Environment",
      items: [
        { id: "off-hotspots", label: "Hotspots", description: "Illegal mining hotspot predictions", icon: Crosshair, group: "Environment", tabId: "hotspots" },
        { id: "off-predictions", label: "Environmental Threats", description: "Environmental risk predictions", icon: TrendingUp, group: "Environment", tabId: "predictions" },
        { id: "off-satellite", label: "Satellite", description: "Satellite imagery and change detection", icon: Satellite, group: "Environment", tabId: "satellite" },
        { id: "off-cv", label: "Computer Vision", description: "AI-powered imagery analysis", icon: Eye, group: "Environment", tabId: "cv" },
      ],
    },
    {
      label: "Assistant",
      items: [
        { id: "off-copilot", label: "AI Copilot", description: "Natural language interface to the Digital Twin", icon: MessageSquare, group: "Assistant", tabId: "copilot", shortcut: "⌘J" },
        { id: "off-notifications", label: "Notifications", description: "Critical alerts and updates", icon: Bell, group: "Assistant", tabId: "notifications" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// PLATFORM ADMIN — Everything officials have + security, performance, dev, production
// ---------------------------------------------------------------------------
function buildAdminGroups(): NavGroup[] {
  return [
    ...buildOfficialGroups(),
    {
      label: "Platform",
      hint: "Internal subsystems",
      items: [
        { id: "admin-security", label: "Security", description: "Zero Trust posture, threats, pen tests, backups", icon: ShieldAlert, group: "Platform", tabId: "security" },
        { id: "admin-performance", label: "Performance", description: "Scaling, caching, load tests, optimization", icon: Gauge, group: "Platform", tabId: "performance" },
        { id: "admin-developer", label: "Developer", description: "REST + GraphQL API, webhooks, SDK, integrations", icon: Code2, group: "Platform", tabId: "developer" },
        { id: "admin-production", label: "Production", description: "Readiness, incidents, runbooks, deployments", icon: ClipboardCheck, group: "Platform", tabId: "production" },
      ],
    },
    {
      label: "System",
      items: [
        { id: "admin-trust", label: "Civil Trust", description: "8-factor trust engine and decay model", icon: Shield, group: "System", tabId: "trust" },
        { id: "admin-identity", label: "Identity", description: "Users, organizations, devices, verifications", icon: Users, group: "System", tabId: "identity" },
        { id: "admin-foundation", label: "Platform Foundation", description: "Architecture, RBAC, audit, feature flags", icon: ShieldCheck, group: "System", tabId: "foundation" },
      ],
    },
  ];
}

export const ROLES: Record<RoleKey, RoleConfig> = {
  citizen: {
    id: "citizen", label: "Citizen Reporter", shortLabel: "Citizen",
    description: "Community member who reports incidents and earns rewards.",
    tagline: "Report · Verify · Earn", icon: Home, accent: "emerald",
    defaultTabId: "analytics", groups: buildCitizenGroups(),
  },
  inspector: {
    id: "inspector", label: "Field Inspector", shortLabel: "Inspector",
    description: "Government field operative conducting inspections.",
    tagline: "Inspect · Investigate · Resolve", icon: ShieldCheck, accent: "sky",
    defaultTabId: "government", groups: buildInspectorGroups(),
  },
  official: {
    id: "official", label: "Government Official", shortLabel: "Official",
    description: "National analyst running operations and policy.",
    tagline: "Analyze · Decide · Govern", icon: Landmark, accent: "violet",
    defaultTabId: "government", groups: buildOfficialGroups(),
  },
  admin: {
    id: "admin", label: "Platform Admin", shortLabel: "Admin",
    description: "Full platform access including security, performance, and dev.",
    tagline: "Operate · Harden · Ship", icon: ShieldAlert, accent: "amber",
    defaultTabId: "production", groups: buildAdminGroups(),
  },
};

export const DEFAULT_ROLE: RoleKey = "citizen";
export const ROLE_ORDER: RoleKey[] = ["citizen", "inspector", "official", "admin"];

export function getRoleConfig(role: RoleKey): RoleConfig {
  return ROLES[role] ?? ROLES[DEFAULT_ROLE];
}

export function getFlattenedNavItems(role: RoleKey): NavItem[] {
  return getRoleConfig(role).groups.flatMap((g) => g.items);
}

export function findNavItem(role: RoleKey, itemId: string): NavItem | undefined {
  return getFlattenedNavItems(role).find((i) => i.id === itemId);
}

export function resolveChildIndex(tabId: string | undefined): number | null {
  if (!tabId) return null;
  const idx = TAB_INDEX[tabId];
  return typeof idx === "number" ? idx : null;
}

export function pickDefaultNavItem(role: RoleKey): NavItem {
  const cfg = getRoleConfig(role);
  const items = getFlattenedNavItems(role);
  if (cfg.defaultTabId) {
    const match = items.find((i) => i.tabId === cfg.defaultTabId);
    if (match) return match;
  }
  return items[0] ?? { id: "fallback", label: cfg.label, description: cfg.description, icon: cfg.icon, group: "Overview" };
}

export const ROLE_ACCENT_CLASSES: Record<RoleAccent, { bg: string; text: string; ring: string; border: string; gradient: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20", border: "border-emerald-500/30", gradient: "from-emerald-500 to-teal-600" },
  sky: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", ring: "ring-sky-500/20", border: "border-sky-500/30", gradient: "from-sky-500 to-blue-600" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20", border: "border-violet-500/30", gradient: "from-violet-500 to-purple-600" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20", border: "border-amber-500/30", gradient: "from-amber-500 to-orange-600" },
};

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  destructive: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  outline: "border-border text-muted-foreground",
};
