/**
 * Sentinel — Mission Service
 * =============================================================================
 * AI creates missions when confidence is low. Nearby trusted users receive
 * the mission. Rewards depend on verification quality.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  MISSION_TYPE_META,
  PRIORITY_META,
  calculateReward,
  generateMissionInstructions,
  getEligibleTiers,
  type MissionType,
  type MissionPriority,
  type VerificationQuality,
} from "../../domain/mission-types";

export class MissionService {
  /**
   * Create a mission from a low-confidence fusion result.
   * The AI analyzes the fusion result and generates a mission to gather more evidence.
   */
  async createFromLowConfidence(fusionResultId: string): Promise<{ missionId: string }> {
    const fusion = await db.fusionResult.findUnique({
      where: { id: fusionResultId },
      include: { sources: true },
    });
    if (!fusion) throw new Error("fusion_not_found");

    // Determine mission type based on what's missing
    const sourceTypes = fusion.sources.map((s) => s.sourceType);
    let missionType: MissionType = "evidence_gathering";
    if (!sourceTypes.includes("drone_survey") && fusion.lat && fusion.lng) {
      missionType = "drone_survey";
    } else if (!sourceTypes.includes("citizen_report")) {
      missionType = "witness_interview";
    } else if (!sourceTypes.includes("government_inspection")) {
      missionType = "inspection";
    }

    // Determine priority from confidence gap
    const confidenceGap = 0.7 - fusion.fusedConfidence; // target 70% confidence
    const priority: MissionPriority = confidenceGap > 0.3 ? "urgent" : confidenceGap > 0.2 ? "high" : confidenceGap > 0.1 ? "medium" : "low";

    // Generate mission details
    const locationName = fusion.locationName || `${fusion.lat?.toFixed(3)}, ${fusion.lng?.toFixed(3)}`;
    const triggerDescription = `Fused confidence is ${(fusion.fusedConfidence * 100).toFixed(0)}% (target: 70%). Need additional evidence to improve confidence.`;
    const instructions = generateMissionInstructions({
      type: missionType,
      locationName,
      radiusM: 500,
      triggerDescription,
    });

    const baseReward = 100;
    const maxReward = baseReward * PRIORITY_META[priority].rewardMultiplier * 2; // excellent quality
    const typeMeta = MISSION_TYPE_META[missionType];

    const mission = await db.mission.create({
      data: {
        key: `mission-${fusionResultId.slice(0, 12)}`,
        title: `${typeMeta.label}: Additional evidence needed at ${locationName}`,
        description: `Confidence is ${(fusion.fusedConfidence * 100).toFixed(0)}%. ${triggerDescription} Mission: ${typeMeta.description}.`,
        instructions,
        type: missionType,
        priority,
        triggerType: "low_confidence",
        triggerId: fusionResultId,
        triggerDescription,
        lat: fusion.lat,
        lng: fusion.lng,
        radiusM: 500,
        locationName,
        intelligenceEventId: fusion.intelligenceEventId,
        baseReward,
        maxReward,
        status: "open",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day expiry
        model: "mission-ai-v1",
        metadata: JSON.stringify({ fusionConfidence: fusion.fusedConfidence, sourceCount: fusion.sourceCount, missingSources: ["drone_survey", "citizen_report", "government_inspection"].filter((s) => !sourceTypes.includes(s)) }),
      },
    });

    // Auto-assign to nearby trusted users
    await this.autoAssign(mission.id);

    logger.info("mission.created", {
      missionId: mission.id,
      type: missionType,
      priority,
      fusionConfidence: fusion.fusedConfidence,
      baseReward,
      maxReward,
    });

    return { missionId: mission.id };
  }

  /**
   * Auto-assign a mission to nearby trusted users.
   */
  async autoAssign(missionId: string): Promise<{ assigned: number }> {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission || !mission.lat || !mission.lng) return { assigned: 0 };

    // Get eligible trust tiers
    const eligibleTiers = getEligibleTiers(mission.priority as MissionPriority);

    // Find nearby users with eligible trust tiers
    const trustFactors = await db.trustFactor.findMany({
      where: { tier: { in: eligibleTiers } },
      select: { userId: true, tier: true },
    });

    let assigned = 0;
    for (const tf of trustFactors) {
      // Get user's device location (approximate from last activity or org)
      const user = await db.user.findUnique({
        where: { id: tf.userId },
        select: { id: true, name: true },
      });
      if (!user) continue;

      // Check if user has a device near the mission
      const devices = await db.device.findMany({
        where: { userId: user.id, status: { in: ["trusted", "active"] } },
        take: 1,
      });
      if (devices.length === 0) continue;

      // Approximate distance (in production would use actual user location)
      const distanceKm = Math.random() * 5; // 0-5km (simulated)

      // Create assignment
      await db.missionAssignment.create({
        data: {
          missionId,
          userId: user.id,
          status: "offered",
          userTrustTier: tf.tier,
          userDistanceKm: distanceKm,
        },
      }).catch(() => {}); // skip duplicates
      assigned++;
    }

    logger.info("mission.auto_assigned", { missionId, assigned });
    return { assigned };
  }

  /**
   * Accept a mission.
   */
  async accept(missionId: string, userId: string): Promise<void> {
    await db.missionAssignment.updateMany({
      where: { missionId, userId },
      data: { status: "accepted", respondedAt: new Date() },
    });

    await db.mission.update({
      where: { id: missionId },
      data: {
        status: "assigned",
        assignedToId: userId,
        assignedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
  }

  /**
   * Submit mission evidence.
   */
  async submit(missionId: string, userId: string, params: {
    notes: string;
    evidenceIds?: string[];
    lat?: number;
    lng?: number;
  }): Promise<void> {
    await db.mission.update({
      where: { id: missionId },
      data: {
        status: "submitted",
        submissionNotes: params.notes,
        submissionEvidenceIds: params.evidenceIds ? JSON.stringify(params.evidenceIds) : null,
        submissionLat: params.lat,
        submissionLng: params.lng,
        submittedAt: new Date(),
      },
    });
  }

  /**
   * Verify a mission submission and calculate reward.
   */
  async verify(missionId: string, verifierId: string, params: {
    quality: VerificationQuality;
    notes?: string;
  }): Promise<{ actualReward: number; trustPoints: number }> {
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("mission_not_found");

    const { actualReward, qualityMultiplier } = calculateReward({
      baseReward: mission.baseReward,
      priority: mission.priority as MissionPriority,
      quality: params.quality,
    });

    await db.mission.update({
      where: { id: missionId },
      data: {
        status: "verified",
        verifiedById: verifierId,
        verificationNotes: params.notes,
        verificationQuality: params.quality,
        qualityMultiplier,
        actualReward,
        verifiedAt: new Date(),
      },
    });

    // Create reward log
    await db.missionRewardLog.create({
      data: {
        missionId,
        userId: mission.assignedToId ?? "",
        baseReward: mission.baseReward,
        qualityMultiplier,
        actualReward,
        qualityLevel: params.quality,
        trustPointsAwarded: actualReward,
        metadata: JSON.stringify({ priority: mission.priority, type: mission.type }),
      },
    });

    // Award trust points to the user
    if (mission.assignedToId) {
      const trustProfile = await db.trustProfile.findUnique({
        where: { userId: mission.assignedToId },
      });
      if (trustProfile) {
        await db.trustProfile.update({
          where: { userId: mission.assignedToId },
          data: {
            score: Math.min(100, trustProfile.score + actualReward / 10),
          },
        });
      }
    }

    logger.info("mission.verified", { missionId, quality: params.quality, actualReward });

    return { actualReward, trustPoints: actualReward };
  }

  /**
   * List missions.
   */
  async list(params?: { status?: string; type?: string; priority?: string; limit?: number; offset?: number }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;

    const [missions, total] = await Promise.all([
      db.mission.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: "desc" } }),
      db.mission.count({ where }),
    ]);

    return {
      missions: missions.map((m) => ({
        ...m,
        submissionEvidenceIds: m.submissionEvidenceIds ? JSON.parse(m.submissionEvidenceIds) : null,
        metadata: m.metadata ? JSON.parse(m.metadata) : null,
      })),
      total,
    };
  }

  async getById(id: string) {
    const m = await db.mission.findUnique({
      where: { id },
      include: {
        assignments: { take: 10, orderBy: { createdAt: "asc" } },
      },
    });
    if (!m) return null;
    return {
      ...m,
      submissionEvidenceIds: m.submissionEvidenceIds ? JSON.parse(m.submissionEvidenceIds) : null,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      assignments: m.assignments,
    };
  }

  async summary() {
    const [total, byStatus, byType, byPriority, totalRewards, avgReward, recentMissions, assignedCount] = await Promise.all([
      db.mission.count(),
      db.mission.groupBy({ by: ["status"], _count: true }),
      db.mission.groupBy({ by: ["type"], _count: true }),
      db.mission.groupBy({ by: ["priority"], _count: true }),
      db.missionRewardLog.aggregate({ _sum: { actualReward: true } }),
      db.missionRewardLog.aggregate({ _avg: { actualReward: true } }),
      db.mission.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
      db.mission.count({ where: { status: { in: ["assigned", "in_progress", "submitted"] } } }),
    ]);

    return {
      total,
      assigned: assignedCount,
      totalRewardsPaid: totalRewards._sum.actualReward ?? 0,
      avgReward: avgReward._avg.actualReward ?? 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
      recent: recentMissions.map((m) => ({
        id: m.id, title: m.title, type: m.type, priority: m.priority,
        status: m.status, baseReward: m.baseReward, maxReward: m.maxReward,
        locationName: m.locationName, triggerDescription: m.triggerDescription,
        actualReward: m.actualReward, verificationQuality: m.verificationQuality,
        createdAt: m.createdAt,
      })),
    };
  }
}

let _svc: MissionService | null = null;
export function getMissionService(): MissionService {
  if (!_svc) _svc = new MissionService();
  return _svc;
}
