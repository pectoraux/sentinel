/**
 * Sentinel — AI Observation Service
 * =============================================================================
 * Creates Intelligence Events from CV detection results. Each observation
 * stores evidence, confidence, reasoning, affected entities, and historical
 * comparison.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  OBSERVATION_TYPE_META,
  generateReasoning,
  computeTrend,
  mapAffectedEntities,
  type TrendDirection,
} from "../../domain/observation-types";

export class ObservationService {
  /**
   * Create an AI observation from a CV detection result.
   * This also creates a linked Intelligence Event (M8).
   */
  async createFromDetection(params: {
    detectionResultId: string;
    triggeredBy?: string;
  }): Promise<{ observationId: string; intelligenceEventId?: string }> {
    const detection = await db.detectionResult.findUnique({
      where: { id: params.detectionResultId },
    });
    if (!detection) throw new Error("detection_not_found");
    if (!detection.detected) throw new Error("detection_not_positive");

    const startTime = Date.now();

    // Find historical observations of the same type
    const historical = await db.aIObservation.findMany({
      where: { type: detection.type, status: "published" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, confidence: true, createdAt: true, severity: true },
    });

    const historicalConfidences = historical.map((h) => h.confidence);
    const { trend, changePercent } = computeTrend(detection.confidence, historicalConfidences);

    // Generate AI reasoning
    const areaData = detection.area ? JSON.parse(detection.area) : null;
    const { reasoning, steps } = generateReasoning({
      type: detection.type,
      detected: detection.detected,
      confidence: detection.confidence,
      description: detection.description || "",
      severity: detection.severity || undefined,
      area: areaData,
      historicalCount: historical.length,
      trend,
    });

    // Map affected entities
    const affectedEntityTypes = mapAffectedEntities(detection.type);
    const affectedEntities = await db.twinEntity.findMany({
      where: { type: { in: affectedEntityTypes } },
      take: 5,
      select: { id: true, name: true, type: true },
    });

    // Determine severity
    const typeMeta = OBSERVATION_TYPE_META[detection.type];
    const baseSeverity = detection.severity || "medium";
    const severity = typeMeta?.severityMap[baseSeverity] || baseSeverity;

    // Build title and summary
    const typeLabel = typeMeta?.label || detection.type;
    const title = `AI Observation: ${typeLabel} detected (${Math.round(detection.confidence * 100)}% confidence)`;
    const summary = detection.description?.slice(0, 200) || `AI detected ${typeLabel} in satellite imagery with ${Math.round(detection.confidence * 100)}% confidence.`;

    // Build evidence summary
    const evidenceSummary = `Based on VLM analysis of ${detection.imageUrl}. Processing time: ${(detection.processingMs / 1000).toFixed(1)}s. Model: ${detection.model}.`;

    // Build affected entities summary
    const affectedEntitiesSummary = affectedEntities.length > 0
      ? `Potentially affects: ${affectedEntities.map((e) => `${e.name} (${e.type})`).join(", ")}`
      : `No specific twin entities mapped for ${detection.type}`;

    // Build historical comparison
    const historicalComparison = JSON.stringify({
      previousCount: historical.length,
      trend,
      changePercent: Math.round(changePercent * 10) / 10,
      previousObservations: historical.slice(0, 5).map((h) => ({
        id: h.id,
        confidence: h.confidence,
        severity: h.severity,
        date: h.createdAt,
      })),
    });

    const processingMs = Date.now() - startTime;

    // Create the observation
    const observation = await db.aIObservation.create({
      data: {
        detectionResultId: detection.id,
        title,
        summary,
        type: detection.type,
        severity,
        confidence: detection.confidence,
        reasoning,
        reasoningSteps: JSON.stringify(steps),
        evidenceIds: JSON.stringify([detection.id]),
        evidenceSummary,
        affectedEntityIds: JSON.stringify(affectedEntities.map((e) => e.id)),
        affectedEntitiesSummary,
        historicalComparison,
        model: detection.model,
        imageUrl: detection.imageUrl,
        location: detection.sceneId ? JSON.stringify({ sceneId: detection.sceneId }) : null,
        processingMs,
        status: "published",
      },
    });

    // Create a linked Intelligence Event (M8)
    let intelligenceEventId: string | undefined;
    try {
      const intelEvent = await db.intelligenceEvent.create({
        data: {
          key: `ai-obs-${observation.id.slice(0, 12)}`,
          title,
          description: summary,
          type: detection.type === "forest_loss" ? "deforestation" :
                 detection.type === "water_changes" ? "water_contamination" :
                 detection.type === "excavation" || detection.type === "equipment" || detection.type === "buildings" ? "illegal_mining" :
                 detection.type === "tailings" ? "pollution" : "other",
          severity,
          status: "open",
          createdById: params.triggeredBy ?? undefined,
        },
      });
      intelligenceEventId = intelEvent.id;

      // Link the observation to the intelligence event
      await db.aIObservation.update({
        where: { id: observation.id },
        data: { intelligenceEventId },
      });

      // Append "created" event to the intelligence event stream (M8 event sourcing)
      await db.eventStreamEntry.create({
        data: {
          eventId: intelEvent.id,
          version: 1,
          eventType: "created",
          actorId: params.triggeredBy,
          actorType: "system",
          payload: JSON.stringify({
            title,
            type: detection.type,
            severity,
            source: "ai_observation",
            observationId: observation.id,
            confidence: detection.confidence,
          }),
        },
      });

      await db.intelligenceEvent.update({
        where: { id: intelEvent.id },
        data: { streamVersion: 1 },
      });

      // Outbox
      await db.outboxEvent.create({
        data: {
          aggregateType: "AIObservation",
          aggregateId: observation.id,
          eventType: "ai.observation.created",
          payload: JSON.stringify({ type: detection.type, severity, confidence: detection.confidence, intelligenceEventId }),
          status: "pending",
        },
      });
    } catch (e) {
      logger.warn("ai.observation.intel_link_failed", { observationId: observation.id, error: e instanceof Error ? e.message : String(e) });
    }

    logger.info("ai.observation.created", {
      observationId: observation.id,
      type: detection.type,
      severity,
      confidence: detection.confidence,
      trend,
      intelligenceEventId,
    });

    return { observationId: observation.id, intelligenceEventId };
  }

  /**
   * Create observations for all positive detection results that don't have one yet.
   */
  async createFromAllDetections(): Promise<{ created: number; failed: number }> {
    const detections = await db.detectionResult.findMany({
      where: { detected: true, status: "completed" },
      select: { id: true },
    });

    let created = 0;
    let failed = 0;

    for (const det of detections) {
      // Check if observation already exists for this detection
      const existing = await db.aIObservation.findFirst({
        where: { detectionResultId: det.id },
      });
      if (existing) continue;

      try {
        await this.createFromDetection({ detectionResultId: det.id, triggeredBy: "ai-batch" });
        created++;
      } catch (e) {
        failed++;
      }
    }

    logger.info("ai.observation.batch_created", { created, failed });
    return { created, failed };
  }

  /**
   * List observations with filters.
   */
  async list(params?: {
    type?: string;
    severity?: string;
    minConfidence?: number;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = { status: "published" };
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;
    if (filters.minConfidence !== undefined) where.confidence = { gte: filters.minConfidence };

    const [observations, total] = await Promise.all([
      db.aIObservation.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      db.aIObservation.count({ where }),
    ]);

    return {
      observations: observations.map((o) => ({
        ...o,
        reasoningSteps: o.reasoningSteps ? JSON.parse(o.reasoningSteps) : null,
        evidenceIds: o.evidenceIds ? JSON.parse(o.evidenceIds) : null,
        affectedEntityIds: o.affectedEntityIds ? JSON.parse(o.affectedEntityIds) : null,
        historicalComparison: o.historicalComparison ? JSON.parse(o.historicalComparison) : null,
        location: o.location ? JSON.parse(o.location) : null,
      })),
      total,
    };
  }

  /**
   * Get a single observation with full detail.
   */
  async getById(id: string) {
    const obs = await db.aIObservation.findUnique({ where: { id } });
    if (!obs) return null;
    return {
      ...obs,
      reasoningSteps: obs.reasoningSteps ? JSON.parse(obs.reasoningSteps) : null,
      evidenceIds: obs.evidenceIds ? JSON.parse(obs.evidenceIds) : null,
      affectedEntityIds: obs.affectedEntityIds ? JSON.parse(obs.affectedEntityIds) : null,
      historicalComparison: obs.historicalComparison ? JSON.parse(obs.historicalComparison) : null,
      location: obs.location ? JSON.parse(obs.location) : null,
    };
  }

  /**
   * Aggregate summary.
   */
  async summary() {
    const [
      total,
      byType,
      bySeverity,
      avgConfidence,
      withIntelEvents,
      recentObservations,
      trendSummary,
    ] = await Promise.all([
      db.aIObservation.count({ where: { status: "published" } }),
      db.aIObservation.groupBy({ by: ["type"], where: { status: "published" }, _count: true, _avg: { confidence: true } }),
      db.aIObservation.groupBy({ by: ["severity"], where: { status: "published" }, _count: true }),
      db.aIObservation.aggregate({ where: { status: "published" }, _avg: { confidence: true } }),
      db.aIObservation.count({ where: { status: "published", intelligenceEventId: { not: null } } }),
      db.aIObservation.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        where: { status: "published" },
      }),
      db.aIObservation.groupBy({ by: ["type"], where: { status: "published" }, _count: true, _max: { confidence: true }, _min: { confidence: true } }),
    ]);

    return {
      total,
      withIntelEvents,
      avgConfidence: avgConfidence._avg.confidence ?? 0,
      byType: byType.map((t) => ({ type: t.type, count: t._count, avgConfidence: t._avg.confidence ?? 0 })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
      trends: trendSummary.map((t) => ({
        type: t.type,
        count: t._count,
        minConfidence: t._min.confidence ?? 0,
        maxConfidence: t._max.confidence ?? 0,
      })),
      recent: recentObservations.map((o) => ({
        id: o.id,
        title: o.title,
        summary: o.summary,
        type: o.type,
        severity: o.severity,
        confidence: o.confidence,
        intelligenceEventId: o.intelligenceEventId,
        historicalComparison: o.historicalComparison ? JSON.parse(o.historicalComparison) : null,
        createdAt: o.createdAt,
      })),
    };
  }
}

let _svc: ObservationService | null = null;
export function getObservationService(): ObservationService {
  if (!_svc) _svc = new ObservationService();
  return _svc;
}
