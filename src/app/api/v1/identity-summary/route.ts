/**
 * GET /api/v1/identity-summary — aggregate identity platform metrics (public).
 * Powers the Identity & Trust dashboard tab.
 */

import { json, withHandler } from "@/lib/api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const [
    organizationsByType,
    organizationsByStatus,
    totalMembers,
    totalDevices,
    trustedDevices,
    verificationsByStatus,
    verificationsByType,
    trustTiers,
    topTrustProfiles,
    recentVerifications,
    recentOrgs,
  ] = await Promise.all([
    db.organization.groupBy({ by: ["type"], _count: true }),
    db.organization.groupBy({ by: ["status"], _count: true }),
    db.organizationMember.count({ where: { status: "active" } }),
    db.device.count(),
    db.device.count({ where: { status: "trusted" } }),
    db.identityVerification.groupBy({ by: ["status"], _count: true }),
    db.identityVerification.groupBy({ by: ["type"], _count: true }),
    db.trustProfile.groupBy({ by: ["tier"], _count: true }),
    db.trustProfile.findMany({
      take: 5,
      orderBy: { score: "desc" },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    }),
    db.identityVerification.findMany({
      take: 8,
      orderBy: { submittedAt: "desc" },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    db.organization.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    }),
  ]);

  return {
    status: 200,
    body: {
      organizations: {
        byType: organizationsByType.map((g) => ({ type: g.type, count: g._count })),
        byStatus: organizationsByStatus.map((g) => ({ status: g.status, count: g._count })),
        total: organizationsByType.reduce((s, g) => s + g._count, 0),
      },
      members: { total: totalMembers },
      devices: {
        total: totalDevices,
        trusted: trustedDevices,
        untrusted: totalDevices - trustedDevices,
      },
      verifications: {
        byStatus: verificationsByStatus.map((g) => ({ status: g.status, count: g._count })),
        byType: verificationsByType.map((g) => ({ type: g.type, count: g._count })),
        total: verificationsByStatus.reduce((s, g) => s + g._count, 0),
      },
      trust: {
        byTier: trustTiers.map((g) => ({ tier: g.tier, count: g._count })),
        topProfiles: topTrustProfiles.map((p) => ({
          userId: p.userId,
          score: p.score,
          tier: p.tier,
          badges: p.badges ? JSON.parse(p.badges) : [],
          user: p.user,
        })),
      },
      recent: {
        verifications: recentVerifications.map((v) => ({
          id: v.id,
          type: v.type,
          status: v.status,
          submittedAt: v.submittedAt,
          user: v.user,
        })),
        organizations: recentOrgs.map((o) => ({
          id: o.id,
          key: o.key,
          name: o.name,
          type: o.type,
          status: o.status,
          country: o.country,
          memberCount: o._count.members,
          createdAt: o.createdAt,
        })),
      },
    },
  };
});
