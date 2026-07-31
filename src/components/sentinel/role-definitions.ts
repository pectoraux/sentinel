/**
 * Sentinel — Role-based navigation definitions
 * ----------------------------------------------------------------------------
 * Source of truth for the new role-based navigation shell.
 *
 * Each role defines a set of grouped nav items. Each nav item either maps to
 * an existing dashboard (via `tabId`) or renders a premium placeholder card
 * inside the AppShell (when `tabId` is omitted — e.g. "Report Event" and
 * "Settings").
 *
 * The shell receives the same 29 dashboard children that DashboardTabs uses,
 * in the exact order defined by `TAB_ORDER` below. Each tabId resolves to a
 * child index via `TAB_INDEX`.
 *
 * Adding a new tab: append its id to `TAB_ORDER`, render it as a new child of
 * <AppShell> in page.tsx, then reference the tabId from one or more nav items.
 */

import {
  Home,
  PlusCircle,
  Map as MapIcon,
  Radio,
  FileText,
  Target,
  Award,
  MessageSquare,
  LayoutDashboard,
  ShieldCheck,
  FolderSearch,
  Gavel,
  Landmark,
  BarChart3,
  FlaskConical,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Gauge,
  Code2,
  ClipboardCheck,
  Shield,
  Settings,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoleKey = "citizen" | "inspector" | "official" | "admin";

export type BadgeTone =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "outline";

export interface NavItem {
  /** Stable unique id (role-prefixed to avoid collisions in the palette). */
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Maps this nav item to an existing dashboard child. If omitted, the shell
   * renders a premium placeholder card (used for "Report Event", "Settings",
   * etc.).
   */
  tabId?: string;
  /** Group label this item belongs to (mirrored here for palette filtering). */
  group: string;
  badge?: string;
  badgeTone?: BadgeTone;
  /** Optional shortcut hint shown in the command palette (not enforced). */
  shortcut?: string;
}

export interface NavGroup {
  label: string;
  /** Optional one-line description shown above the items in some layouts. */
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
  /** Tailwind color token base used for the role accent (e.g. "emerald"). */
  accent: RoleAccent;
  /** Default tabId to land on when switching to this role. */
  defaultTabId?: string;
  groups: NavGroup[];
}

export type RoleAccent = "emerald" | "sky" | "violet" | "amber";

// ---------------------------------------------------------------------------
// Tab order — MUST match the children rendered inside <AppShell> in page.tsx
// ---------------------------------------------------------------------------

export const TAB_ORDER = [
  "production",
  "performance",
  "security",
  "developer",
  "analytics",
  "simulation",
  "government",
  "fraud",
  "rewards",
  "missions",
  "copilot",
  "autonomous",
  "hotspots",
  "predictions",
  "fusion",
  "observations",
  "cv",
  "satellite",
  "notifications",
  "trust",
  "corroboration",
  "intel",
  "evidence",
  "kg",
  "temporal",
  "twin",
  "geo",
  "identity",
  "foundation",
] as const;

export type TabId = (typeof TAB_ORDER)[number];

export const TAB_INDEX: Record<string, number> = Object.fromEntries(
  TAB_ORDER.map((id, i) => [id, i]),
);

// ---------------------------------------------------------------------------
// Quick-action items (shown in the command palette under "Quick Actions")
// ---------------------------------------------------------------------------

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
  /** Discriminator — the shell decides what to do based on this. */
  kind:
    | "toggle-sidebar"
    | "toggle-theme"
    | "open-notifications"
    | "open-help"
    | "open-api-docs";
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-toggle-sidebar",
    label: "Toggle sidebar",
    description: "Collapse or expand the navigation sidebar",
    icon: LayoutDashboard,
    shortcut: "⌘B",
    kind: "toggle-sidebar",
  },
  {
    id: "qa-toggle-theme",
    label: "Toggle theme",
    description: "Switch between light and dark appearance",
    icon: Settings,
    shortcut: "⌘D",
    kind: "toggle-theme",
  },
  {
    id: "qa-notifications",
    label: "Open notifications",
    description: "View your latest alerts and updates",
    icon: Radio,
    shortcut: "⌘\\",
    kind: "open-notifications",
  },
  {
    id: "qa-help",
    label: "Help & Support",
    description: "Documentation, keyboard shortcuts, and contact",
    icon: ShieldCheck,
    shortcut: "?",
    kind: "open-help",
  },
  {
    id: "qa-api-docs",
    label: "View API documentation",
    description: "Open the REST + GraphQL developer reference",
    icon: Code2,
    kind: "open-api-docs",
  },
];

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

