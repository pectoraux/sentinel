/**
 * Sentinel — Identity Domain: Device entity
 * =============================================================================
 * A Device represents a user's authenticated client (browser, phone, sensor).
 * Devices have a lifecycle: unverified → active → trusted | revoked | lost.
 * Trusted devices can be required for sensitive operations (e.g. role switching,
 * evidence submission).
 * =============================================================================
 */

import { createHash } from "node:crypto";
import { Entity, type Result, ok, err, type UniqueId } from "@/core/shared";
import { DeviceEvents } from "../events/identity-events";

export type DeviceStatus =
  | "unverified"
  | "active"
  | "trusted"
  | "revoked"
  | "lost";

export type DevicePlatform =
  | "ios"
  | "android"
  | "macos"
  | "windows"
  | "linux"
  | "web";

export class Device extends Entity<UniqueId> {
  private _userId: string;
  private _fingerprint: string;
  private _label: string | null;
  private _platform: DevicePlatform | null;
  private _userAgent: string | null;
  private _status: DeviceStatus;
  private _lastSeenAt: Date;
  private _lastSeenIp: string | null;
  private _trustedAt: Date | null;
  private _revokedAt: Date | null;

  constructor(params: {
    id: UniqueId;
    userId: string;
    fingerprint: string;
    label?: string | null;
    platform?: DevicePlatform | null;
    userAgent?: string | null;
    status?: DeviceStatus;
    lastSeenAt?: Date;
    lastSeenIp?: string | null;
    trustedAt?: Date | null;
    revokedAt?: Date | null;
  }) {
    super(params.id);
    this._userId = params.userId;
    this._fingerprint = params.fingerprint;
    this._label = params.label ?? null;
    this._platform = params.platform ?? null;
    this._userAgent = params.userAgent ?? null;
    this._status = params.status ?? "unverified";
    this._lastSeenAt = params.lastSeenAt ?? new Date();
    this._lastSeenIp = params.lastSeenIp ?? null;
    this._trustedAt = params.trustedAt ?? null;
    this._revokedAt = params.revokedAt ?? null;
  }

  get userId(): string {
    return this._userId;
  }
  get fingerprint(): string {
    return this._fingerprint;
  }
  get label(): string | null {
    return this._label;
  }
  get platform(): DevicePlatform | null {
    return this._platform;
  }
  get status(): DeviceStatus {
    return this._status;
  }
  get isTrusted(): boolean {
    return this._status === "trusted";
  }
  get lastSeenAt(): Date {
    return this._lastSeenAt;
  }

  markSeen(ip?: string): void {
    this._lastSeenAt = new Date();
    if (ip) this._lastSeenIp = ip;
    if (this._status === "unverified") this._status = "active";
  }

  trust(): Result<void> {
    if (this._status === "revoked") return err("device_revoked");
    if (this._status === "lost") return err("device_lost");
    this._status = "trusted";
    this._trustedAt = new Date();
    this.addDomainEvent(DeviceEvents.Trusted(this.id.value, this._userId));
    return ok(undefined);
  }

  revoke(reason?: string): Result<void> {
    if (this._status === "revoked") return err("already_revoked");
    this._status = "revoked";
    this._revokedAt = new Date();
    this.addDomainEvent(DeviceEvents.Revoked(this.id.value, this._userId, reason));
    return ok(undefined);
  }

  reportLost(): Result<void> {
    if (this._status === "revoked") return err("already_revoked");
    this._status = "lost";
    this._revokedAt = new Date();
    return ok(undefined);
  }

  static create(params: {
    id: UniqueId;
    userId: string;
    fingerprint: string;
    label?: string;
    platform?: DevicePlatform;
    userAgent?: string;
  }): Device {
    const device = new Device({ ...params, status: "unverified" });
    device.addDomainEvent(
      DeviceEvents.Registered(params.id.value, params.userId, params.platform),
    );
    return device;
  }
}

/**
 * Compute a stable device fingerprint from request characteristics.
 * Same UA + screen + tz → same fingerprint (no PII stored).
 */
export function computeDeviceFingerprint(params: {
  userAgent: string;
  acceptLanguage?: string;
  timezone?: string;
  screen?: string;
}): string {
  const raw = [params.userAgent, params.acceptLanguage ?? "", params.timezone ?? "", params.screen ?? ""].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
