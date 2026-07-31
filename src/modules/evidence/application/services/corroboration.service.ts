/**
 * Sentinel — Evidence Corroboration Service
 * =============================================================================
 * Support, dispute, duplicate detection, witness confidence, and evidence
 * weighting. Replaces simple up/down votes with a multi-factor corroboration
 * model.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  computeWeight,
  detectDuplicate,
  checkIndependence,
  tierForWeight,
  TIER_META,
  type WeightResult,
  type DuplicateDetectionResult,
} from "../../domain/corroboration/weighting";

export class CorroborationService {
  /**
   * Support an evidence item (corroboration).
   * If the corroborator is independent, marks isIndependent=true.
   */
  async support(params: {
    evidenceId: string;
    userId: string;
    reason?: string;
    corroboratingEvidenceId?: string;
  }): Promise<{ id: string; isIndependent: boolean }> {
    // Check independence
    const evidence = await db.evidence.findUnique({
      where: { id: params.evidenceId },
      select: { uploadedById: true, organizationId: true },
    });
    if (!evidence) throw new Error("evidence_not_found");

    const corroborator = await db.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });
    const corroboratorOrg = await db.organizationMember.findFirst({
      where: { userId: params.userId, status: "active" },
      select: { organizationId: true },
    });

    const independence = checkIndependence({
      submitterOrgId: evidence.organizationId,
      corroboratorOrgId: corroboratorOrg?.organizationId ?? null,
      submitterDeviceId: null,
      corroboratorDeviceId: null,
      hasRelationship: false, // would query the KG in production
    });

    // Get the user's trust score for strength
    const trustProfile = await db.trustProfile.findUnique({
      where: { userId: params.userId },
      select: { score: true, tier: true },
    });
    const strength = trustProfile ? trustProfile.score / 100 : 0.5;

    // Create the corroboration (upsert: if exists, update reason)
    const corrob = await db.corroboration.upsert({
      where: {
        evidenceId_userId_type: {
          evidenceId: params.evidenceId,
          userId: params.userId,
          type: "support",
        },
      },
      create: {
        evidenceId: params.evidenceId,
        userId: params.userId,
        type: "support",
        strength,
        reason: params.reason,
        isIndependent: independence.isIndependent,
        corroboratingEvidenceId: params.corroboratingEvidenceId,
      },
      update: {
        reason: params.reason,
        corroboratingEvidenceId: params.corroboratingEvidenceId,
      },
    });

    // Recompute weight
    await this.recomputeWeight(params.evidenceId);

    logger.info("corroboration.support", {
      evidenceId: params.evidenceId,
      userId: params.userId,
      isIndependent: independence.isIndependent,
    });

    return { id: corrob.id, isIndependent: independence.isIndependent };
  }

  /**
   * Dispute an evidence item (challenge).
   */
  async dispute(params: {
    evidenceId: string;
    userId: string;
    reason: string;
  }): Promise<{ id: string }> {
    const trustProfile = await db.trustProfile.findUnique({
      where: { userId: params.userId },
      select: { score: true },
    });
    const strength = trustProfile ? trustProfile.score / 100 : 0.5;

    const corrob = await db.corroboration.upsert({
      where: {
        evidenceId_userId_type: {
          evidenceId: params.evidenceId,
          userId: params.userId,
          type: "dispute",
        },
      },
      create: {
        evidenceId: params.evidenceId,
        userId: params.userId,
        type: "dispute",
        strength,
        reason: params.reason,
      },
      update: {
        reason: params.reason,
      },
    });

    await this.recomputeWeight(params.evidenceId);

    logger.info("corroboration.dispute", {
      evidenceId: params.evidenceId,
      userId: params.userId,
    });

    return { id: corrob.id };
  }

  /**
   * Remove a support or dispute.
   */
  async removeCorroboration(evidenceId: string, userId: string, type: string): Promise<void> {
    await db.corroboration.deleteMany({
      where: { evidenceId, userId, type },
    });
    await this.recomputeWeight(evidenceId);
  }

  /**
   * Recompute the evidence weight from all corroboration factors.
   */
  async recomputeWeight(evidenceId: string): Promise<WeightResult> {
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        uploadedById: true,
        verified: true,
        checksum: true,
        lat: true,
        lng: true,
        type: true,
        mediaType: true,
        createdAt: true,
      },
    });
    if (!evidence) throw new Error("evidence_not_found");

    // Get submitter's trust score
    const trustProfile = await db.trustProfile.findUnique({
      where: { userId: evidence.uploadedById ?? "" },
      select: { score: true },
    });
    const baseTrust = trustProfile?.score ?? 30;

    // Count corroborations
    const [supports, disputes, independentSupports] = await Promise.all([
      db.corroboration.count({ where: { evidenceId, type: "support" } }),
      db.corroboration.count({ where: { evidenceId, type: "dispute" } }),
      db.corroboration.count({ where: { evidenceId, type: "support", isIndependent: true } }),
    ]);

    // Check if flagged as duplicate
    const duplicateGroups = await db.duplicateGroup.findMany({
      where: { status: { in: ["detected", "confirmed"] } },
    });
    const isDuplicate = duplicateGroups.some((g) => {
      const ids: string[] = JSON.parse(g.evidenceIds);
      return ids.includes(evidenceId);
    });

    const result = computeWeight({
      baseTrust,
      supportCount: supports,
      disputeCount: disputes,
      independentCount: independentSupports,
      isDuplicate,
      isVerified: evidence.verified,
    });

    // Upsert the weight record
    await db.evidenceWeight.upsert({
      where: { evidenceId },
      create: {
        evidenceId,
        weight: result.weight,
        confidence: result.confidence,
        factors: JSON.stringify(result.factors),
        supportCount: supports,
        disputeCount: disputes,
        independentCount: independentSupports,
        tier: result.tier,
        lastCalculatedAt: new Date(),
      },
      update: {
        weight: result.weight,
        confidence: result.confidence,
        factors: JSON.stringify(result.factors),
        supportCount: supports,
        disputeCount: disputes,
        independentCount: independentSupports,
        tier: result.tier,
        lastCalculatedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * Run duplicate detection across all evidence items.
   * Compares each pair and creates DuplicateGroup records for matches.
   */
  async detectDuplicates(): Promise<{
    groupsCreated: number;
    duplicates: Array<{ evidenceIds: string[]; method: string; confidence: number; metadata: Record<string, unknown> }>;
  }> {
    const allEvidence = await db.evidence.findMany({
      select: { id: true, checksum: true, lat: true, lng: true, createdAt: true, type: true, mediaType: true, title: true },
      orderBy: { createdAt: "asc" },
    });

    const duplicates: Array<{ evidenceIds: string[]; method: string; confidence: number; metadata: Record<string, unknown> }> = [];
    const seen = new Set<string>();

    for (let i = 0; i < allEvidence.length; i++) {
      for (let j = i + 1; j < allEvidence.length; j++) {
        const a = allEvidence[i]!;
        const b = allEvidence[j]!;
        const pairKey = `${a.id}-${b.id}`;
        if (seen.has(pairKey)) continue;

        const result = detectDuplicate(
          { checksum: a.checksum, lat: a.lat, lng: a.lng, createdAt: a.createdAt, type: a.type, mediaType: a.mediaType },
          { checksum: b.checksum, lat: b.lat, lng: b.lng, createdAt: b.createdAt, type: b.type, mediaType: b.mediaType },
        );

        if (result) {
          seen.add(pairKey);
          duplicates.push({
            evidenceIds: [a.id, b.id],
            method: result.method,
            confidence: result.confidence,
            metadata: result.metadata,
          });

          // Create the duplicate group
          await db.duplicateGroup.create({
            data: {
              evidenceIds: JSON.stringify([a.id, b.id]),
              detectionMethod: result.method,
              confidence: result.confidence,
              metadata: JSON.stringify(result.metadata),
              status: "detected",
            },
          }).catch(() => {});
        }
      }
    }

    logger.info("corroboration.duplicates_detected", { count: duplicates.length });
    return { groupsCreated: duplicates.length, duplicates };
  }

  /**
   * Get corroboration details for an evidence item.
   */
  async getCorroboration(evidenceId: string) {
    const [supports, disputes, weight] = await Promise.all([
      db.corroboration.findMany({
        where: { evidenceId, type: "support" },
        orderBy: { createdAt: "desc" },
      }),
      db.corroboration.findMany({
        where: { evidenceId, type: "dispute" },
        orderBy: { createdAt: "desc" },
      }),
      db.evidenceWeight.findUnique({ where: { evidenceId } }),
    ]);

    return {
      supports: supports.map((s) => ({
        id: s.id,
        userId: s.userId,
        strength: s.strength,
        reason: s.reason,
        isIndependent: s.isIndependent,
        corroboratingEvidenceId: s.corroboratingEvidenceId,
        createdAt: s.createdAt,
      })),
      disputes: disputes.map((d) => ({
        id: d.id,
        userId: d.userId,
        strength: d.strength,
        reason: d.reason,
        createdAt: d.createdAt,
      })),
      weight: weight
        ? {
            weight: weight.weight,
            confidence: weight.confidence,
            tier: weight.tier,
            factors: weight.factors ? JSON.parse(weight.factors) : null,
            supportCount: weight.supportCount,
            disputeCount: weight.disputeCount,
            independentCount: weight.independentCount,
            lastCalculatedAt: weight.lastCalculatedAt,
          }
        : null,
    };
  }

  /**
   * Get all duplicate groups.
   */
  async getDuplicates() {
    const groups = await db.duplicateGroup.findMany({
      orderBy: { createdAt: "desc" },
    });
    return {
      groups: groups.map((g) => ({
        id: g.id,
        evidenceIds: JSON.parse(g.evidenceIds) as string[],
        detectionMethod: g.detectionMethod,
        confidence: g.confidence,
        metadata: g.metadata ? JSON.parse(g.metadata) : null,
        status: g.status,
        createdAt: g.createdAt,
      })),
    };
  }

  /**
   * Get the evidence weight (compute if not exists).
   */
  async getWeight(evidenceId: string): Promise<WeightResult | null> {
    let weight = await db.evidenceWeight.findUnique({ where: { evidenceId } });
    if (!weight) {
      try {
        await this.recomputeWeight(evidenceId);
        weight = await db.evidenceWeight.findUnique({ where: { evidenceId } });
      } catch {
        return null;
      }
    }
    if (!weight) return null;
    return {
      weight: weight.weight,
      confidence: weight.confidence,
      tier: weight.tier as WeightResult["tier"],
      factors: weight.factors ? JSON.parse(weight.factors) : null,
    };
  }

  /**
   * Aggregate corroboration summary.
   */
  async summary() {
    const [
      totalSupports,
      totalDisputes,
      totalIndependent,
      totalDuplicateGroups,
      duplicateGroupsConfirmed,
      weightedEvidence,
      tierDistribution,
      topEvidence,
    ] = await Promise.all([
      db.corroboration.count({ where: { type: "support" } }),
      db.corroboration.count({ where: { type: "dispute" } }),
      db.corroboration.count({ where: { type: "support", isIndependent: true } }),
      db.duplicateGroup.count(),
      db.duplicateGroup.count({ where: { status: "confirmed" } }),
      db.evidenceWeight.count(),
      db.evidenceWeight.groupBy({ by: ["tier"], _count: true }),
      db.evidenceWeight.findMany({
        take: 10,
        orderBy: { weight: "desc" },
        include: {
          evidence: { select: { id: true, title: true, type: true, mediaType: true } },
        },
      }),
    ]);

    return {
      supports: totalSupports,
      disputes: totalDisputes,
      independentCorroborations: totalIndependent,
      duplicateGroups: totalDuplicateGroups,
      duplicateGroupsConfirmed,
      weightedEvidence,
      tierDistribution: tierDistribution.map((t) => ({ tier: t.tier, count: t._count })),
      topEvidence: topEvidence.map((w) => ({
        evidenceId: w.evidenceId,
        weight: w.weight,
        confidence: w.confidence,
        tier: w.tier,
        supportCount: w.supportCount,
        disputeCount: w.disputeCount,
        independentCount: w.independentCount,
        evidence: w.evidence,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _svc: CorroborationService | null = null;
export function getCorroborationService(): CorroborationService {
  if (!_svc) _svc = new CorroborationService();
  return _svc;
}