/** Citizen Reporter — community member who reports incidents and earns rewards. */
function buildCitizenGroups(): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        {
          id: "citizen-overview",
          label: "Overview",
          description: "Your activity, missions, and rewards at a glance",
          icon: Home,
          group: "Overview",
          // No tabId → premium placeholder landing card.
        },
        {
          id: "citizen-report",
          label: "Report Event",
          description: "Quickly report an incident you witnessed",
          icon: PlusCircle,
          group: "Overview",
          badge: "Quick",
          badgeTone: "success",
          // No tabId → premium placeholder report composer.
        },
      ],
    },
    {
      label: "Discover",
      items: [
        {
          id: "citizen-map",
          label: "Map",
          description: "Geospatial intelligence with real-time incidents",
          icon: MapIcon,
          group: "Discover",
          tabId: "geo",
        },
        {
          id: "citizen-feed",
          label: "Community Feed",
          description: "Live community intelligence stream",
          icon: Radio,
          group: "Discover",
          tabId: "intel",
        },
      ],
    },
    {
      label: "Contribute",
      items: [
        {
          id: "citizen-evidence",
          label: "My Evidence",
          description: "Evidence you've submitted — hashed and tamper-proof",
          icon: FileText,
          group: "Contribute",
          tabId: "evidence",
        },
        {
          id: "citizen-missions",
          label: "Missions",
          description: "AI-dispatched missions near you",
          icon: Target,
          group: "Contribute",
          tabId: "missions",
        },
        {
          id: "citizen-rewards",
          label: "Rewards",
          description: "Your earned contributions and payouts",
          icon: Award,
          group: "Contribute",
          tabId: "rewards",
        },
      ],
    },
    {
      label: "Assistant",
      items: [
        {
          id: "citizen-copilot",
          label: "AI Copilot",
          description: "Ask the digital twin about incidents near you",
          icon: MessageSquare,
          group: "Assistant",
          tabId: "copilot",
          shortcut: "⌘J",
        },
      ],
    },
  ];
}

/** Field Inspector — government field operative doing inspections & investigations. */
function buildInspectorGroups(): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        {
          id: "insp-dashboard",
          label: "Dashboard",
          description: "Your inspection queue and field metrics",
          icon: LayoutDashboard,
          group: "Overview",
          tabId: "government",
        },
        {
          id: "insp-map",
          label: "Map",
          description: "Operational map with active incidents",
          icon: MapIcon,
          group: "Overview",
          tabId: "geo",
        },
      ],
    },
    {
      label: "Field Work",
      items: [
        {
          id: "insp-inspections",
          label: "My Inspections",
          description: "Inspections assigned to you",
          icon: ShieldCheck,
          group: "Field Work",
          tabId: "government",
        },
        {
          id: "insp-investigations",
          label: "Investigations",
          description: "Open investigations you're leading",
          icon: FileText,
          group: "Field Work",
          tabId: "government",
        },
      ],
    },
    {
      label: "Queue",
      items: [
        {
          id: "insp-evidence",
          label: "Evidence Queue",
          description: "Evidence awaiting your verification",
          icon: FolderSearch,
          group: "Queue",
          tabId: "evidence",
          badge: "12",
          badgeTone: "warning",
        },
        {
          id: "insp-cases",
          label: "Cases",
          description: "Active cases with timeline events",
          icon: Gavel,
          group: "Queue",
          tabId: "government",
        },
      ],
    },
    {
      label: "Assistant",
      items: [
        {
          id: "insp-copilot",
          label: "AI Copilot",
          description: "Query case history and evidence",
          icon: MessageSquare,
          group: "Assistant",
          tabId: "copilot",
          shortcut: "⌘J",
        },
      ],
    },
  ];
}

