/**
 * Sentinel — IAM Domain: User aggregate root
 * =============================================================================
 * Encapsulates user identity, status lifecycle, and security state
 * (failed logins, lockout). Invariants are enforced here.
 * =============================================================================
 */

import { AggregateRoot, type Result, ok, err, type UniqueId } from "@/core/shared";
import { UserEvents } from "../events/user-events";

export type UserStatus = "active" | "suspended" | "locked" | "pending";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class User extends AggregateRoot<UniqueId> {
  private _email: string;
  private _name: string | null;
  private _status: UserStatus;
  private _failedLogins: number;
  private _lockedUntil: Date | null;
  private _lastLoginAt: Date | null;

  constructor(params: {
    id: UniqueId;
    email: string;
    name?: string | null;
    status?: UserStatus;
    failedLogins?: number;
    lockedUntil?: Date | null;
    lastLoginAt?: Date | null;
  }) {
    super(params.id);
    this._email = params.email;
    this._name = params.name ?? null;
    this._status = params.status ?? "active";
    this._failedLogins = params.failedLogins ?? 0;
    this._lockedUntil = params.lockedUntil ?? null;
    this._lastLoginAt = params.lastLoginAt ?? null;
  }

  get email(): string {
    return this._email;
  }
  get name(): string | null {
    return this._name;
  }
  get status(): UserStatus {
    return this._status;
  }
  get isLocked(): boolean {
    return (
      this._status === "locked" ||
      (!!this._lockedUntil && this._lockedUntil.getTime() > Date.now())
    );
  }

  recordSuccessfulLogin(ip?: string): void {
    this._failedLogins = 0;
    this._lockedUntil = null;
    if (this._status === "locked") this._status = "active";
    this._lastLoginAt = new Date();
    this.addDomainEvent(UserEvents.LoggedIn(this.id.value, ip));
  }

  recordFailedLogin(): Result<void> {
    this._failedLogins += 1;
    if (this._failedLogins >= MAX_FAILED_LOGINS) {
      this._status = "locked";
      this._lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      return err("account_locked");
    }
    return ok(undefined);
  }

  suspend(reason?: string): Result<void> {
    if (this._status === "suspended") return err("already_suspended");
    this._status = "suspended";
    this.addDomainEvent(UserEvents.Suspended(this.id.value, reason));
    return ok(undefined);
  }

  reactivate(): Result<void> {
    if (this._status !== "suspended" && this._status !== "locked") {
      return err("not_inactive");
    }
    this._status = "active";
    this._failedLogins = 0;
    this._lockedUntil = null;
    return ok(undefined);
  }

  static create(params: { id: UniqueId; email: string; name?: string }): User {
    const user = new User({ ...params, status: "active" });
    user.addDomainEvent(UserEvents.Created(params.id.value, params.email));
    return user;
  }
}
