/**
 * Sentinel — IAM Domain: Permission & Role entities
 * =============================================================================
 * RBAC model: Users → Roles → Permissions (resource:action).
 * Roles group permissions; users hold roles (many-to-many).
 * System roles (admin, analyst, field-agent, citizen-reporter) are seeded and
 * cannot be deleted.
 * =============================================================================
 */

import { AggregateRoot, type UniqueId } from "@/core/shared";

export class Permission {
  constructor(
    public readonly id: UniqueId,
    public readonly key: string,
    public readonly name: string,
    public readonly resource: string,
    public readonly action: string,
    public readonly description?: string,
  ) {}

  static keyFor(resource: string, action: string): string {
    return `${resource}:${action}`;
  }
}

export class Role extends AggregateRoot<UniqueId> {
  private _permissions: Set<string> = new Set();

  constructor(
    id: UniqueId,
    public readonly key: string,
    public readonly name: string,
    public readonly isSystem: boolean = false,
    public readonly description?: string,
  ) {
    super(id);
  }

  get permissionKeys(): string[] {
    return Array.from(this._permissions);
  }

  grantPermission(permissionKey: string): void {
    this._permissions.add(permissionKey);
  }

  revokePermission(permissionKey: string): void {
    if (this.isSystem) return; // system roles are immutable
    this._permissions.delete(permissionKey);
  }

  hasPermission(permissionKey: string): boolean {
    return this._permissions.has(permissionKey);
  }
}
