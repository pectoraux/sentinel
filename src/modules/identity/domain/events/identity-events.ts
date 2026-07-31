/**
 * Sentinel — Identity & Trust domain events
 * =============================================================================
 * Domain events produced by the Identity bounded context. Flow:
 *   Aggregate → Outbox → Event Bus → Audit handler + projectors (trust score).
 * =============================================================================
 */

import { createDomainEvent, type DomainEvent } from "@/core/shared";

export const OrganizationEvents = {
  Created: (orgId: string, key: string, type: string, creatorId?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "Organization",
      aggregateId: orgId,
      eventType: "organization.created",
      payload: { key, type, creatorId },
      metadata: { userId: creatorId },
    }),
  Verified: (orgId: string, verifierId: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "Organization",
      aggregateId: orgId,
      eventType: "organization.verified",
      payload: { verifierId },
      metadata: { userId: verifierId },
    }),
  MemberAdded: (orgId: string, userId: string, role: string, addedBy?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "Organization",
      aggregateId: orgId,
      eventType: "organization.member_added",
      payload: { userId, role, addedBy },
      metadata: { userId: addedBy },
    }),
} as const;

export const DeviceEvents = {
  Registered: (deviceId: string, userId: string, platform?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "Device",
      aggregateId: deviceId,
      eventType: "device.registered",
      payload: { userId, platform },
      metadata: { userId },
    }),
  Trusted: (deviceId: string, userId: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "Device",
      aggregateId: deviceId,
      eventType: "device.trusted",
      payload: { userId },
      metadata: { userId },
    }),
  Revoked: (deviceId: string, userId: string, reason?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "Device",
      aggregateId: deviceId,
      eventType: "device.revoked",
      payload: { userId, reason },
      metadata: { userId },
    }),
} as const;

export const VerificationEvents = {
  Submitted: (verificationId: string, userId: string, type: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "IdentityVerification",
      aggregateId: verificationId,
      eventType: "verification.submitted",
      payload: { userId, type },
      metadata: { userId },
    }),
  Approved: (verificationId: string, userId: string, reviewerId: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "IdentityVerification",
      aggregateId: verificationId,
      eventType: "verification.approved",
      payload: { userId, reviewerId },
      metadata: { userId: reviewerId, targetUserId: userId },
    }),
  Rejected: (verificationId: string, userId: string, reviewerId: string, reason?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "IdentityVerification",
      aggregateId: verificationId,
      eventType: "verification.rejected",
      payload: { userId, reviewerId, reason },
      metadata: { userId: reviewerId, targetUserId: userId },
    }),
} as const;

export const TrustEvents = {
  ScoreChanged: (userId: string, delta: number, newScore: number, reason: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TrustProfile",
      aggregateId: userId,
      eventType: "trust.score_changed",
      payload: { delta, newScore, reason },
      metadata: { userId },
    }),
  BadgeEarned: (userId: string, badge: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TrustProfile",
      aggregateId: userId,
      eventType: "trust.badge_earned",
      payload: { badge },
      metadata: { userId },
    }),
} as const;

export const RoleEvents = {
  Switched: (userId: string, fromRole: string | null, toRole: string, context: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "User",
      aggregateId: userId,
      eventType: "user.role_switched",
      payload: { fromRole, toRole, context },
      metadata: { userId },
    }),
} as const;
