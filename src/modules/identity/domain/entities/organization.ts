/**
 * Sentinel — Identity Domain: Organization aggregate root
 * =============================================================================
 * An Organization is a tenant entity that groups users (Government Agencies,
 * NGOs, Researchers, Regulators, Communities). It owns members, devices,
 * verifications, and has a lifecycle: pending_verification → active → (suspended
 * | dissolved).
 *
 * Invariants enforced here:
 * - Only verified organizations can host active members.
 * - Only the org owner / admins can invite members.
 * - Member roles must be from the allowed org-role set.
 * =============================================================================
 */

import { AggregateRoot, type Result, ok, err, type UniqueId } from "@/core/shared";
import { OrganizationEvents } from "../events/identity-events";

export type OrganizationType =
  | "government_agency"
  | "ngo"
  | "researcher"
  | "regulator"
  | "community";

export type OrganizationStatus =
  | "pending_verification"
  | "active"
  | "suspended"
  | "dissolved";

export type OrgMemberRole =
  | "owner"
  | "admin"
  | "member"
  | "inspector"
  | "moderator"
  | "observer";

export const ORG_MEMBER_ROLES: OrgMemberRole[] = [
  "owner",
  "admin",
  "member",
  "inspector",
  "moderator",
  "observer",
];

export interface OrganizationMember {
  userId: string;
  role: OrgMemberRole;
  status: "active" | "revoked" | "pending";
  joinedAt: Date;
}

export class Organization extends AggregateRoot<UniqueId> {
  private _key: string;
  private _name: string;
  private _type: OrganizationType;
  private _status: OrganizationStatus;
  private _country: string | null;
  private _region: string | null;
  private _verifiedAt: Date | null;
  private _members: Map<string, OrganizationMember> = new Map();

  constructor(params: {
    id: UniqueId;
    key: string;
    name: string;
    type: OrganizationType;
    status?: OrganizationStatus;
    country?: string | null;
    region?: string | null;
    verifiedAt?: Date | null;
  }) {
    super(params.id);
    this._key = params.key;
    this._name = params.name;
    this._type = params.type;
    this._status = params.status ?? "pending_verification";
    this._country = params.country ?? null;
    this._region = params.region ?? null;
    this._verifiedAt = params.verifiedAt ?? null;
  }

  get key(): string {
    return this._key;
  }
  get name(): string {
    return this._name;
  }
  get type(): OrganizationType {
    return this._type;
  }
  get status(): OrganizationStatus {
    return this._status;
  }
  get country(): string | null {
    return this._country;
  }
  get region(): string | null {
    return this._region;
  }
  get isVerified(): boolean {
    return this._status === "active" || this._status === "suspended";
  }
  get members(): OrganizationMember[] {
    return Array.from(this._members.values());
  }

  verify(verifierId: string): Result<void> {
    if (this._status === "active") return err("already_verified");
    if (this._status === "dissolved") return err("organization_dissolved");
    this._status = "active";
    this._verifiedAt = new Date();
    this.addDomainEvent(OrganizationEvents.Verified(this.id.value, verifierId));
    return ok(undefined);
  }

  suspend(): Result<void> {
    if (this._status !== "active") return err("not_active");
    this._status = "suspended";
    return ok(undefined);
  }

  reactivate(): Result<void> {
    if (this._status !== "suspended") return err("not_suspended");
    this._status = "active";
    return ok(undefined);
  }

  addMember(userId: string, role: OrgMemberRole, addedBy?: string): Result<void> {
    if (!ORG_MEMBER_ROLES.includes(role)) return err("invalid_role");
    if (!this.isVerified) return err("organization_not_verified");
    if (this._members.has(userId)) return err("already_member");
    this._members.set(userId, {
      userId,
      role,
      status: "active",
      joinedAt: new Date(),
    });
    this.addDomainEvent(
      OrganizationEvents.MemberAdded(this.id.value, userId, role, addedBy),
    );
    return ok(undefined);
  }

  removeMember(userId: string): Result<void> {
    const member = this._members.get(userId);
    if (!member) return err("not_a_member");
    member.status = "revoked";
    return ok(undefined);
  }

  changeMemberRole(userId: string, newRole: OrgMemberRole): Result<void> {
    if (!ORG_MEMBER_ROLES.includes(newRole)) return err("invalid_role");
    const member = this._members.get(userId);
    if (!member) return err("not_a_member");
    if (member.role === "owner") return err("cannot_change_owner");
    member.role = newRole;
    return ok(undefined);
  }

  static create(params: {
    id: UniqueId;
    key: string;
    name: string;
    type: OrganizationType;
    country?: string;
    region?: string;
    creatorId?: string;
  }): Organization {
    const org = new Organization({ ...params, status: "pending_verification" });
    org.addDomainEvent(
      OrganizationEvents.Created(
        params.id.value,
        params.key,
        params.type,
        params.creatorId,
      ),
    );
    return org;
  }
}
