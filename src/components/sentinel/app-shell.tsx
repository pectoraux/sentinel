"use client";

/**
 * Sentinel — Premium Role-Based App Shell
 * ----------------------------------------------------------------------------
 * Replaces the flat 29-tab strip with a Linear/Stripe-grade navigation shell:
 *   - Collapsible left sidebar (grouped, icon + label)
 *   - Sticky top header (search trigger, notifications, user menu)
 *   - Dynamic hero based on the active nav item
 *   - Cmd+K command palette
 *   - Role switcher in the sidebar footer
 *   - Mobile-responsive (sidebar becomes a Sheet drawer)
 *
 * The shell receives the same 29 dashboard children that DashboardTabs uses,
 * in the exact order defined by `TAB_ORDER` in role-definitions.ts. Each nav
 * item either maps to a child (via `tabId`) or renders a premium placeholder.
 *
 * Existing DashboardTabs is untouched — page.tsx simply renders <AppShell>
 * instead. The dashboard components themselves are unchanged.
 */

import * as React from "react";
import Link from "next/link";

// --- shadcn/ui ---
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// --- lucide-react ---
import {
  Menu,
  PanelLeft,
  PanelLeftClose,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Check,
  LogOut,
  User as UserIcon,
  Settings as SettingsIcon,
  Sun,
  Moon,
  HelpCircle,
  ExternalLink,
  Sparkles,
  PlusCircle,
  Map as MapIcon,
  Target,
  Camera,
  Send,
  Activity,
  TrendingUp,
  Award,
  ShieldCheck,
  FileText,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

// --- local ---
import {
  type NavItem,
  type RoleKey,
  type RoleConfig,
  type QuickAction,
  ROLES,
  ROLE_ORDER,
  DEFAULT_ROLE,
  ROLE_ACCENT_CLASSES,
  BADGE_TONE_CLASSES,
  getRoleConfig,
  getFlattenedNavItems,
  pickDefaultNavItem,
  resolveChildIndex,
  findNavItem,
} from "./role-definitions";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH_EXPANDED = "w-64"; // 16rem
const SIDEBAR_WIDTH_COLLAPSED = "w-[68px]"; // 4.25rem
const STORAGE_KEY_ROLE = "sentinel:role";
const STORAGE_KEY_COLLAPSED = "sentinel:sidebar-collapsed";
const STORAGE_KEY_THEME = "sentinel:theme";

const APP_USER = {
  name: "Ama Osei",
  email: "ama.osei@sentinel.africa",
  initials: "AO",
};

interface NotificationItem {
  id: string;
  icon: LucideIcon;
  iconTone: "primary" | "success" | "warning" | "destructive";
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    icon: Sparkles,
    iconTone: "primary",
    title: "Auto-Investigator triggered",
    description: "Prestea illegal mining event · 82% confidence",
    time: "2m ago",
    unread: true,
  },
  {
    id: "n2",
    icon: AlertTriangle,
    iconTone: "destructive",
    title: "Fraud alert: possible deepfake",
    description: "Evidence #EV-2391 flagged for review",
    time: "18m ago",
    unread: true,
  },
  {
    id: "n3",
    icon: Award,
    iconTone: "success",
    title: "Reward distributed",
    description: "₵250 credited for verified mission M-118",
    time: "1h ago",
    unread: true,
  },
  {
    id: "n4",
    icon: ShieldCheck,
    iconTone: "primary",
    title: "Trust tier upgraded",
    description: "You are now Verified (tier 3 of 5)",
    time: "4h ago",
    unread: false,
  },
  {
    id: "n5",
    icon: FileText,
    iconTone: "warning",
    title: "Evidence corroborated",
    description: "Your evidence #EV-2210 now has 3 independent witnesses",
    time: "Yesterday",
    unread: false,
  },
];

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export interface AppShellProps {
  /** 29 dashboards in TAB_ORDER order (same children DashboardTabs used). */
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();

  // --- State -------------------------------------------------------------
  const [role, setRole] = React.useState<RoleKey>(DEFAULT_ROLE);
  const [activeItemId, setActiveItemId] = React.useState<string>(() =>
    pickDefaultNavItem(DEFAULT_ROLE).id,
  );
  const [collapsed, setCollapsed] = React.useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = React.useState<boolean>(false);
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  // --- Hydration from localStorage ---------------------------------------
  React.useEffect(() => {
    try {
      const storedRole = localStorage.getItem(STORAGE_KEY_ROLE) as RoleKey | null;
      if (storedRole && ROLES[storedRole]) {
        setRole(storedRole);
        setActiveItemId(pickDefaultNavItem(storedRole).id);
      }
      const storedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED);
      if (storedCollapsed === "1") setCollapsed(true);
      const storedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // ignore — defaults are fine.
    }
  }, []);

  // --- Theme application -------------------------------------------------
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // --- Persist role + collapsed -----------------------------------------
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, role);
    } catch {
      // ignore
    }
  }, [role]);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  // --- Reset active item when role changes -------------------------------
  const handleSwitchRole = React.useCallback((next: RoleKey) => {
    setRole(next);
    setActiveItemId(pickDefaultNavItem(next).id);
  }, []);

  // --- Navigation --------------------------------------------------------
  const handleNavigate = React.useCallback(
    (item: NavItem) => {
      setActiveItemId(item.id);
      setMobileOpen(false);
    },
    [],
  );

  // --- Quick actions -----------------------------------------------------
  const handleQuickAction = React.useCallback(
    (action: QuickAction) => {
      switch (action.kind) {
        case "toggle-sidebar":
          setCollapsed((c) => !c);
          break;
        case "toggle-theme":
          setTheme((t) => (t === "dark" ? "light" : "dark"));
          break;
        case "open-notifications":
          // Bell button is a sibling — focus it for screen readers.
          document
            .getElementById("sentinel-notifications-trigger")
            ?.click();
          break;
        case "open-help":
          // Route to developer tab (which has docs/links).
          setActiveItemId("admin-developer");
          break;
        case "open-api-docs":
          window.open("/api/v1/info", "_blank", "noopener,noreferrer");
          break;
      }
    },
    [],
  );

  // --- Keyboard shortcuts ------------------------------------------------
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (isMobile) setMobileOpen((o) => !o);
        else setCollapsed((c) => !c);
        return;
      }
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        // Jump to AI Copilot for the current role.
        const copilotItem = getFlattenedNavItems(role).find(
          (i) => i.tabId === "copilot",
        );
        if (copilotItem) handleNavigate(copilotItem);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobile, role, handleNavigate]);

  // --- Resolve active child ---------------------------------------------
  const childrenArray = React.useMemo(
    () => React.Children.toArray(children),
    [children],
  );
  const activeItem = React.useMemo(
    () => findNavItem(role, activeItemId),
    [role, activeItemId],
  );
  const activeChildIndex = React.useMemo(
    () => (activeItem?.tabId ? resolveChildIndex(activeItem.tabId) : null),
    [activeItem],
  );
  const activeChild =
    activeChildIndex !== null && activeChildIndex < childrenArray.length
      ? childrenArray[activeChildIndex]
      : null;

  const roleConfig = getRoleConfig(role);

  // --- Sidebar content (shared between desktop + mobile) ----------------
  const sidebarContent = (
    <SidebarContent
      role={role}
      activeItemId={activeItemId}
      collapsed={collapsed && !isMobile}
      onNavigate={handleNavigate}
      onOpenPalette={() => setPaletteOpen(true)}
      onSwitchRole={handleSwitchRole}
    />
  );

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          aria-label="Primary navigation"
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
            collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          )}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[280px] border-sidebar-border bg-sidebar p-0 sm:max-w-[300px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sentinel navigation</SheetTitle>
            <SheetDescription>Role-based navigation drawer.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarContent
              role={role}
              activeItemId={activeItemId}
              collapsed={false}
              onNavigate={handleNavigate}
              onOpenPalette={() => {
                setMobileOpen(false);
                setTimeout(() => setPaletteOpen(true), 100);
              }}
              onSwitchRole={handleSwitchRole}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className={cn("flex min-h-screen min-w-0 flex-1 flex-col", !isMobile && (collapsed ? "ml-[68px]" : "ml-[256px]"))}>
        <ShellHeader
          roleConfig={roleConfig}
          activeItem={activeItem}
          isMobile={isMobile}
          collapsed={collapsed}
          onToggleSidebar={() => {
            if (isMobile) setMobileOpen(true);
            else setCollapsed((c) => !c);
          }}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
          theme={theme}
        />

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
            <ShellHero roleConfig={roleConfig} activeItem={activeItem} />
            <div className="mt-6">
              {activeChild ?? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">This section is loading. If it doesn't appear, try another section from the sidebar.</p>
                  </div>
                </div>
              )}
            </div>
            <ShellFooter />
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        activeRole={role}
        onNavigate={handleNavigate}
        onSwitchRole={handleSwitchRole}
        onQuickAction={handleQuickAction}
      />
    </div>
  );
}

