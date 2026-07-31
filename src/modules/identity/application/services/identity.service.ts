/**
 * Sentinel — Identity & Trust application services
 * =============================================================================
 * Use-case orchestration over the Identity domain. Each service method:
 *   1. Loads / constructs the aggregate(s)
 *   2. Mutates via aggregate methods (enforces invariants)
 *   3. Persists via Prisma (in a transaction where outbox writes are needed)
 *   4. Domain events are collected and written to the outbox for relay
 *
 * Services are the only place infrastructure (Prisma) touches the domain.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// OrganizationService
// ---------------------------------------------------------------------------

export class OrganizationService {
  async list(params?: { type?: string; status?: string; limit?: number; offset?: number }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    const [orgs, total] = await Promise.all([
      db.organization.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { members: true, devices: true } } },
      }),
      db.organization.count({ where }),
    ]);
    return {
      organizations: orgs.map((o) => ({
        id: o.id,
        key: o.key,
        name: o.name,
        type: o.type,
        status: o.status,
        country: o.country,
        region: o.region,
        description: o.description,
        logoUrl: o.logoUrl,
        verifiedAt: o.verifiedAt,
        memberCount: o._count.members,
        deviceCount: o._count.devices,
        createdAt: o.createdAt,
      })),
      total,
    };
  }

  async getById(id: string) {
    const org = await db.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { devices: true, verifications: true } },
      },
    });
    if (!org) return null;
    return {
      ...org,
      memberCount: org.members.length,
      members: org.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
    };
  }

  async create(params: {
    key: string;
    name: string;
    type: string;
    country?: string;
    region?: string;
    description?: string;
    creatorId: string;
  }): Promise<{ id: string }> {
    const org = await db.organization.create({
      data: {
        key: params.key,
        name: params.name,
        type: params.type,
        country: params.country,
        region: params.region,
        description: params.description,
        status: "pending_verification",
      },
    });
    // Creator becomes the org owner
    await db.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: params.creatorId,
        role: "owner",
        status: "active",
      },
    });
    // Record domain event in outbox (same tx would be ideal; kept simple here)
    await this.recordOutboxEvent("Organization", org.id, "organization.created", {
      key: org.key,
      type: org.type,
      creatorId: params.creatorId,
    });
    logger.info("organization.created", { orgId: org.id, key: org.key, type: org.type });
    return { id: org.id };
  }

  async verify(orgId: string, verifierId: string): Promise<void> {
    await db.organization.update({
      where: { id: orgId },
      data: { status: "active", verifiedAt: new Date(), verifiedById: verifierId },
    });
    await this.recordOutboxEvent("Organization", orgId, "organization.verified", {
      verifierId,
    });
    logger.info("organization.verified", { orgId, verifierId });
  }

  async addMember(params: {
    organizationId: string;
    userId: string;
    role: string;
    addedBy?: string;
  }): Promise<void> {
    await db.organizationMember.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        role: params.role,
        status: "active",
        invitedBy: params.addedBy,
      },
    });
    await this.recordOutboxEvent(
      "Organization",
      params.organizationId,
      "organization.member_added",
      { userId: params.userId, role: params.role, addedBy: params.addedBy },
    );
  }

  async invite(params: {
    organizationId: string;
    email: string;
    role: string;
    invitedById: string;
  }): Promise<{ token: string }> {
    const token = randomUUID();
    await db.organizationInvitation.create({
      data: {
        organizationId: params.organizationId,
        email: params.email,
        role: params.role,
        token,
        invitedById: params.invitedById,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    logger.info("organization.invited", {
      organizationId: params.organizationId,
      email: params.email,
      role: params.role,
    });
    return { token };
  }

  private async recordOutboxEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await db.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload: JSON.stringify(payload),
        status: "pending",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// DeviceService
// ---------------------------------------------------------------------------

export class DeviceService {
  async listForUser(userId: string) {
    const devices = await db.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
    });
    return { devices };
  }

  async registerOrTouch(params: {
    userId: string;
    fingerprint: string;
    label?: string;
    platform?: string;
    userAgent?: string;
    ip?: string;
    organizationId?: string;
  }): Promise<{ id: string; isNew: boolean }> {
    const existing = await db.device.findUnique({
      where: { fingerprint: params.fingerprint },
    });
    if (existing) {
      await db.device.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          lastSeenIp: params.ip,
          status: existing.status === "unverified" ? "active" : existing.status,
        },
      });
      return { id: existing.id, isNew: false };
    }
    const device = await db.device.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        fingerprint: params.fingerprint,
        label: params.label,
        platform: params.platform,
        userAgent: params.userAgent,
        status: "active",
        lastSeenIp: params.ip,
      },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "Device",
        aggregateId: device.id,
        eventType: "device.registered",
        payload: JSON.stringify({ userId: params.userId, platform: params.platform }),
        status: "pending",
      },
    });
    logger.info("device.registered", { deviceId: device.id, userId: params.userId });
    return { id: device.id, isNew: true };
  }

  async trust(deviceId: string, userId: string): Promise<void> {
    await db.device.update({
      where: { id: deviceId },
      data: { status: "trusted", trustedAt: new Date() },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "Device",
        aggregateId: deviceId,
        eventType: "device.trusted",
        payload: JSON.stringify({ userId }),
        status: "pending",
      },
    });
  }

  async revoke(deviceId: string, reason?: string): Promise<void> {
    await db.device.update({
      where: { id: deviceId },
      data: { status: "revoked", revokedAt: new Date(), revokedReason: reason },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "Device",
        aggregateId: deviceId,
        eventType: "device.revoked",
        payload: JSON.stringify({ reason }),
        status: "pending",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// IdentityVerificationService
// ---------------------------------------------------------------------------

export class IdentityVerificationService {
  async list(params?: {
    userId?: string;
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    const [verifications, total] = await Promise.all([
      db.identityVerification.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { submittedAt: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true, image: true } },
        },
      }),
      db.identityVerification.count({ where }),
    ]);
    return {
      verifications: verifications.map((v) => ({
        ...v,
        submittedData: v.submittedData ? JSON.parse(v.submittedData) : null,
      })),
      total,
    };
  }

  async submit(params: {
    userId: string;
    type: string;
    organizationId?: string;
    documentReference?: string;
    submittedData?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const v = await db.identityVerification.create({
      data: {
        userId: params.userId,
        type: params.type,
        organizationId: params.organizationId,
        documentReference: params.documentReference,
        submittedData: params.submittedData ? JSON.stringify(params.submittedData) : null,
        status: "pending",
      },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "IdentityVerification",
        aggregateId: v.id,
        eventType: "verification.submitted",
        payload: JSON.stringify({ userId: params.userId, type: params.type }),
        status: "pending",
      },
    });
    logger.info("verification.submitted", { id: v.id, userId: params.userId, type: params.type });
    return { id: v.id };
  }

  async approve(verificationId: string, reviewerId: string, notes?: string): Promise<void> {
    await db.identityVerification.update({
      where: { id: verificationId },
      data: {
        status: "approved",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewerNotes: notes,
      },
    });
    const v = await db.identityVerification.findUnique({
      where: { id: verificationId },
      select: { userId: true },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "IdentityVerification",
        aggregateId: verificationId,
        eventType: "verification.approved",
        payload: JSON.stringify({ userId: v?.userId, reviewerId }),
        status: "pending",
      },
    });
    // Auto-record a trust event for the approved verification
    if (v) {
      await getTrustProfileService().recordEvent({
        userId: v.userId,
        type: "verification_approved",
        delta: +15,
        reason: `${notes ?? "Verification approved"}`,
      });
    }
  }

  async reject(verificationId: string, reviewerId: string, reason: string): Promise<void> {
    await db.identityVerification.update({
      where: { id: verificationId },
      data: {
        status: "rejected",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewerNotes: reason,
      },
    });
    const v = await db.identityVerification.findUnique({
      where: { id: verificationId },
      select: { userId: true },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "IdentityVerification",
        aggregateId: verificationId,
        eventType: "verification.rejected",
        payload: JSON.stringify({ userId: v?.userId, reviewerId, reason }),
        status: "pending",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// TrustProfileService
// ---------------------------------------------------------------------------

export class TrustProfileService {
  async getForUser(userId: string) {
    const profile = await db.trustProfile.findUnique({ where: { userId } });
    if (!profile) return null;
    return {
      ...profile,
      factors: profile.factors ? JSON.parse(profile.factors) : null,
      badges: profile.badges ? JSON.parse(profile.badges) : [],
    };
  }

  async list(params?: { limit?: number; offset?: number; minScore?: number }) {
    const { limit = 50, offset = 0, minScore } = params ?? {};
    const where: Record<string, unknown> = {};
    if (typeof minScore === "number") where.score = { gte: minScore };
    const [profiles, total] = await Promise.all([
      db.trustProfile.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { score: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true, image: true } },
        },
      }),
      db.trustProfile.count({ where }),
    ]);
    return {
      profiles: profiles.map((p) => ({
        ...p,
        factors: p.factors ? JSON.parse(p.factors) : null,
        badges: p.badges ? JSON.parse(p.badges) : [],
      })),
      total,
    };
  }

  /**
   * Record a trust event and recalculate the user's score.
   */
  async recordEvent(params: {
    userId: string;
    type: string;
    delta: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await db.trustEvent.create({
      data: {
        userId: params.userId,
        type: params.type,
        delta: params.delta,
        reason: params.reason,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
    await this.recalculate(params.userId);
  }

  /**
   * Recalculate the trust profile for a user from their trust events + factors.
   */
  async recalculate(userId: string): Promise<{ score: number; tier: string }> {
    const [events, user, verifications, orgMemberships] = await Promise.all([
      db.trustEvent.findMany({ where: { userId } }),
      db.user.findUnique({ where: { id: userId } }),
      db.identityVerification.count({
        where: { userId, status: "approved" },
      }),
      db.organizationMember.count({
        where: { userId, status: "active" },
      }),
    ]);

    const accountAgeDays = user
      ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const factors = {
      verifications,
      reportsSubmitted: 0, // populated in M3
      reportsVerified: 0, // populated in M3
      orgMemberships,
      accountAgeDays,
      penalties: events.filter((e) => e.type === "penalty").length,
      disputes: events.filter((e) => e.type === "dispute_filed").length,
    };

    // Use domain computation
    const { computeScore, tierForScore, computeBadges } = await import(
      "@/modules/identity/domain/entities/trust-profile"
    );
    const score = computeScore(factors);
    const tier = tierForScore(score);
    const badges = computeBadges(factors, tier);

    await db.trustProfile.upsert({
      where: { userId },
      create: {
        userId,
        score,
        tier,
        factors: JSON.stringify(factors),
        badges: JSON.stringify(badges),
        lastRecalculatedAt: new Date(),
      },
      update: {
        score,
        tier,
        factors: JSON.stringify(factors),
        badges: JSON.stringify(badges),
        lastRecalculatedAt: new Date(),
      },
    });

    await db.outboxEvent.create({
      data: {
        aggregateType: "TrustProfile",
        aggregateId: userId,
        eventType: "trust.score_recalculated",
        payload: JSON.stringify({ score, tier }),
        status: "pending",
      },
    });

    logger.info("trust.recalculated", { userId, score, tier });
    return { score, tier };
  }
}

// ---------------------------------------------------------------------------
// SessionService — manage active sessions
// ---------------------------------------------------------------------------

export class SessionService {
  async listForUser(userId: string) {
    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionToken: s.sessionToken.slice(0, 8) + "…", // never expose full token
        ip: s.ip,
        userAgent: s.userAgent,
        expires: s.expires,
        createdAt: s.createdAt,
        isCurrent: false, // resolved by caller
      })),
    };
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await db.session.deleteMany({ where: { id: sessionId, userId } });
    logger.info("session.revoked", { sessionId, userId });
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<void> {
    await db.session.deleteMany({
      where: {
        userId,
        ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
      },
    });
    logger.info("session.revoke_all", { userId, exceptSessionId });
  }
}

