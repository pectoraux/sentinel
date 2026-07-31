/**
 * Tests — IAM / RBAC module
 *
 * Pure / unit-level tests over the static permission & role catalogues and the
 * Permission.keyFor helper. No database access.
 */

import { describe, it, expect } from "vitest";
import {
  PERMISSION_CATALOGUE,
  ROLE_CATALOGUE,
  RbacResolver,
  getRbac,
} from "@/modules/iam/infrastructure/rbac";
import { Permission, Role } from "@/modules/iam/domain/entities/role";
import { UniqueId } from "@/core/shared";

describe("RBAC — PERMISSION_CATALOGUE", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(PERMISSION_CATALOGUE)).toBe(true);
    expect(PERMISSION_CATALOGUE.length).toBeGreaterThan(0);
  });

  it("every permission has a resource and an action", () => {
    for (const p of PERMISSION_CATALOGUE) {
      expect(p.resource.length).toBeGreaterThan(0);
      expect(p.action.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("uses the resource:action convention", () => {
    for (const p of PERMISSION_CATALOGUE) {
      expect(`${p.resource}:${p.action}`).toMatch(/^.+:.+$/);
    }
  });
});

describe("RBAC — ROLE_CATALOGUE", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ROLE_CATALOGUE)).toBe(true);
    expect(ROLE_CATALOGUE.length).toBeGreaterThan(0);
  });

  it("includes the super_admin system role", () => {
    const superAdmin = ROLE_CATALOGUE.find((r) => r.key === "super_admin");
    expect(superAdmin).toBeDefined();
    expect(superAdmin?.permissions).toContain("*");
  });

  it("super_admin holds the wildcard '*' permission", () => {
    const superAdmin = ROLE_CATALOGUE.find((r) => r.key === "super_admin");
    expect(superAdmin?.permissions).toEqual(["*"]);
  });

  it("every non-super_admin role declares concrete permission keys", () => {
    for (const r of ROLE_CATALOGUE) {
      if (r.key === "super_admin") continue;
      expect(r.permissions.length).toBeGreaterThan(0);
      for (const k of r.permissions) {
        expect(k).not.toBe("*");
        expect(k).toMatch(/^.+:.+$/);
      }
    }
  });

  it("includes analyst, field_agent, citizen_reporter, auditor, admin roles", () => {
    const keys = ROLE_CATALOGUE.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "super_admin",
        "admin",
        "analyst",
        "field_agent",
        "citizen_reporter",
        "auditor",
      ]),
    );
  });
});

describe("Permission.keyFor", () => {
  it("joins resource and action with a colon", () => {
    expect(Permission.keyFor("cases", "read")).toBe("cases:read");
    expect(Permission.keyFor("reports", "create")).toBe("reports:create");
    expect(Permission.keyFor("users", "manage")).toBe("users:manage");
  });

  it("produces keys that match the catalogue convention", () => {
    const fromHelper = PERMISSION_CATALOGUE.map((p) =>
      Permission.keyFor(p.resource, p.action),
    );
    const fromCatalogue = PERMISSION_CATALOGUE.map((p) => `${p.resource}:${p.action}`);
    expect(fromHelper).toEqual(fromCatalogue);
  });
});

describe("Role domain entity", () => {
  it("grants and revokes permission keys (non-system role)", () => {
    const role = new Role(UniqueId.from("r1"), "custom", "Custom", false);
    role.grantPermission("cases:read");
    expect(role.hasPermission("cases:read")).toBe(true);
    role.revokePermission("cases:read");
    expect(role.hasPermission("cases:read")).toBe(false);
  });

  it("system roles are immutable: revoke is a no-op", () => {
    const role = new Role(UniqueId.from("r2"), "admin", "Admin", true);
    role.grantPermission("users:manage");
    expect(role.hasPermission("users:manage")).toBe(true);
    // Revoke on a system role must NOT remove the permission.
    role.revokePermission("users:manage");
    expect(role.hasPermission("users:manage")).toBe(true);
  });
});

describe("RbacResolver", () => {
  it("is constructible and exposes cache-invalidation helpers", () => {
    const resolver = new RbacResolver();
    expect(resolver).toBeInstanceOf(RbacResolver);
    expect(typeof resolver.invalidate).toBe("function");
    expect(typeof resolver.invalidateAll).toBe("function");
    expect(typeof resolver.can).toBe("function");
    expect(typeof resolver.getPermissions).toBe("function");
  });

  it("getRbac() returns a shared singleton", () => {
    expect(getRbac()).toBe(getRbac());
  });
});