/** Government Official — national/regional analyst running operations. */
function buildOfficialGroups(): NavGroup[] {
  return [
    {
      label: "National",
      items: [
        {
          id: "off-national",
          label: "National Dashboard",
          description: "Country-wide operational picture",
          icon: Landmark,
          group: "National",
          tabId: "government",
        },
        {
          id: "off-analytics",
          label: "Analytics",
          description: "Trends, hotspots, and KPIs across the nation",
          icon: BarChart3,
          group: "National",
          tabId: "analytics",
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          id: "off-investigations",
          label: "Investigations",
          description: "All active investigations across regions",
          icon: FileText,
          group: "Operations",
          tabId: "government",
        },
        {
          id: "off-inspections",
          label: "Inspections",
          description: "Scheduled and completed inspections",
          icon: ShieldCheck,
          group: "Operations",
          tabId: "government",
        },
        {
          id: "off-cases",
          label: "Cases",
          description: "Case management with timeline events",
          icon: Gavel,
          group: "Operations",
          tabId: "government",
        },
      ],
    },
    {
      label: "Intelligence",
      items: [
        {
          id: "off-simulation",
          label: "Simulation",
          description: "Model policy interventions and outcomes",
          icon: FlaskConical,
          group: "Intelligence",
          tabId: "simulation",
        },
        {
          id: "off-fraud",
          label: "Fraud Detection",
          description: "AI-powered fraud and collusion alerts",
          icon: AlertTriangle,
          group: "Intelligence",
          tabId: "fraud",
          badge: "3",
          badgeTone: "destructive",
        },
        {
          id: "off-autonomous",
          label: "Auto-Investigator",
          description: "AI-conducted investigations with Bayesian reasoning",
          icon: Sparkles,
          group: "Intelligence",
          tabId: "autonomous",
          badge: "AI",
          badgeTone: "default",
        },
      ],
    },
    {
      label: "Assistant",
      items: [
        {
          id: "off-copilot",
          label: "AI Copilot",
          description: "Query the national digital twin",
          icon: MessageSquare,
          group: "Assistant",
          tabId: "copilot",
          shortcut: "⌘J",
        },
      ],
    },
  ];
}

/** Platform Admin — full platform access including security, perf, dev, prod. */
function buildAdminGroups(): NavGroup[] {
  return [
    ...buildOfficialGroups(),
    {
      label: "Platform",
      hint: "Internal subsystems",
      items: [
        {
          id: "admin-security",
          label: "Security",
          description: "Zero Trust posture, threats, pen tests, backups",
          icon: ShieldAlert,
          group: "Platform",
          tabId: "security",
        },
        {
          id: "admin-performance",
          label: "Performance",
          description: "Scaling, caching, load tests, optimization",
          icon: Gauge,
          group: "Platform",
          tabId: "performance",
        },
        {
          id: "admin-developer",
          label: "Developer",
          description: "REST + GraphQL API, webhooks, SDK, integrations",
          icon: Code2,
          group: "Platform",
          tabId: "developer",
        },
        {
          id: "admin-production",
          label: "Production",
          description: "Readiness, incidents, runbooks, deployments",
          icon: ClipboardCheck,
          group: "Platform",
          tabId: "production",
        },
      ],
    },
    {
      label: "System",
      items: [
        {
          id: "admin-trust",
          label: "Civil Trust",
          description: "8-factor trust engine and decay model",
          icon: Shield,
          group: "System",
          tabId: "trust",
        },
        {
          id: "admin-settings",
          label: "Settings",
          description: "Workspace, billing, and platform configuration",
          icon: Settings,
          group: "System",
          // No tabId → premium placeholder settings panel.
        },
      ],
    },
  ];
}