// ---------------------------------------------------------------------------
// RoleSwitchService — switch the user's active role context
// ---------------------------------------------------------------------------

export class RoleSwitchService {
  /**
   * Switch the user's active role. The user must hold the target role (or be
   * a member of the target organization with the requested org-role).
   */
  async switch(params: {
    userId: string;
    toRole: string;
    contextType?: "global" | "organization";
    contextId?: string;
    reason?: string;
    ip?: string;
  }): Promise<{ fromRole: string | null; toRole: string }> {
    const existing = await db.activeRole.findUnique({ where: { userId: params.userId } });
    const fromRole = existing?.roleKey ?? null;

    // If switching into an org context, verify membership
    if (params.contextType === "organization" && params.contextId) {
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: params.contextId,
            userId: params.userId,
          },
        },
      });
      if (!membership || membership.status !== "active") {
        throw new Error("not_org_member");
      }
    }

    await db.activeRole.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        roleKey: params.toRole,
        contextType: params.contextType ?? "global",
        contextId: params.contextId,
      },
      update: {
        roleKey: params.toRole,
        contextType: params.contextType ?? "global",
        contextId: params.contextId,
        setAt: new Date(),
      },
    });

    await db.roleSwitchLog.create({
      data: {
        userId: params.userId,
        fromRole,
        toRole: params.toRole,
        contextType: params.contextType ?? "global",
        contextId: params.contextId,
        reason: params.reason,
        ip: params.ip,
      },
    });

    await db.outboxEvent.create({
      data: {
        aggregateType: "User",
        aggregateId: params.userId,
        eventType: "user.role_switched",
        payload: JSON.stringify({
          fromRole,
          toRole: params.toRole,
          context: params.contextType ?? "global",
        }),
        status: "pending",
      },
    });

    logger.info("role.switched", {
      userId: params.userId,
      fromRole,
      toRole: params.toRole,
    });
    return { fromRole, toRole: params.toRole };
  }

  async getActive(userId: string) {
    const active = await db.activeRole.findUnique({ where: { userId } });
    return active;
  }

  async history(userId: string, limit = 20) {
    const logs = await db.roleSwitchLog.findMany({
      where: { userId },
      orderBy: { switchedAt: "desc" },
      take: limit,
    });
    return { logs };
  }
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

let _org: OrganizationService | null = null;
let _dev: DeviceService | null = null;
let _ver: IdentityVerificationService | null = null;
let _trust: TrustProfileService | null = null;
let _sess: SessionService | null = null;
let _role: RoleSwitchService | null = null;

export function getOrganizationService(): OrganizationService {
  if (!_org) _org = new OrganizationService();
  return _org;
}
export function getDeviceService(): DeviceService {
  if (!_dev) _dev = new DeviceService();
  return _dev;
}
export function getIdentityVerificationService(): IdentityVerificationService {
  if (!_ver) _ver = new IdentityVerificationService();
  return _ver;
}
export function getTrustProfileService(): TrustProfileService {
  if (!_trust) _trust = new TrustProfileService();
  return _trust;
}
export function getSessionService(): SessionService {
  if (!_sess) _sess = new SessionService();
  return _sess;
}
export function getRoleSwitchService(): RoleSwitchService {
  if (!_role) _role = new RoleSwitchService();
  return _role;
}
