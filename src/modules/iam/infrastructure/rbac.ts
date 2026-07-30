/**
 * Sentinel — RBAC Permission Resolver
 * =============================================================================
 * The central authorization engine. Given a user's id and a permission key,
 * resolve whether the action is allowed.
 *
 * Caching: permissions are resolved per-request and cached in-memory with a
 * short TTL (60s) to avoid hammering the database on every check. In a
 * multi-instance production deployment this cache is backed by Redis.
 *
 * Permission keys follow `resource:action` convention, e.g.:
 *   cases:read        reports:create      users:manage
 *   feature_flags:toggle  audit:export
 *
 * Wildcards: a role holding `*` or `resource:*` grants broad access
 * (reserved for the `admin` system role).
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";

interface CacheEntry {
  keys: string[];
  roles: string[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export interface RbacContext {
  userId?: string;
  roles?: string[];
  ip?: string;
}

export class RbacResolver {
  /**
   * Returns the set of permission keys granted to the user (via all roles).
   */
  async getPermissions(userId: string): Promise<{ keys: string[]; roles: string[] }> {
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return { keys: cached.keys, roles: cached.roles };
    }

    const roles = await db.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    const roleKeys = roles.map((r) => r.role.key);
    const permSet = new Set<string>();
    for (const r of roles) {
      for (const rp of r.role.permissions) {
        permSet.add(rp.permission.key);
      }
    }
    const keys = Array.from(permSet);

    cache.set(userId, { keys, roles: roleKeys, expiresAt: Date.now() + CACHE_TTL_MS });
    return { keys, roles: roleKeys };
  }

  /**
   * Check whether the user is allowed to perform `permissionKey`.
   * Supports wildcard permissions (`*`, `resource:*`).
   */
  async can(userId: string, permissionKey: string): Promise<boolean> {
    const { keys } = await this.getPermissions(userId);
    if (keys.includes("*")) return true;
    if (keys.includes(permissionKey)) return true;
    const [resource] = permissionKey.split(":");
    if (keys.includes(`${resource}:*`)) return true;
    return false;
  }

  /**
   * Convenience wrapper that throws a denied error (used by API guards).
   */
  async authorize(
    ctx: RbacContext,
    permissionKey: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!ctx.userId) return { allowed: false, reason: "unauthenticated" };
    const allowed = await this.can(ctx.userId, permissionKey);
    if (!allowed) {
      logger.warn("rbac.denied", { userId: ctx.userId, permissionKey });
      return { allowed: false, reason: "forbidden" };
    }
    return { allowed: true };
  }

  invalidate(userId: string): void {
    cache.delete(userId);
  }

  invalidateAll(): void {
    cache.clear();
  }
}

let instance: RbacResolver | null = null;
export function getRbac(): RbacResolver {
  if (!instance) instance = new RbacResolver();
  return instance;
}

// ---------------------------------------------------------------------------
// Canonical permission catalogue (seeded into DB)
// ---------------------------------------------------------------------------

