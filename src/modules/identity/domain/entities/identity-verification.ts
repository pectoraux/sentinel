/**
 * Sentinel — Identity Domain: IdentityVerification aggregate
 * =============================================================================
 * Represents a verification submission (government ID, passport, phone OTP,
 * email, address, biometric, organization docs). Lifecycle:
 *   pending → under_review → approved | rejected | expired
 *
 * Only reviewers (admins / inspectors / moderators) can move it to approved or
 * rejected. Approved verifications contribute to the user's TrustProfile.
 * =============================================================================
 */

import { AggregateRoot, type Result, ok, err, type UniqueId } from "@/core/shared";
import { VerificationEvents } from "../events/identity-events";

export type VerificationType =
  | "government_id"
  | "passport"
  | "phone_otp"
  | "email"
  | "address"
  | "biometric"
  | "organization_docs";

export type VerificationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export class IdentityVerification extends AggregateRoot<UniqueId> {
  private _userId: string;
  private _organizationId: string | null;
  private _type: VerificationType;
  private _status: VerificationStatus;
  private _documentReference: string | null;
  private _submittedData: Record<string, unknown> | null;
  private _reviewerNotes: string | null;
  private _reviewedById: string | null;
  private _reviewedAt: Date | null;
  private _submittedAt: Date;

  constructor(params: {
    id: UniqueId;
    userId: string;
    organizationId?: string | null;
    type: VerificationType;
    status?: VerificationStatus;
    documentReference?: string | null;
    submittedData?: Record<string, unknown> | null;
    reviewerNotes?: string | null;
    reviewedById?: string | null;
    reviewedAt?: Date | null;
    submittedAt?: Date;
  }) {
    super(params.id);
    this._userId = params.userId;
    this._organizationId = params.organizationId ?? null;
    this._type = params.type;
    this._status = params.status ?? "pending";
    this._documentReference = params.documentReference ?? null;
    this._submittedData = params.submittedData ?? null;
    this._reviewerNotes = params.reviewerNotes ?? null;
    this._reviewedById = params.reviewedById ?? null;
    this._reviewedAt = params.reviewedAt ?? null;
    this._submittedAt = params.submittedAt ?? new Date();
  }

  get userId(): string {
    return this._userId;
  }
  get type(): VerificationType {
    return this._type;
  }
  get status(): VerificationStatus {
    return this._status;
  }
  get isApproved(): boolean {
    return this._status === "approved";
  }
  get reviewedById(): string | null {
    return this._reviewedById;
  }

  startReview(): Result<void> {
    if (this._status !== "pending") return err("not_pending");
    this._status = "under_review";
    return ok(undefined);
  }

  approve(reviewerId: string, notes?: string): Result<void> {
    if (this._status === "approved") return err("already_approved");
    if (this._status === "rejected") return err("already_rejected");
    if (this._status === "expired") return err("expired");
    this._status = "approved";
    this._reviewedById = reviewerId;
    this._reviewedAt = new Date();
    this._reviewerNotes = notes ?? null;
    this.addDomainEvent(
      VerificationEvents.Approved(this.id.value, this._userId, reviewerId),
    );
    return ok(undefined);
  }

  reject(reviewerId: string, reason: string): Result<void> {
    if (this._status === "approved") return err("already_approved");
    if (this._status === "rejected") return err("already_rejected");
    if (this._status === "expired") return err("expired");
    this._status = "rejected";
    this._reviewedById = reviewerId;
    this._reviewedAt = new Date();
    this._reviewerNotes = reason;
    this.addDomainEvent(
      VerificationEvents.Rejected(this.id.value, this._userId, reviewerId, reason),
    );
    return ok(undefined);
  }

  expire(): Result<void> {
    if (this._status === "approved" || this._status === "rejected") {
      return err("already_reviewed");
    }
    this._status = "expired";
    return ok(undefined);
  }

  static create(params: {
    id: UniqueId;
    userId: string;
    type: VerificationType;
    organizationId?: string;
    documentReference?: string;
    submittedData?: Record<string, unknown>;
  }): IdentityVerification {
    const v = new IdentityVerification({ ...params, status: "pending" });
    v.addDomainEvent(
      VerificationEvents.Submitted(params.id.value, params.userId, params.type),
    );
    return v;
  }
}
