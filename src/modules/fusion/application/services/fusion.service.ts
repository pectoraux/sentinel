/**
 * Sentinel — Evidence Fusion Service
 * =============================================================================
 * Merges evidence from 6 source types into one fused confidence score.
 * Gathers data from: M13 CV detections (AI), M8 Intelligence Events (citizens),
 * M12 Satellite Scenes (satellite), M7 Evidence (drone/sensor), M4 Twin entities
 * (government inspections), and M9 Corroboration.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { fuse, SOURCE_META, type SourceInput, type FusionOutput } from "../../domain/fusion-types";

export class FusionService {
  /**
   * Fuse evidence for a specific intelligence event.
   * Gathers all related evidence from across the platform.
   */
  async fuseForEvent(intelligenceEventId: string): Promise<{ fusionResultId: string; output: FusionOutput }> {
    const event = await db.intelligenceEvent.findUnique({
      where: { id: intelligenceEventId },
      select: { id: true, key: true, title: true, type: true, severity: true, lat: true, lng: true, locationName: true, createdById: true },
    });
    if (!event) throw new Error("event_not_found");

    const sources: SourceInput[] = [];

    // 1. AI Detections (M13/M14) — find observations linked to this event
    const observations = await db.aIObservation.findMany({
      where: { intelligenceEventId: event.id },
      select: { id: true, confidence: true, type: true, description: true, summary: true, createdAt: true, detectionResultId: true },
    });
    for (const obs of observations) {
      sources.push({
        sourceType: "ai_detection",
        sourceId: obs.id,
        rawConfidence: obs.confidence,
        description: obs.summary,
        sourceTimestamp: obs.createdAt,
      });
    }

    // 2. Citizen Reports (M8) — the intelligence event itself is a citizen report
    sources.push({
      sourceType: "citizen_report",
      sourceId: event.id,
      rawConfidence: 0.6, // base confidence for citizen reports
      description: `Citizen report: ${event.title}`,
      sourceTimestamp: new Date(),
    });

    // 3. Satellite Imagery (M12) — find satellite scenes near the event location
    if (event.lat && event.lng) {
      const scenes = await db.satelliteScene.findMany({
        where: {
          status: "ready",
          centerLat: { gte: event.lat - 0.5, lte: event.lat + 0.5 },
          centerLng: { gte: event.lng - 0.5, lte: event.lng + 0.5 },
        },
        take: 3,
        select: { id: true, cloudCover: true, acquisitionDate: true, resolutionM: true },
      });
      for (const scene of scenes) {
        const confidence = Math.max(0.5, 1 - scene.cloudCover / 100);
        sources.push({
          sourceType: "satellite_imagery",
          sourceId: scene.id,
          rawConfidence: confidence,
          description: `Satellite scene (${scene.resolutionM}m res, ${scene.cloudCover}% cloud)`,
          sourceTimestamp: scene.acquisitionDate,
        });
      }
    }

    // 4. Evidence items (M7) — drone/sensor/government evidence linked via comments
    const comments = await db.eventComment.findMany({
      where: { eventId: event.id, attachments: { not: null } },
      select: { attachments: true, createdAt: true },
    });
    for (const comment of comments) {
      if (!comment.attachments) continue;
      const evidenceIds: string[] = JSON.parse(comment.attachments);
      const evidenceItems = await db.evidence.findMany({
        where: { id: { in: evidenceIds } },
        select: { id: true, type: true, title: true, verified: true, createdAt: true },
      });
      for (const ev of evidenceItems) {
        if (ev.type === "video") {
          sources.push({ sourceType: "drone_survey", sourceId: ev.id, rawConfidence: ev.verified ? 0.85 : 0.65, description: `Drone video: ${ev.title}`, sourceTimestamp: ev.createdAt });
        } else if (ev.type === "sensor_log") {
          sources.push({ sourceType: "sensor_log", sourceId: ev.id, rawConfidence: ev.verified ? 0.95 : 0.70, description: `Sensor log: ${ev.title}`, sourceTimestamp: ev.createdAt });
        } else if (ev.type === "document" || ev.type === "report") {
          sources.push({ sourceType: "government_inspection", sourceId: ev.id, rawConfidence: ev.verified ? 0.98 : 0.75, description: `Inspection doc: ${ev.title}`, sourceTimestamp: ev.createdAt });
        } else {
          sources.push({ sourceType: "corroboration", sourceId: ev.id, rawConfidence: ev.verified ? 0.80 : 0.55, description: `Evidence: ${ev.title}`, sourceTimestamp: ev.createdAt });
        }
      }
    }

    // 5. Corroboration (M9) — support count boosts confidence
    const intelEventsWithEvidence = await db.intelligenceEvent.findUnique({
      where: { id: event.id },
      select: { evidenceIds: true },
    });
    if (intelEventsWithEvidence?.evidenceIds) {
      const evIds: string[] = JSON.parse(intelEventsWithEvidence.evidenceIds);
      const corroborations = await db.corroboration.count({
        where: { evidenceId: { in: evIds }, type: "support" },
      });
      if (corroborations > 0) {
        sources.push({
          sourceType: "corroboration",
          rawConfidence: Math.min(0.9, 0.5 + corroborations * 0.1),
          description: `${corroborations} corroborations from community`,
          sourceTimestamp: new Date(),
        });
      }
    }

    // Run the fusion algorithm
    const output = fuse(sources);

    // Persist the fusion result
    const fusionResult = await db.fusionResult.create({
      data: {
        targetType: "intelligence_event",
        targetId: event.id,
        fusedConfidence: output.fusedConfidence,
        fusedSeverity: output.fusedSeverity,
        sourceCount: output.sourceCount,
        sourceBreakdown: JSON.stringify(output.sourceBreakdown),
        hasConflict: output.hasConflict,
        conflictDetails: output.conflictDetails ? JSON.stringify(output.conflictDetails) : null,
        consensusLevel: output.consensusLevel,
        lat: event.lat,
        lng: event.lng,
        locationName: event.locationName,
        intelligenceEventId: event.id,
        algorithm: "weighted_bayesian",
        metadata: JSON.stringify({ eventTitle: event.title, eventType: event.type }),
      },
    });

    // Persist individual sources
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const ws = output.weightedScores[i];
      if (!src || !ws) continue;
      await db.fusionSource.create({
        data: {
          fusionResultId: fusionResult.id,
          sourceType: src.sourceType,
          sourceId: src.sourceId,
          rawConfidence: src.rawConfidence,
          weight: ws.weight,
          weightedScore: ws.weightedScore,
          description: src.description,
          sourceTimestamp: src.sourceTimestamp,
          metadata: src.metadata ? JSON.stringify(src.metadata) : null,
        },
      });
    }

    logger.info("fusion.completed", {
      fusionResultId: fusionResult.id,
      eventId: event.id,
      sourceCount: output.sourceCount,
      fusedConfidence: output.fusedConfidence,
      hasConflict: output.hasConflict,
      consensusLevel: output.consensusLevel,
    });

    return { fusionResultId: fusionResult.id, output };
  }

  /**
   * Fuse evidence for all intelligence events.
   */
  async fuseAll(): Promise<{ fused: number; failed: number }> {
    const events = await db.intelligenceEvent.findMany({ select: { id: true } });
    let fused = 0;
    let failed = 0;
    for (const ev of events) {
      try {
        // Check if already fused
        const existing = await db.fusionResult.findFirst({ where: { targetId: ev.id, targetType: "intelligence_event" } });
        if (existing) continue;
        await this.fuseForEvent(ev.id);
        fused++;
      } catch {
        failed++;
      }
    }
    logger.info("fusion.batch_completed", { fused, failed });
    return { fused, failed };
  }

  /**
   * List fusion results.
   */
  async list(params?: { minConfidence?: number; hasConflict?: boolean; limit?: number; offset?: number }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.minConfidence !== undefined) where.fusedConfidence = { gte: filters.minConfidence };
    if (filters.hasConflict !== undefined) where.hasConflict = filters.hasConflict;

    const [results, total] = await Promise.all([
      db.fusionResult.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { fusedConfidence: "desc" },
        include: { _count: { select: { sources: true } } },
      }),
      db.fusionResult.count({ where }),
    ]);

    return {
      results: results.map((r) => ({
        ...r,
        sourceBreakdown: JSON.parse(r.sourceBreakdown),
        conflictDetails: r.conflictDetails ? JSON.parse(r.conflictDetails) : null,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        sourceCount: r._count.sources,
      })),
      total,
    };
  }

  /**
   * Get a fusion result with full source breakdown.
   */
  async getById(id: string) {
    const result = await db.fusionResult.findUnique({
      where: { id },
      include: { sources: { orderBy: { weightedScore: "desc" } } },
    });
    if (!result) return null;
    return {
      ...result,
      sourceBreakdown: JSON.parse(result.sourceBreakdown),
      conflictDetails: result.conflictDetails ? JSON.parse(result.conflictDetails) : null,
      metadata: result.metadata ? JSON.parse(result.metadata) : null,
      sources: result.sources.map((s) => ({
        ...s,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
      })),
    };
  }

  /**
   * Aggregate summary.
   */
  async summary() {
    const [
      totalFusions,
      avgConfidence,
      byConsensus,
      conflictCount,
      byTargetType,
      bySourceBreakdown,
      topResults,
      sourceTypeTotals,
    ] = await Promise.all([
      db.fusionResult.count(),
      db.fusionResult.aggregate({ _avg: { fusedConfidence: true } }),
      db.fusionResult.groupBy({ by: ["consensusLevel"], _count: true }),
      db.fusionResult.count({ where: { hasConflict: true } }),
      db.fusionResult.groupBy({ by: ["targetType"], _count: true }),
      db.fusionResult.groupBy({ by: ["fusedSeverity"], _count: true }),
      db.fusionResult.findMany({
        take: 10,
        orderBy: { fusedConfidence: "desc" },
        include: { _count: { select: { sources: true } } },
      }),
      db.fusionSource.groupBy({ by: ["sourceType"], _count: true, _avg: { rawConfidence: true } }),
    ]);

    return {
      total: totalFusions,
      avgConfidence: avgConfidence._avg.fusedConfidence ?? 0,
      conflicts: conflictCount,
      conflictRate: totalFusions > 0 ? conflictCount / totalFusions : 0,
      byConsensus: byConsensus.map((c) => ({ level: c.consensusLevel, count: c._count })),
      byTargetType: byTargetType.map((t) => ({ type: t.targetType, count: t._count })),
      bySeverity: bySourceBreakdown.map((s) => ({ severity: s.fusedSeverity, count: s._count })),
      sourceTypes: sourceTypeTotals.map((s) => ({
        type: s.sourceType,
        count: s._count,
        avgConfidence: s._avg.rawConfidence ?? 0,
        label: SOURCE_META[s.sourceType as keyof typeof SOURCE_META]?.label ?? s.sourceType,
        color: SOURCE_META[s.sourceType as keyof typeof SOURCE_META]?.color ?? "#6b7280",
      })),
      top: topResults.map((r) => ({
        id: r.id,
        fusedConfidence: r.fusedConfidence,
        fusedSeverity: r.fusedSeverity,
        sourceCount: r._count.sources,
        consensusLevel: r.consensusLevel,
        hasConflict: r.hasConflict,
        locationName: r.locationName,
        targetId: r.targetId,
        sourceBreakdown: JSON.parse(r.sourceBreakdown),
      })),
    };
  }
}

let _svc: FusionService | null = null;
export function getFusionService(): FusionService {
  if (!_svc) _svc = new FusionService();
  return _svc;
}
