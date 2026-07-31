"use client";

/**
 * Sentinel — Command Palette (Cmd+K)
 * ----------------------------------------------------------------------------
 * A Linear/Stripe-style command palette that lets power users navigate the
 * entire shell with the keyboard. Opens with ⌘K / Ctrl+K.
 *
 * The palette is purely presentational — all side effects (navigation, role
 * switching, theme toggle) are delegated to the parent AppShell via callbacks.
 */

import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  type NavItem,
  type QuickAction,
  type RoleKey,
  ROLE_ORDER,
  ROLES,
  ROLE_ACCENT_CLASSES,
  getFlattenedNavItems,
  QUICK_ACTIONS,
} from "./role-definitions";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeRole: RoleKey;
  onNavigate: (item: NavItem) => void;
  onSwitchRole: (role: RoleKey) => void;
  onQuickAction: (action: QuickAction) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  activeRole,
  onNavigate,
  onSwitchRole,
  onQuickAction,
}: CommandPaletteProps) {
  const navItems = React.useMemo(
    () => getFlattenedNavItems(activeRole),
    [activeRole],
  );

  const handleNav = (item: NavItem) => {
    onNavigate(item);
    onOpenChange(false);
  };
  const handleRole = (role: RoleKey) => {
    onSwitchRole(role);
    onOpenChange(false);
  };
  const handleAction = (action: QuickAction) => {
    onQuickAction(action);
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-2xl"
      title="Sentinel command palette"
      description="Search pages, switch roles, and run quick actions."
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup
          heading={`Navigation · ${ROLES[activeRole].label}`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.description} ${item.group} ${item.id}`}
                onSelect={() => handleNav(item)}
                className="group"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </div>
                {item.shortcut && (
                  <CommandShortcut>{item.shortcut}</CommandShortcut>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Switch role */}
        <CommandGroup heading="Switch Role">
          {ROLE_ORDER.map((roleKey) => {
            const role = ROLES[roleKey];
            const Icon = role.icon;
            const isActive = roleKey === activeRole;
            const accent = ROLE_ACCENT_CLASSES[role.accent];
            return (
              <CommandItem
                key={roleKey}
                value={`role ${role.label} ${role.shortLabel} ${role.description}`}
                onSelect={() => handleRole(roleKey)}
                className="group"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md",
                    accent.bgSoft,
                    accent.text,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {role.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {role.tagline}
                  </span>
                </div>
                {isActive && (
                  <span className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Active
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Quick actions */}
        <CommandGroup heading="Quick Actions">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.id}
                value={`action ${action.label} ${action.description}`}
                onSelect={() => handleAction(action)}
                className="group"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {action.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {action.description}
                  </span>
                </div>
                {action.shortcut && (
                  <CommandShortcut>{action.shortcut}</CommandShortcut>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