export const ROLES: Record<RoleKey, RoleConfig> = {
  citizen: {
    id: "citizen",
    label: "Citizen Reporter",
    shortLabel: "Citizen",
    description: "Community member who reports incidents and earns rewards.",
    tagline: "Report · Verify · Earn",
    icon: Home,
    accent: "emerald",
    defaultTabId: undefined, // lands on the Overview placeholder
    groups: buildCitizenGroups(),
  },
  inspector: {
    id: "inspector",
    label: "Field Inspector",
    shortLabel: "Inspector",
    description: "Government field operative conducting inspections.",
    tagline: "Inspect · Investigate · Resolve",
    icon: ShieldCheck,
    accent: "sky",
    defaultTabId: "government",
    groups: buildInspectorGroups(),
  },
  official: {
    id: "official",
    label: "Government Official",
    shortLabel: "Official",
    description: "National analyst running operations and policy.",
    tagline: "Analyze · Decide · Govern",
    icon: Landmark,
    accent: "violet",
    defaultTabId: "government",
    groups: buildOfficialGroups(),
  },
  admin: {
    id: "admin",
    label: "Platform Admin",
    shortLabel: "Admin",
    description: "Full platform access including security, performance, and dev.",
    tagline: "Operate · Harden · Ship",
    icon: ShieldAlert,
    accent: "amber",
    defaultTabId: "production",
    groups: buildAdminGroups(),
  },
};

export const DEFAULT_ROLE: RoleKey = "citizen";

/** Ordered list of role keys for switchers / palette. */
export const ROLE_ORDER: RoleKey[] = ["citizen", "inspector", "official", "admin"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getRoleConfig(role: RoleKey): RoleConfig {
  return ROLES[role] ?? ROLES[DEFAULT_ROLE];
}

/** Flatten a role's groups into a single list of nav items (for the palette). */
export function getFlattenedNavItems(role: RoleKey): NavItem[] {
  return getRoleConfig(role).groups.flatMap((g) => g.items);
}

/** Find a nav item by id across the active role's items. */
export function findNavItem(role: RoleKey, itemId: string): NavItem | undefined {
  return getFlattenedNavItems(role).find((i) => i.id === itemId);
}

/** Resolve a tabId to the child index in the AppShell children array. */
export function resolveChildIndex(tabId: string | undefined): number | null {
  if (!tabId) return null;
  const idx = TAB_INDEX[tabId];
  return typeof idx === "number" ? idx : null;
}

/**
 * Decide which nav item should be active when switching to a role.
 * Returns the first item of the first group, unless a `defaultTabId` is set,
 * in which case we prefer the first item whose tabId matches.
 */
export function pickDefaultNavItem(role: RoleKey): NavItem {
  const cfg = getRoleConfig(role);
  const items = getFlattenedNavItems(role);
  if (cfg.defaultTabId) {
    const match = items.find((i) => i.tabId === cfg.defaultTabId);
    if (match) return match;
  }
  return items[0] ?? {
    id: "fallback",
    label: cfg.label,
    description: cfg.description,
    icon: cfg.icon,
    group: "Overview",
  };
}

/** Tailwind utility class fragments for the role accent. Centralized so the
 *  shell and palette can render consistent accent colors per role. */
export const ROLE_ACCENT_CLASSES: Record<
  RoleAccent,
  {
    text: string;
    bg: string;
    bgSoft: string;
    border: string;
    ring: string;
    dot: string;
    gradient: string;
  }
> = {
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500",
    bgSoft: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/30",
    dot: "bg-emerald-500",
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
  },
  sky: {
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500",
    bgSoft: "bg-sky-500/10",
    border: "border-sky-500/30",
    ring: "ring-sky-500/30",
    dot: "bg-sky-500",
    gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500",
    bgSoft: "bg-violet-500/10",
    border: "border-violet-500/30",
    ring: "ring-violet-500/30",
    dot: "bg-violet-500",
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
    bgSoft: "bg-amber-500/10",
    border: "border-amber-500/30",
    ring: "ring-amber-500/30",
    dot: "bg-amber-500",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
  },
};

/** Tailwind class fragments for badge tones. */
export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  outline: "bg-transparent text-muted-foreground border-border",
};
