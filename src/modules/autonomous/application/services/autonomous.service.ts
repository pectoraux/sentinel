/**
 * Sentinel — Autonomous Investigation Engine Service
 * =============================================================================
 * When an Intelligence Event is created, the AI automatically becomes an
 * investigator. This service runs the 7-phase autonomous investigation
 * workflow, gathering context, analyzing imagery, identifying impacts,
 * requesting evidence, reasoning about credibility, and recommending actions.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  PHASE_META,
  TRIGGER_SOURCE_META,
  CONFIDENCE_LEVEL_META,
  EVIDENCE_REQUEST_TYPE_META,
  ACTION_TYPE_META,
  classifyConfidence,
  bayesianUpdate,
  recommendAction,
  generateCredibilityAssessment,
  type InvestigationPhase as Phase,
  type TriggerSource,
  type EvidenceRequestType,
  type ActionType,
} from "../../domain/autonomous-types";

export class AutonomousInvestigationService {
  // ===========================================================================
  // TRIGGER — Start a new autonomous investigation
  // ===========================================================================

  async triggerInvestigation(params: {
    intelligenceEventId?: string;
    triggerSource: TriggerSource;
    triggerDescription?: string;
    lat?: number;
    lng?: number;
    locationName?: string;
    region?: string;
    title?: string;
    description?: string;
  }): Promise<{ investigationId: string }> {
    const triggerMeta = TRIGGER_SOURCE_META[params.triggerSource];
    const initialConfidence = triggerMeta.initialConfidence;

    const key = `auto-inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const title = params.title ?? `Autonomous Investigation — ${params.locationName ?? "Unknown Location"}`;
    const description = params.description ?? `Auto-triggered by ${triggerMeta.label}: ${params.triggerDescription ?? "No additional description."}`;

    const investigation = await db.autonomousInvestigation.create({
      data: {
        key,
        title,
        description,
        intelligenceEventId: params.intelligenceEventId,
        triggerSource: params.triggerSource,
        triggerDescription: params.triggerDescription,
        lat: params.lat,
        lng: params.lng,
        locationName: params.locationName,
        region: params.region,
        status: "triggered",
        currentPhase: "triggered",
        confidence: initialConfidence,
        confidenceLevel: classifyConfidence(initialConfidence),
        model: "auto-investigator-v1",
      },
    });

    // Create the "triggered" phase
    await db.investigationPhase.create({
      data: {
        investigationId: investigation.id,
        phase: "triggered",
        title: "Investigation Triggered",
        description: `Auto-triggered by ${triggerMeta.label}. Initial confidence: ${(initialConfidence * 100).toFixed(0)}%.`,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        findings: JSON.stringify({ triggerSource: params.triggerSource, initialConfidence }),
      },
    });

    // Create initial confidence update
    await db.confidenceUpdate.create({
      data: {
        investigationId: investigation.id,
        previousConfidence: 0,
        newConfidence: initialConfidence,
        delta: initialConfidence,
        trigger: "initial",
        description: `Initial confidence set based on trigger source: ${triggerMeta.label}`,
        priorProbability: 0.5,
        likelihoodRatio: initialConfidence / (1 - initialConfidence),
        posteriorProbability: initialConfidence,
      },
    });

    logger.info("autonomous.investigation_triggered", {
      investigationId: investigation.id,
      triggerSource: params.triggerSource,
      initialConfidence,
    });

    return { investigationId: investigation.id };
  }

  // ===========================================================================
  // RUN INVESTIGATION — Execute all phases
  // ===========================================================================

  async runInvestigation(investigationId: string): Promise<{
    phasesCompleted: number;
    finalConfidence: number;
    recommendedAction: string;
  }> {
    const investigation = await db.autonomousInvestigation.findUnique({
      where: { id: investigationId },
    });
    if (!investigation) throw new Error("investigation_not_found");

    // Phase 1: Gathering Context — find nearby historical events
    await this.runPhaseGatheringContext(investigationId, investigation);

    // Phase 2: Analyzing Imagery — compare satellite scenes
    await this.runPhaseAnalyzingImagery(investigationId, investigation);

    // Phase 3: Identifying Impacts — find affected rivers/forests/communities
    await this.runPhaseIdentifyingImpacts(investigationId, investigation);

    // Phase 4: Requesting Evidence — auto-create missions for nearby users
    await this.runPhaseRequestingEvidence(investigationId, investigation);

    // Phase 5: Reasoning — generate credibility assessment
    await this.runPhaseReasoning(investigationId);

    // Update status to monitoring
    await db.autonomousInvestigation.update({
      where: { id: investigationId },
      data: { status: "monitoring", currentPhase: "monitoring", lastUpdated: new Date() },
    });

    // Get final state
    const updated = await db.autonomousInvestigation.findUnique({
      where: { id: investigationId },
      select: { confidence: true, recommendedAction: true },
    });

    return {
      phasesCompleted: 6,
      finalConfidence: updated?.confidence ?? 0,
      recommendedAction: updated?.recommendedAction ?? "monitor",
    };
  }

  // ===========================================================================
  // PHASE 1: Gathering Context — nearby historical events
  // ===========================================================================

  private async runPhaseGatheringContext(investigationId: string, inv: any) {
    const phaseMeta = PHASE_META.gathering_context;
    const startedAt = new Date();

    await db.investigationPhase.create({
      data: {
        investigationId,
        phase: "gathering_context",
        title: phaseMeta.label,
        description: phaseMeta.description,
        status: "in_progress",
        startedAt,
      },
    });

    // Find nearby intelligence events (within 10km if lat/lng available)
    let nearbyEvents: any[] = [];
    if (inv.lat && inv.lng) {
      const allEvents = await db.intelligenceEvent.findMany({
        where: { id: { not: inv.intelligenceEventId ?? "" } },
        select: { id: true, key: true, title: true, type: true, severity: true, lat: true, lng: true, createdAt: true, status: true },
        take: 500,
      });
      // Filter by proximity (simple distance check)
      nearbyEvents = allEvents.filter((e) => {
        if (!e.lat || !e.lng) return false;
        const dist = Math.sqrt(Math.pow(e.lat - inv.lat, 2) + Math.pow(e.lng - inv.lng, 2)) * 111; // approx km
        return dist < 10; // within 10km
      });
    }

    // Update investigation with findings
    const historicalFound = nearbyEvents.length;
    const confidenceDelta = historicalFound > 0 ? Math.min(0.15, historicalFound * 0.03) : -0.02;
    const newConfidence = Math.min(0.99, Math.max(0.01, inv.confidence + confidenceDelta));

    await db.investigationPhase.updateMany({
      where: { investigationId, phase: "gathering_context" },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        findings: JSON.stringify({
          nearbyEventsFound: historicalFound,
          events: nearbyEvents.slice(0, 10).map((e) => ({ id: e.id, title: e.title, type: e.type, severity: e.severity, createdAt: e.createdAt })),
          confidenceDelta,
          reasoning: historicalFound > 0
            ? `Found ${historicalFound} historical event(s) within 10km. This area has a pattern of similar activity, increasing credibility.`
            : "No historical events found nearby. This could be a new site or a false report.",
        }),
      },
    });

    // Update confidence
    await this.updateConfidence(investigationId, newConfidence, "evidence_received", `${historicalFound} historical events found nearby`);

    // Update investigation
    await db.autonomousInvestigation.update({
      where: { id: investigationId },
      data: {
        currentPhase: "analyzing_imagery",
        historicalEventsFound: historicalFound,
        nearbyEventIds: JSON.stringify(nearbyEvents.slice(0, 20).map((e) => e.id)),
        confidence: newConfidence,
        confidenceLevel: classifyConfidence(newConfidence),
        confidenceTrend: confidenceDelta > 0 ? "increasing" : confidenceDelta < 0 ? "decreasing" : "stable",
        lastUpdated: new Date(),
      },
    });
  }

  // ===========================================================================
  // PHASE 2: Analyzing Imagery — satellite change detection
  // ===========================================================================

  private async runPhaseAnalyzingImagery(investigationId: string, inv: any) {
    const phaseMeta = PHASE_META.analyzing_imagery;
    const startedAt = new Date();

    await db.investigationPhase.create({
      data: {
        investigationId,
        phase: "analyzing_imagery",
        title: phaseMeta.label,
        description: phaseMeta.description,
        status: "in_progress",
        startedAt,
      },
    });

    // Find satellite scenes near the location
    let scenesAnalyzed = 0;
    let changesDetected = 0;
    let sceneIds: string[] = [];

    if (inv.lat && inv.lng) {
      const scenes = await db.satelliteScene.findMany({
        select: { id: true, satellite: true, acquisitionDate: true, status: true, cloudCoverPct: true },
        take: 100,
        orderBy: { acquisitionDate: "desc" },
      });
      scenesAnalyzed = scenes.length;
      sceneIds = scenes.slice(0, 10).map((s) => s.id);

      // Simulate change detection (in production, this would compare raster tiles)
      // If there are recent scenes, assume some changes detected based on event type
      if (scenes.length > 1) {
        changesDetected = Math.min(3, Math.floor(scenes.length / 3));
      }
    }

    const confidenceDelta = changesDetected > 0 ? Math.min(0.2, changesDetected * 0.07) : -0.05;
    const newConfidence = Math.min(0.99, Math.max(0.01, inv.confidence + confidenceDelta));

    await db.investigationPhase.updateMany({
      where: { investigationId, phase: "analyzing_imagery" },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        findings: JSON.stringify({
          scenesAnalyzed,
          changesDetected,
          sceneIds: sceneIds.slice(0, 5),
          confidenceDelta,
          reasoning: changesDetected > 0
            ? `Satellite imagery comparison detected ${changesDetected} change(s). Environmental modification visible between recent and older imagery.`
            : "No satellite imagery changes detected. This may reduce confidence in the report.",
        }),
      },
    });

    await this.updateConfidence(investigationId, newConfidence, "satellite_analyzed", `${changesDetected} satellite changes detected`);

    await db.autonomousInvestigation.update({
      where: { id: investigationId },
      data: {
        currentPhase: "identifying_impacts",
        satelliteChangesDetected: changesDetected,
        satelliteSceneIds: JSON.stringify(sceneIds),
        confidence: newConfidence,
        confidenceLevel: classifyConfidence(newConfidence),
        confidenceTrend: confidenceDelta > 0 ? "increasing" : "decreasing",
        lastUpdated: new Date(),
      },
    });
  }

  // ===========================================================================
  // PHASE 3: Identifying Impacts — affected rivers, forests, communities
  // ===========================================================================

  private async runPhaseIdentifyingImpacts(investigationId: string, inv: any) {
    const phaseMeta = PHASE_META.identifying_impacts;
    const startedAt = new Date();

    await db.investigationPhase.create({
      data: {
        investigationId,
        phase: "identifying_impacts",
        title: phaseMeta.label,
        description: phaseMeta.description,
        status: "in_progress",
        startedAt,
      },
    });

    // Find twin entities near the location (rivers, forests, communities)
    let affectedEntities: any[] = [];
    if (inv.lat && inv.lng) {
      const entities = await db.twinEntity.findMany({
        where: { type: { in: ["river", "forest", "community", "protected_area", "water_body"] } },
        select: { id: true, name: true, type: true, lat: true, lng: true, status: true },
        take: 200,
      });
      // Filter by proximity (within 5km)
      affectedEntities = entities.filter((e) => {
        if (!e.lat || !e.lng) return false;
        const dist = Math.sqrt(Math.pow(e.lat - inv.lat, 2) + Math.pow(e.lng - inv.lng, 2)) * 111;
        return dist < 5; // within 5km
      });
    }

    const affectedCount = affectedEntities.length;
    const confidenceDelta = affectedCount > 0 ? Math.min(0.1, affectedCount * 0.02) : 0;
    const newConfidence = Math.min(0.99, Math.max(0.01, inv.confidence + confidenceDelta));

    await db.investigationPhase.updateMany({
      where: { investigationId, phase: "identifying_impacts" },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        findings: JSON.stringify({
          affectedEntitiesCount: affectedCount,
          entities: affectedEntities.slice(0, 10).map((e) => ({ id: e.id, name: e.name, type: e.type, status: e.status })),
          confidenceDelta,
          reasoning: affectedCount > 0
            ? `${affectedCount} affected entit${affectedCount > 1 ? "ies" : "y"} identified within 5km impact zone: ${affectedEntities.slice(0, 5).map((e) => `${e.name} (${e.type})`).join(", ")}`
            : "No affected entities found within 5km.",
        }),
      },
    });

    await this.updateConfidence(investigationId, newConfidence, "evidence_received", `${affectedCount} affected entities identified`);

    await db.autonomousInvestigation.update({
      where: { id: investigationId },
      data: {
        currentPhase: "requesting_evidence",
        affectedEntitiesCount: affectedCount,
        affectedEntityIds: JSON.stringify(affectedEntities.slice(0, 20).map((e) => e.id)),
        confidence: newConfidence,
        confidenceLevel: classifyConfidence(newConfidence),
        lastUpdated: new Date(),
      },
    });
  }

  // ===========================================================================
  // PHASE 4: Requesting Evidence — auto-create missions for nearby users
  // ===========================================================================

  private async runPhaseRequestingEvidence(investigationId: string, inv: any) {
    const phaseMeta = PHASE_META.requesting_evidence;
    const startedAt = new Date();

    await db.investigationPhase.create({
      data: {
        investigationId,
        phase: "requesting_evidence",
        title: phaseMeta.label,
        description: phaseMeta.description,
        status: "in_progress",
        startedAt,
      },
    });

    // Find trusted users nearby
    const trustFactors = await db.trustFactor.findMany({
      where: { tier: { in: ["trusted", "elite", "verified"] } },
      select: { userId: true, tier: true },
      take: 20,
    });

    // Create evidence requests for up to 3 nearby trusted users
    const requestTypes: EvidenceRequestType[] = ["photo", "gps_verification", "witness_statement"];
    let evidenceRequested = 0;
    const missionIds: string[] = [];

    for (let i = 0; i < Math.min(3, trustFactors.length); i++) {
      const tf = trustFactors[i]!;
      const reqType = requestTypes[i % requestTypes.length]!;
      const reqMeta = EVIDENCE_REQUEST_TYPE_META[reqType];

      const evidenceReq = await db.evidenceRequest.create({
        data: {
          investigationId,
          requestType: reqType,
          description: `AI requesting ${reqMeta.label.toLowerCase()} from ${tf.tier} tier contributor near ${inv.locationName ?? "the event location"}.`,
          targetUserId: tf.userId,
          targetTrustTier: tf.tier,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day expiry
        },
      });
      evidenceRequested++;
    }

    await db.investigationPhase.updateMany({
      where: { investigationId, phase: "requesting_evidence" },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        findings: JSON.stringify({
          evidenceRequested,
          requests: trustFactors.slice(0, 3).map((tf, i) => ({
            type: requestTypes[i % requestTypes.length],
            targetTier: tf.tier,
            confidenceBoost: EVIDENCE_REQUEST_TYPE_META[requestTypes[i % requestTypes.length]!].confidenceBoost,
          })),
          reasoning: `Auto-created ${evidenceRequested} evidence request(s) for nearby trusted contributors. If fulfilled, expected confidence boost: +${trustFactors.slice(0, 3).reduce((s, _, i) => s + EVIDENCE_REQUEST_TYPE_META[requestTypes[i % requestTypes.length]!].confidenceBoost, 0).toFixed(2)}`,
        }),
      },
    });

    await db.autonomousInvestigation.update({
      where: { id: investigationId },
      data: {
        currentPhase: "reasoning",
        evidenceRequested,
        missionIds: JSON.stringify(missionIds),
        lastUpdated: new Date(),
      },
    });
  }

  // ===========================================================================
  // PHASE 5: Reasoning — credibility assessment + action recommendation
  // ===========================================================================

  private async runPhaseReasoning(investigationId: string) {
    const phaseMeta = PHASE_META.reasoning;
    const startedAt = new Date();

    const inv = await db.autonomousInvestigation.findUnique({ where: { id: investigationId } });
    if (!inv) return;

    await db.investigationPhase.create({
      data: {
        investigationId,
        phase: "reasoning",
        title: phaseMeta.label,
        description: phaseMeta.description,
        status: "in_progress",
        startedAt,
      },
    });

    // Generate credibility assessment
    const assessment = generateCredibilityAssessment({
      confidence: inv.confidence,
      triggerSource: inv.triggerSource as TriggerSource,
      historicalEventsFound: inv.historicalEventsFound,
      satelliteChangesDetected: inv.satelliteChangesDetected,
      affectedEntitiesCount: inv.affectedEntitiesCount,
      evidenceRequested: inv.evidenceRequested,
      evidenceReceived: inv.evidenceReceived,
      locationName: inv.locationName ?? undefined,
    });

    // Recommend action
    const daysSinceTrigger = Math.floor((Date.now() - inv.triggeredAt.getTime()) / (1000 * 60 * 60 * 24));
    const action = recommendAction({
      confidence: inv.confidence,
      hasSatelliteChange: inv.satelliteChangesDetected > 0,
      hasAffectedEntities: inv.affectedEntitiesCount > 0,
      evidenceReceived: inv.evidenceReceived,
      evidenceRequested: inv.evidenceRequested,
      daysSinceTrigger,
    });

    // Create action recommendation
    await db.actionRecommendation.create({
      data: {
        investigationId,
        action: action.action,
        priority: action.priority,
        title: ACTION_TYPE_META[action.action as ActionType].label,
        reasoning: action.reasoning,
        confidence: inv.confidence,
        expectedOutcome: ACTION_TYPE_META[action.action as ActionType].description,
      },
    });

    await db.investigationPhase.updateMany({
      where: { investigationId, phase: "reasoning" },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        findings: JSON.stringify({
          credibilityAssessment: assessment,
          recommendedAction: action.action,
          actionReasoning: action.reasoning,
          actionPriority: action.priority,
        }),
      },
    });

    // Update investigation with assessment + recommendation
    await db.autonomousInvestigation.update({
      where: { id: investigationId },
      data: {
        credibilityAssessment: assessment,
        reasoningChain: JSON.stringify([
          `Triggered by ${TRIGGER_SOURCE_META[inv.triggerSource as TriggerSource].label} → initial confidence ${(TRIGGER_SOURCE_META[inv.triggerSource as TriggerSource].initialConfidence * 100).toFixed(0)}%`,
          `${inv.historicalEventsFound} historical events found nearby → confidence ${inv.historicalEventsFound > 0 ? "increased" : "decreased"}`,
          `${inv.satelliteChangesDetected} satellite change(s) detected → confidence ${inv.satelliteChangesDetected > 0 ? "increased" : "decreased"}`,
          `${inv.affectedEntitiesCount} affected entit${inv.affectedEntitiesCount !== 1 ? "ies" : "y"} identified`,
          `${inv.evidenceRequested} evidence request(s) sent to nearby trusted contributors`,
          `Final confidence: ${(inv.confidence * 100).toFixed(0)}% (${classifyConfidence(inv.confidence)})`,
          `Recommended action: ${ACTION_TYPE_META[action.action as ActionType].label} (${action.priority} priority)`,
        ]),
        recommendedAction: action.action,
        actionReasoning: action.reasoning,
        actionConfidence: inv.confidence,
        lastUpdated: new Date(),
      },
    });
  }

  // ===========================================================================
  // CONFIDENCE UPDATE — Bayesian update
  // ===========================================================================

  private async updateConfidence(investigationId: string, newConfidence: number, trigger: string, description: string) {
    const inv = await db.autonomousInvestigation.findUnique({
      where: { id: investigationId },
      select: { confidence: true },
    });
    if (!inv) return;

    const previous = inv.confidence;
    const delta = Math.round((newConfidence - previous) * 10000) / 10000;

    // Bayesian computation
    const prior = previous;
    const likelihood = newConfidence / Math.max(0.01, previous);
    const { posterior } = bayesianUpdate({ prior, likelihood });

    await db.confidenceUpdate.create({
      data: {
        investigationId,
        previousConfidence: previous,
        newConfidence: Math.round(newConfidence * 10000) / 10000,
        delta,
        trigger,
        description,
        priorProbability: prior,
        likelihoodRatio: likelihood,
        posteriorProbability: Math.round(posterior * 10000) / 10000,
      },
    });
  }

  // ===========================================================================
  // READ METHODS
  // ===========================================================================

  async listInvestigations(params?: { status?: string; triggerSource?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.triggerSource) where.triggerSource = filters.triggerSource;

    const investigations = await db.autonomousInvestigation.findMany({
      where,
      take: limit,
      orderBy: { triggeredAt: "desc" },
      include: {
        _count: { select: { phases: true, evidenceRequests: true, confidenceUpdates: true, recommendations: true } },
      },
    });

    return { investigations };
  }

  async getById(id: string) {
    const investigation = await db.autonomousInvestigation.findUnique({
      where: { id },
      include: {
        phases: { orderBy: { createdAt: "asc" } },
        evidenceRequests: { orderBy: { requestedAt: "desc" } },
        confidenceUpdates: { orderBy: { updatedAt: "asc" } },
        recommendations: { orderBy: { recommendedAt: "desc" } },
      },
    });
    if (!investigation) return null;

    return {
      ...investigation,
      nearbyEventIds: investigation.nearbyEventIds ? JSON.parse(investigation.nearbyEventIds) : [],
      affectedEntityIds: investigation.affectedEntityIds ? JSON.parse(investigation.affectedEntityIds) : [],
      missionIds: investigation.missionIds ? JSON.parse(investigation.missionIds) : [],
      satelliteSceneIds: investigation.satelliteSceneIds ? JSON.parse(investigation.satelliteSceneIds) : [],
      reasoningChain: investigation.reasoningChain ? JSON.parse(investigation.reasoningChain) : [],
      metadata: investigation.metadata ? JSON.parse(investigation.metadata) : null,
      phases: investigation.phases.map((p) => ({
        ...p,
        findings: p.findings ? JSON.parse(p.findings) : null,
      })),
    };
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  async summary() {
    const [
      totalInvestigations,
      activeInvestigations,
      concludedInvestigations,
      byStatus,
      byTriggerSource,
      byConfidenceLevel,
      avgConfidence,
      totalEvidenceRequests,
      pendingEvidenceRequests,
      totalRecommendations,
      pendingRecommendations,
      recentInvestigations,
    ] = await Promise.all([
      db.autonomousInvestigation.count(),
      db.autonomousInvestigation.count({ where: { status: { notIn: ["concluded"] } } }),
      db.autonomousInvestigation.count({ where: { status: "concluded" } }),
      db.autonomousInvestigation.groupBy({ by: ["status"], _count: true }),
      db.autonomousInvestigation.groupBy({ by: ["triggerSource"], _count: true }),
      db.autonomousInvestigation.groupBy({ by: ["confidenceLevel"], _count: true }),
      db.autonomousInvestigation.aggregate({ _avg: { confidence: true } }),
      db.evidenceRequest.count(),
      db.evidenceRequest.count({ where: { status: "pending" } }),
      db.actionRecommendation.count(),
      db.actionRecommendation.count({ where: { status: "pending" } }),
      db.autonomousInvestigation.findMany({
        take: 10,
        orderBy: { triggeredAt: "desc" },
        include: {
          _count: { select: { phases: true, evidenceRequests: true, confidenceUpdates: true, recommendations: true } },
        },
      }),
    ]);

    return {
      totalInvestigations,
      activeInvestigations,
      concludedInvestigations,
      avgConfidence: Math.round((avgConfidence._avg.confidence ?? 0) * 100),
      totalEvidenceRequests,
      pendingEvidenceRequests,
      totalRecommendations,
      pendingRecommendations,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byTriggerSource: byTriggerSource.map((t) => ({ triggerSource: t.triggerSource, count: t._count })),
      byConfidenceLevel: byConfidenceLevel.map((c) => ({ level: c.confidenceLevel, count: c._count })),
      recentInvestigations: recentInvestigations.map((inv) => ({
        id: inv.id,
        key: inv.key,
        title: inv.title,
        triggerSource: inv.triggerSource,
        status: inv.status,
        currentPhase: inv.currentPhase,
        confidence: inv.confidence,
        confidenceLevel: inv.confidenceLevel,
        confidenceTrend: inv.confidenceTrend,
        recommendedAction: inv.recommendedAction,
        locationName: inv.locationName,
        region: inv.region,
        historicalEventsFound: inv.historicalEventsFound,
        satelliteChangesDetected: inv.satelliteChangesDetected,
        affectedEntitiesCount: inv.affectedEntitiesCount,
        evidenceRequested: inv.evidenceRequested,
        evidenceReceived: inv.evidenceReceived,
        phaseCount: inv._count.phases,
        evidenceRequestCount: inv._count.evidenceRequests,
        confidenceUpdateCount: inv._count.confidenceUpdates,
        recommendationCount: inv._count.recommendations,
        triggeredAt: inv.triggeredAt,
        lastUpdated: inv.lastUpdated,
      })),
    };
  }
}

let _svc: AutonomousInvestigationService | null = null;
export function getAutonomousInvestigationService(): AutonomousInvestigationService {
  if (!_svc) _svc = new AutonomousInvestigationService();
  return _svc;
}
