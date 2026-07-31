/**
 * UniqueId — typed identity value object.
 * Prevents mixing up a UserId with a RoleId at compile time.
 */

import { randomUUID } from "node:crypto";

export class UniqueId {
  private readonly _value: string;

  constructor(value?: string) {
    this._value = value ?? randomUUID();
  }

  get value(): string {
    return this._value;
  }

  equals(other: UniqueId): boolean {
    return other instanceof UniqueId && other._value === this._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }

  static from(value: string): UniqueId {
    return new UniqueId(value);
  }
}

/** Branded id types for compile-time safety across bounded contexts. */
export type UserId = UniqueId & { readonly __brand: "UserId" };
export type RoleId = UniqueId & { readonly __brand: "RoleId" };
export type PermissionId = UniqueId & { readonly __brand: "PermissionId" };
export type AuditLogId = UniqueId & { readonly __brand: "AuditLogId" };
export type FeatureFlagId = UniqueId & { readonly __brand: "FeatureFlagId" };