export const PERMISSION_CATALOGUE: Array<{
  resource: string;
  action: string;
  name: string;
  description: string;
}> = [
  { resource: "users", action: "read", name: "Read users", description: "View user profiles" },
  { resource: "users", action: "manage", name: "Manage users", description: "Create, update, suspend users" },
  { resource: "users", action: "assign_roles", name: "Assign roles", description: "Assign roles to users" },
  { resource: "roles", action: "read", name: "Read roles", description: "View roles and permissions" },
  { resource: "roles", action: "manage", name: "Manage roles", description: "Create, update, delete roles" },
  { resource: "feature_flags", action: "read", name: "Read feature flags", description: "View feature flag configuration" },
  { resource: "feature_flags", action: "toggle", name: "Toggle feature flags", description: "Enable/disable feature flags" },
  { resource: "feature_flags", action: "manage", name: "Manage feature flags", description: "Create, update, delete feature flags" },
  { resource: "audit", action: "read", name: "Read audit logs", description: "View audit log entries" },
  { resource: "audit", action: "export", name: "Export audit logs", description: "Export audit log entries" },
  { resource: "system", action: "view_health", name: "View system health", description: "Access health & readiness endpoints" },
  { resource: "system", action: "view_metrics", name: "View metrics", description: "Access observability metrics" },
  { resource: "system", action: "admin", name: "System administration", description: "Full platform administration" },
  // M2 — Identity & Trust permissions
  { resource: "organizations", action: "read", name: "Read organizations", description: "View organizations and members" },
  { resource: "organizations", action: "manage", name: "Manage organizations", description: "Create, verify, suspend organizations" },
  { resource: "organizations", action: "verify", name: "Verify organizations", description: "Approve organization verification" },
  { resource: "organizations", action: "invite", name: "Invite members", description: "Invite users to an organization" },
  { resource: "devices", action: "read", name: "Read devices", description: "View registered devices" },
  { resource: "devices", action: "manage", name: "Manage devices", description: "Trust, revoke, label devices" },
  { resource: "identity", action: "submit_verification", name: "Submit verification", description: "Submit identity verification documents" },
  { resource: "identity", action: "review_verifications", name: "Review verifications", description: "Approve or reject identity verifications" },
  { resource: "identity", action: "view_trust", name: "View trust profiles", description: "View trust scores and tiers" },
  { resource: "identity", action: "manage_trust", name: "Manage trust", description: "Adjust trust scores, award badges" },
  { resource: "sessions", action: "manage", name: "Manage sessions", description: "View and revoke user sessions" },
  { resource: "identity", action: "switch_role", name: "Switch role", description: "Switch active role context" },
];

export const ROLE_CATALOGUE: Array<{
  key: string;
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    key: "super_admin",
    name: "Super Administrator",
    description: "Unrestricted access to all platform capabilities",
    permissions: ["*"],
  },
  {
    key: "admin",
    name: "Administrator",
    description: "Platform administration: users, roles, flags, organizations, system",
    permissions: [
      "users:read", "users:manage", "users:assign_roles",
      "roles:read", "roles:manage",
      "feature_flags:read", "feature_flags:toggle", "feature_flags:manage",
      "audit:read", "audit:export",
      "system:view_health", "system:view_metrics",
      "organizations:read", "organizations:manage", "organizations:verify", "organizations:invite",
      "devices:read", "devices:manage",
      "identity:submit_verification", "identity:review_verifications",
      "identity:view_trust", "identity:manage_trust",
      "sessions:manage", "identity:switch_role",
    ],
  },
  {
    key: "inspector",
    name: "Inspector",
    description: "Reviews identity verifications and inspects organizations (M2)",
    permissions: [
      "users:read",
      "organizations:read", "organizations:verify",
      "devices:read",
      "identity:review_verifications",
      "identity:view_trust",
      "audit:read",
      "system:view_health",
    ],
  },
  {
    key: "moderator",
    name: "Moderator",
    description: "Moderates content, manages trust, handles disputes (M2+)",
    permissions: [
      "users:read",
      "organizations:read",
      "identity:view_trust", "identity:manage_trust",
      "audit:read",
      "system:view_health",
    ],
  },
  {
    key: "analyst",
    name: "Intelligence Analyst",
    description: "Investigates incidents, verifies reports (future milestones)",
    permissions: [
      "users:read",
      "organizations:read",
      "identity:view_trust",
      "audit:read",
      "system:view_health",
    ],
  },
  {
    key: "field_agent",
    name: "Field Agent",
    description: "On-ground verification & evidence collection (future milestones)",
    permissions: [
      "users:read",
      "organizations:read",
      "devices:read",
      "identity:switch_role",
      "system:view_health",
    ],
  },
  {
    key: "citizen_reporter",
    name: "Citizen Reporter",
    description: "Submits community intelligence reports (future milestones)",
    permissions: [
      "identity:submit_verification",
      "identity:switch_role",
      "system:view_health",
    ],
  },
  {
    key: "auditor",
    name: "Auditor",
    description: "Read-only access to audit logs, organizations, and system health",
    permissions: [
      "audit:read", "audit:export",
      "users:read", "roles:read",
      "organizations:read",
      "identity:view_trust",
      "system:view_health", "system:view_metrics",
    ],
  },
];