export default AppShell;

// ---------------------------------------------------------------------------
// SidebarContent — shared between desktop and mobile drawer
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  role: RoleKey;
  activeItemId: string;
  collapsed: boolean;
  onNavigate: (item: NavItem) => void;
  onOpenPalette: () => void;
  onSwitchRole: (role: RoleKey) => void;
}

function SidebarContent({
  role,
  activeItemId,
  collapsed,
  onNavigate,
  onOpenPalette,
  onSwitchRole,
}: SidebarContentProps) {
  const roleConfig = getRoleConfig(role);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            aria-label="Sentinel home"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 ring-1 ring-primary/15">
              <img
                src="/sentinel-logo.png"
                alt=""
                className="h-9 w-9 object-contain"
                aria-hidden="true"
              />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold tracking-tight">
                    Sentinel
                  </span>
                  <Badge
                    variant="outline"
                    className="hidden h-4 px-1 text-[9px] font-medium uppercase tracking-wide sm:inline-flex"
                  >
                    {roleConfig.shortLabel}
                  </Badge>
                </div>
                <p className="truncate text-[10px] text-muted-foreground">
                  Community Intelligence
                </p>
              </div>
            )}
          </Link>
        </div>

        {/* Search trigger */}
        <div className={cn("px-3 py-3", collapsed && "px-2")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onOpenPalette}
                  className="h-9 w-full border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent"
                  aria-label="Open command palette"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Search · ⌘K</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={onOpenPalette}
              className="group flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="inline-flex h-4 items-center rounded border border-sidebar-border bg-background px-1 font-mono text-[9px] font-medium">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto">
          <nav
            aria-label="Sections"
            className={cn("flex flex-col gap-1 px-3 pb-4", collapsed && "px-2")}
          >
            {roleConfig.groups.map((group, gi) => (
              <div key={group.label} className={cn(gi > 0 && "mt-5")}>
                {!collapsed && (
                  <div className="mb-1 px-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                      {group.label}
                    </p>
                    {group.hint && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                        {group.hint}
                      </p>
                    )}
                  </div>
                )}
                {collapsed && gi > 0 && (
                  <Separator className="my-2 bg-sidebar-border" />
                )}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <SidebarNavItem
                        item={item}
                        active={item.id === activeItemId}
                        collapsed={collapsed}
                        onClick={() => onNavigate(item)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — role switcher */}
        <div
          className={cn(
            "shrink-0 border-t border-sidebar-border p-3",
            collapsed && "px-2",
          )}
        >
          <RoleSwitcher
            activeRole={role}
            collapsed={collapsed}
            onSwitchRole={onSwitchRole}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// SidebarNavItem
// ---------------------------------------------------------------------------

interface SidebarNavItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function SidebarNavItem({
  item,
  active,
  collapsed,
  onClick,
}: SidebarNavItemProps) {
  const Icon = item.icon;
  const badgeTone = item.badgeTone ?? "default";
  const badgeClass = BADGE_TONE_CLASSES[badgeTone];

  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-md text-sm transition-all duration-200 ease-out outline-none",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        collapsed ? "h-10 justify-center px-0" : "px-2.5 py-2",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      {/* Active left accent bar */}
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r bg-sidebar-primary",
            collapsed ? "h-7" : "h-5",
          )}
          style={{ width: 2 }}
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-sidebar-primary"
            : "text-muted-foreground group-hover:text-sidebar-foreground",
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "inline-flex h-4 items-center rounded border px-1 text-[9px] font-semibold uppercase leading-none",
                badgeClass,
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
      {collapsed && item.badge && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
            badgeTone === "destructive"
              ? "bg-destructive"
              : badgeTone === "warning"
                ? "bg-warning"
                : badgeTone === "success"
                  ? "bg-success"
                  : "bg-primary",
          )}
        />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span>{item.label}</span>
          {item.badge && (
            <span className="rounded border border-border px-1 text-[9px] font-semibold uppercase">
              {item.badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

// ---------------------------------------------------------------------------
// RoleSwitcher — sidebar footer dropdown
// ---------------------------------------------------------------------------

interface RoleSwitcherProps {
  activeRole: RoleKey;
  collapsed: boolean;
  onSwitchRole: (role: RoleKey) => void;
}

function RoleSwitcher({
  activeRole,
  collapsed,
  onSwitchRole,
}: RoleSwitcherProps) {
  const role = ROLES[activeRole];
  const Icon = role.icon;
  const accent = ROLE_ACCENT_CLASSES[role.accent];

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/30 p-2 text-left transition-colors hover:bg-sidebar-accent/60",
          collapsed && "justify-center p-2",
        )}
        aria-label={`Switch role — current: ${role.label}`}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            accent.bgSoft,
            accent.text,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold">{role.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {role.tagline}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">Switch role — {role.label}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align="end"
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Switch role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {ROLE_ORDER.map((roleKey) => {
            const r = ROLES[roleKey];
            const RIcon = r.icon;
            const racc = ROLE_ACCENT_CLASSES[r.accent];
            const isActive = roleKey === activeRole;
            return (
              <DropdownMenuItem
                key={roleKey}
                onSelect={() => onSwitchRole(roleKey)}
                className="gap-2.5 py-2"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    racc.bgSoft,
                    racc.text,
                  )}
                >
                  <RIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xs font-semibold">{r.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {r.description}
                  </p>
                </div>
                {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// ShellHeader
// ---------------------------------------------------------------------------

interface ShellHeaderProps {
  roleConfig: RoleConfig;
  activeItem?: NavItem;
  isMobile: boolean;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenPalette: () => void;
  onToggleTheme: () => void;
  theme: "light" | "dark";
}

function ShellHeader({
  roleConfig,
  activeItem,
  isMobile,
  collapsed,
  onToggleSidebar,
  onOpenPalette,
  onToggleTheme,
  theme,
}: ShellHeaderProps) {
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;
  const accent = ROLE_ACCENT_CLASSES[roleConfig.accent];

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="h-9 w-9 shrink-0"
        aria-label={
          isMobile
            ? "Open navigation menu"
            : collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
        }
      >
        {isMobile ? (
          <Menu className="h-4 w-4" />
        ) : collapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      {/* Breadcrumb / page title */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-sm"
        >
          <span className="hidden text-muted-foreground/60 sm:inline">
            Sentinel
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/40 sm:inline" />
          <span className="hidden text-muted-foreground sm:inline">
            {roleConfig.shortLabel}
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/40 sm:inline" />
          <span
            className={cn(
              "truncate font-semibold text-foreground",
              !activeItem && "text-muted-foreground",
            )}
          >
            {activeItem?.label ?? "Loading…"}
          </span>
        </nav>
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {/* Search trigger (mobile) */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenPalette}
            className="h-9 w-9"
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4" />
          </Button>
        )}

        {/* Live status pill */}
        <span className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success md:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>

        {/* Notifications */}
        <NotificationsMenu unreadCount={unreadCount} />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="h-9 w-9"
          aria-label={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User menu */}
        <UserMenu />
      </div>

      {/* Role accent strip — subtle indicator */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px",
          accent.gradient,
          "bg-gradient-to-r",
        )}
      />
    </header>
  );
}

// ---------------------------------------------------------------------------
// NotificationsMenu
// ---------------------------------------------------------------------------

function NotificationsMenu({ unreadCount }: { unreadCount: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          id="sentinel-notifications-trigger"
          className="relative h-9 w-9"
          aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 sm:w-96"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
          </div>
          <Badge variant="secondary" className="text-[9px] uppercase">
            {unreadCount} new
          </Badge>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <ul className="flex flex-col">
            {NOTIFICATIONS.map((n) => {
              const Icon = n.icon;
              const toneClass = {
                primary: "bg-primary/10 text-primary",
                success: "bg-success/15 text-success",
                warning: "bg-warning/15 text-warning-foreground",
                destructive: "bg-destructive/15 text-destructive",
              }[n.iconTone];
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-3 border-b border-border/60 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-accent/40",
                    n.unread && "bg-primary/[0.025]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      toneClass,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{n.title}</p>
                      {n.unread && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {n.description}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {n.time}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// UserMenu
// ---------------------------------------------------------------------------

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open user menu"
        >
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarImage src="" alt={APP_USER.name} />
            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
              {APP_USER.initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
          <span className="text-sm font-semibold">{APP_USER.name}</span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">
            {APP_USER.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="gap-2.5 py-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Account settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Trust & verification</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Help & shortcuts</span>
            <span className="ml-auto text-[10px] text-muted-foreground">?</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="gap-2.5 py-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">API documentation</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="gap-2.5 py-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// ShellHero — dynamic page header
// ---------------------------------------------------------------------------

function ShellHero({
  roleConfig,
  activeItem,
}: {
  roleConfig: RoleConfig;
  activeItem?: NavItem;
}) {
  if (!activeItem) return null;
  const Icon = activeItem.icon;
  const accent = ROLE_ACCENT_CLASSES[roleConfig.accent];

  return (
    <section className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
              accent.bgSoft,
              accent.text,
              accent.border,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                {roleConfig.label} · {activeItem.group}
              </p>
              {activeItem.badge && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[9px] font-semibold uppercase",
                    BADGE_TONE_CLASSES[activeItem.badgeTone ?? "default"],
                  )}
                >
                  {activeItem.badge}
                </Badge>
              )}
            </div>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[28px]">
              {activeItem.label}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {activeItem.description}
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
            <kbd className="font-mono text-[10px] font-semibold">⌘K</kbd>
            <span>Search</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
            <kbd className="font-mono text-[10px] font-semibold">⌘B</kbd>
            <span>Toggle sidebar</span>
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ShellFooter
// ---------------------------------------------------------------------------

function ShellFooter() {
  const links: { label: string; href: string }[] = [
    { label: "API", href: "/api/v1/info" },
    { label: "Health", href: "/api/v1/health" },
    { label: "System", href: "/api/v1/system" },
    { label: "Readiness", href: "/api/v1/readiness" },
  ];
  return (
    <footer className="mt-10 border-t border-border pt-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Sentinel Platform · M28 — Production Ready</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-success" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// PlaceholderContent — for nav items without a tabId
// ---------------------------------------------------------------------------

interface PlaceholderContentProps {
  item?: NavItem;
  role: RoleKey;
  onNavigate: (item: NavItem) => void;
}

function PlaceholderContent({
  item,
  role,
  onNavigate,
}: PlaceholderContentProps) {
  if (!item) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nothing to show yet.
        </CardContent>
      </Card>
    );
  }

  // Specialized premium placeholders:
  if (item.id === "citizen-overview") {
    return <CitizenOverviewPlaceholder role={role} onNavigate={onNavigate} />;
  }
  if (item.id === "citizen-report") {
    return <ReportEventPlaceholder />;
  }
  if (item.id === "admin-settings") {
    return <SettingsPlaceholder />;
  }

  // Generic premium placeholder
  return <GenericPlaceholder item={item} role={role} onNavigate={onNavigate} />;
}

function GenericPlaceholder({
  item,
  role,
  onNavigate,
}: {
  item: NavItem;
  role: RoleKey;
  onNavigate: (item: NavItem) => void;
}) {
  const Icon = item.icon;
  const related = getFlattenedNavItems(role)
    .filter((i) => i.id !== item.id && i.tabId)
    .slice(0, 4);

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-32 bg-gradient-to-br from-primary/10 via-primary/[0.03] to-transparent"
        />
        <CardHeader className="relative pb-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{item.label}</CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                {item.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </div>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-primary/70" />
          <p className="mt-2 text-sm font-medium">This module is being prepared</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            We're putting the finishing touches on this experience. In the
            meantime, explore related modules from your role.
          </p>
        </div>
        {related.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Related modules
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {related.map((r) => {
                const RIcon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onNavigate(r)}
                    className="group flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <RIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {r.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CitizenOverviewPlaceholder — personalized landing card
// ---------------------------------------------------------------------------

function CitizenOverviewPlaceholder({
  role,
  onNavigate,
}: {
  role: RoleKey;
  onNavigate: (item: NavItem) => void;
}) {
  const stats = [
    {
      label: "Reports filed",
      value: "3",
      hint: "+1 this week",
      icon: FileText,
      tone: "primary" as const,
    },
    {
      label: "Active missions",
      value: "2",
      hint: "1 near you",
      icon: Target,
      tone: "warning" as const,
    },
    {
      label: "Rewards earned",
      value: "₵1,250",
      hint: "lifetime",
      icon: Award,
      tone: "success" as const,
    },
    {
      label: "Trust tier",
      value: "Verified",
      hint: "tier 3 of 5",
      icon: ShieldCheck,
      tone: "primary" as const,
    },
  ];
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/15 text-success",
  };
  const recent = [
    { label: "Mission M-118 completed", time: "1h ago", icon: Check },
    { label: "Report R-304 submitted", time: "Yesterday", icon: FileText },
    { label: "Reward ₵250 credited", time: "2 days ago", icon: Award },
  ];

  const reportItem = getFlattenedNavItems(role).find(
    (i) => i.id === "citizen-report",
  );
  const mapItem = getFlattenedNavItems(role).find(
    (i) => i.id === "citizen-map",
  );

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <Card className="relative overflow-hidden border-primary/20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/[0.02] to-transparent"
        />
        <CardContent className="relative flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Welcome back
            </p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight">
              {APP_USER.name}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              You have 2 active missions near Prestea and 1 reward pending
              verification. Your trust tier was upgraded to Verified.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {reportItem && (
              <Button
                onClick={() => onNavigate(reportItem)}
                className="gap-1.5"
              >
                <PlusCircle className="h-4 w-4" />
                Report event
              </Button>
            )}
            {mapItem && (
              <Button
                variant="outline"
                onClick={() => onNavigate(mapItem)}
                className="gap-1.5"
              >
                <MapIcon className="h-4 w-4" />
                Open map
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="gap-0 py-4">
              <CardContent className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    toneClass[s.tone],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none tabular-nums">
                    {s.value}
                  </p>
                  <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                    {s.hint}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-primary" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {recent.map((r) => {
              const Icon = r.icon;
              return (
                <li
                  key={r.label}
                  className="flex items-center gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="flex-1 truncate text-sm">{r.label}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {r.time}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportEventPlaceholder — quick report composer
// ---------------------------------------------------------------------------

function ReportEventPlaceholder() {
  const incidentTypes = [
    "Illegal mining (galamsey)",
    "River pollution",
    "Deforestation",
    "Mercury contamination",
    "Road construction",
    "Other",
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="h-4 w-4 text-primary" />
            Report an incident
          </CardTitle>
          <CardDescription>
            Quickly report illegal mining or environmental crime you witnessed.
            Your report will be hashed and timestamped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Incident type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {incidentTypes.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    i === 0
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium">
                Location
              </label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
                <MapIcon className="h-3.5 w-3.5" />
                <span>Prestea, Western Region</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">
                Date observed
              </label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
                <span>Today, 14:32 GMT</span>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Description
            </label>
            <textarea
              readOnly
              rows={3}
              placeholder="Describe what you observed…"
              className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Evidence
            </label>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Camera className="h-4 w-4" />
              <span>Click to upload photos or videos</span>
            </button>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Files are AES-256 encrypted and SHA-256 hashed for tamper
              detection.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-muted-foreground">
              By submitting, you confirm this report is truthful to the best of
              your knowledge.
            </p>
            <Button className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Submit report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            Why your reports matter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            Every verified report strengthens the digital twin and helps
            authorities respond faster to environmental crime.
          </p>
          <ul className="space-y-2">
            {[
              "Reports are encrypted and tamper-proof",
              "Verified reports earn rewards from NGO/government pools",
              "Your trust tier increases with each verified report",
              "False reports are detected by the AI fraud engine",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-md border border-success/30 bg-success/5 p-3">
            <p className="text-[11px] font-medium text-success">
              Average reward for verified reports
            </p>
            <p className="mt-0.5 text-lg font-bold text-success">
              ₵85 <span className="text-xs font-normal">/ report</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPlaceholder
// ---------------------------------------------------------------------------

function SettingsPlaceholder() {
  const sections = [
    { label: "General", icon: SettingsIcon, active: true },
    { label: "Billing", icon: Award },
    { label: "Team", icon: UserIcon },
    { label: "Integrations", icon: ExternalLink },
    { label: "Security", icon: ShieldCheck },
  ];
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <SettingsIcon className="h-4 w-4 text-primary" />
          Platform settings
        </CardTitle>
        <CardDescription>
          Workspace, billing, team, and integration configuration. (Premium
          placeholder — wire to your settings service.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
          <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  type="button"
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    s.active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </nav>
          <div className="space-y-4">
            {[
              { label: "Workspace name", value: "Sentinel — Ghana Country" },
              { label: "Default region", value: "Western Region" },
              { label: "Default language", value: "English (en)" },
              { label: "Time zone", value: "Africa/Accra (GMT)" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.value}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-xs">
                  Edit
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
