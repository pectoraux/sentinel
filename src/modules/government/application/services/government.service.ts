/**
 * Sentinel — Government Operations Center Service
 * =============================================================================
 * Three-tier government dashboard (National → Regional → District) with
 * investigation workflow, inspection workflow, and case management.
 *
 * The dashboard aggregates data from:
 *   - Investigations (this module)
 *   - Inspections (this module)
 *   - Cases (this module)
 *   - Intelligence Events (M8)
 *   - Fraud Alerts (M21)
 *   - Missions (M19)
 *   - Evidence (M7)
 *
 * Workflows:
 *   - Investigation: create → addStep → review → recommendAction → close
 *   - Inspection: schedule → conduct → addFindings → complete
 *   - Case: file → addEvent → linkInvestigations → adjudicate → close
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  aggregateDashboardMetrics,
  computeSlaStatus,
  type DashboardLevel,
  type Priority,
} from "../../domain/government-types";

export class GovernmentService {
  // ===========================================================================
  // DASHBOARD — National, Regional, District
  // ===========================================================================

  /**
   * Get the national dashboard — country-wide overview.
   */
  async getNationalDashboard(): Promise<{
    level: "national";
    metrics: ReturnType<typeof aggregateDashboardMetrics>;
    regions: Array<{ region: string; investigations: number; inspections: number; cases: number; complianceScore: number }>;
    agencies: Array<{ agencyId: string; agencyName: string; investigationCount: number; caseCount: number }>;
    recentInvestigations: any[];
    recentCases: any[];
  }> {
    const [investigations, inspections, cases, recentInvestigations, recentCases] = await Promise.all([
      db.investigation.findMany({
        select: { status: true, priority: true, level: true, region: true, district: true, estimatedImpactGHS: true, createdAt: true, closedAt: true, agencyId: true, agencyName: true },
      }),
      db.inspection.findMany({
        select: { status: true, complianceLevel: true, violationCount: true, region: true, district: true, scheduledAt: true, completedAt: true },
      }),
      db.case.findMany({
        select: { status: true, priority: true, type: true, level: true, region: true, district: true, estimatedDamagesGHS: true, finesImposedGHS: true, filedAt: true, closedAt: true, resolution: true },
      }),
      db.investigation.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { _count: { select: { steps: true, inspections: true } } } }),
      db.case.findMany({ take: 8, orderBy: { filedAt: "desc" }, include: { _count: { select: { investigations: true, events: true } } } }),
    ]);

    const metrics = aggregateDashboardMetrics({ investigations, inspections, cases });

    // Regional breakdown
    const regionMap = new Map<string, { investigations: number; inspections: number; cases: number; complianceSum: number; complianceCount: number }>();
    for (const inv of investigations) {
      if (!inv.region) continue;
      if (!regionMap.has(inv.region)) regionMap.set(inv.region, { investigations: 0, inspections: 0, cases: 0, complianceSum: 0, complianceCount: 0 });
      regionMap.get(inv.region)!.investigations++;
    }
    for (const insp of inspections) {
      if (!insp.region) continue;
      if (!regionMap.has(insp.region)) regionMap.set(insp.region, { investigations: 0, inspections: 0, cases: 0, complianceSum: 0, complianceCount: 0 });
      const r = regionMap.get(insp.region)!;
      r.inspections++;
      if (insp.status === "completed" && insp.complianceLevel) {
        r.complianceSum += insp.complianceLevel === "compliant" ? 1 : insp.complianceLevel === "minor_violations" ? 0.5 : 0;
        r.complianceCount++;
      }
    }
    for (const c of cases) {
      if (!c.region) continue;
      if (!regionMap.has(c.region)) regionMap.set(c.region, { investigations: 0, inspections: 0, cases: 0, complianceSum: 0, complianceCount: 0 });
      regionMap.get(c.region)!.cases++;
    }

    const regions = Array.from(regionMap.entries()).map(([region, data]) => ({
      region,
      investigations: data.investigations,
      inspections: data.inspections,
      cases: data.cases,
      complianceScore: data.complianceCount > 0 ? Math.round((data.complianceSum / data.complianceCount) * 100) / 100 : 1.0,
    }));

    // Agency breakdown
    const agencyMap = new Map<string, { agencyName: string; investigationCount: number; caseCount: number }>();
    for (const inv of investigations) {
      if (!inv.agencyId) continue;
      if (!agencyMap.has(inv.agencyId)) agencyMap.set(inv.agencyId, { agencyName: inv.agencyName ?? "Unknown", investigationCount: 0, caseCount: 0 });
      agencyMap.get(inv.agencyId)!.investigationCount++;
    }
    for (const c of cases) {
      if (!c.level) continue;
      // Cases don't directly have agencyId in the query above; skip
    }
    const agencies = Array.from(agencyMap.entries()).map(([agencyId, data]) => ({ agencyId, ...data }));

    return {
      level: "national",
      metrics,
      regions,
      agencies,
      recentInvestigations: recentInvestigations.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status, priority: i.priority,
        region: i.region, district: i.district, agencyName: i.agencyName,
        stepCount: i._count.steps, inspectionCount: i._count.inspections,
        createdAt: i.createdAt,
      })),
      recentCases: recentCases.map((c) => ({
        id: c.id, key: c.key, caseNumber: c.caseNumber, title: c.title, type: c.type, status: c.status, priority: c.priority,
        region: c.region, district: c.district, leadAgencyName: c.leadAgencyName,
        estimatedDamagesGHS: c.estimatedDamagesGHS, finesImposedGHS: c.finesImposedGHS,
        investigationCount: c._count.investigations, eventCount: c._count.events,
        filedAt: c.filedAt,
      })),
    };
  }

  /**
   * Get a regional dashboard — single region overview.
   */
  async getRegionalDashboard(region: string): Promise<{
    level: "regional";
    region: string;
    metrics: ReturnType<typeof aggregateDashboardMetrics>;
    districts: Array<{ district: string; investigations: number; inspections: number; cases: number }>;
    recentInvestigations: any[];
    recentInspections: any[];
  }> {
    const [investigations, inspections, cases, recentInvestigations, recentInspections] = await Promise.all([
      db.investigation.findMany({
        where: { region },
        select: { status: true, priority: true, level: true, region: true, district: true, estimatedImpactGHS: true, createdAt: true, closedAt: true },
      }),
      db.inspection.findMany({
        where: { region },
        select: { status: true, complianceLevel: true, violationCount: true, region: true, district: true, scheduledAt: true, completedAt: true },
      }),
      db.case.findMany({
        where: { region },
        select: { status: true, priority: true, type: true, level: true, region: true, district: true, estimatedDamagesGHS: true, finesImposedGHS: true, filedAt: true, closedAt: true, resolution: true },
      }),
      db.investigation.findMany({ where: { region }, take: 8, orderBy: { createdAt: "desc" }, include: { _count: { select: { steps: true, inspections: true } } } }),
      db.inspection.findMany({ where: { region }, take: 8, orderBy: { scheduledAt: "desc" }, include: { _count: { select: { findings: true } } } }),
    ]);

    const metrics = aggregateDashboardMetrics({ investigations, inspections, cases, filter: { level: "regional", region } });

    // District breakdown
    const districtMap = new Map<string, { investigations: number; inspections: number; cases: number }>();
    for (const inv of investigations) {
      if (!inv.district) continue;
      if (!districtMap.has(inv.district)) districtMap.set(inv.district, { investigations: 0, inspections: 0, cases: 0 });
      districtMap.get(inv.district)!.investigations++;
    }
    for (const insp of inspections) {
      if (!insp.district) continue;
      if (!districtMap.has(insp.district)) districtMap.set(insp.district, { investigations: 0, inspections: 0, cases: 0 });
      districtMap.get(insp.district)!.inspections++;
    }
    for (const c of cases) {
      if (!c.district) continue;
      if (!districtMap.has(c.district)) districtMap.set(c.district, { investigations: 0, inspections: 0, cases: 0 });
      districtMap.get(c.district)!.cases++;
    }

    const districts = Array.from(districtMap.entries()).map(([district, data]) => ({ district, ...data }));

    return {
      level: "regional",
      region,
      metrics,
      districts,
      recentInvestigations: recentInvestigations.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status, priority: i.priority,
        district: i.district, agencyName: i.agencyName, locationName: i.locationName,
        stepCount: i._count.steps, inspectionCount: i._count.inspections,
        createdAt: i.createdAt,
      })),
      recentInspections: recentInspections.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status,
        targetName: i.targetName, targetType: i.targetType, district: i.district,
        inspectorName: i.inspectorName, agencyName: i.agencyName,
        complianceLevel: i.complianceLevel, violationCount: i.violationCount,
        overallResult: i.overallResult,
        findingCount: i._count.findings,
        scheduledAt: i.scheduledAt, conductedAt: i.conductedAt, completedAt: i.completedAt,
      })),
    };
  }

  /**
   * Get a district dashboard — single district detail.
   */
  async getDistrictDashboard(region: string, district: string): Promise<{
    level: "district";
    region: string;
    district: string;
    metrics: ReturnType<typeof aggregateDashboardMetrics>;
    sites: Array<{ targetName: string; targetType: string; inspectionCount: number; violationCount: number; lastInspectedAt: Date | null }>;
    recentInvestigations: any[];
    recentInspections: any[];
  }> {
    const [investigations, inspections, cases, recentInvestigations, recentInspections] = await Promise.all([
      db.investigation.findMany({
        where: { region, district },
        select: { status: true, priority: true, level: true, region: true, district: true, estimatedImpactGHS: true, createdAt: true, closedAt: true },
      }),
      db.inspection.findMany({
        where: { region, district },
        select: { status: true, complianceLevel: true, violationCount: true, region: true, district: true, scheduledAt: true, completedAt: true, targetName: true, targetType: true },
      }),
      db.case.findMany({
        where: { region, district },
        select: { status: true, priority: true, type: true, level: true, region: true, district: true, estimatedDamagesGHS: true, finesImposedGHS: true, filedAt: true, closedAt: true, resolution: true },
      }),
      db.investigation.findMany({ where: { region, district }, take: 10, orderBy: { createdAt: "desc" }, include: { _count: { select: { steps: true, inspections: true } } } }),
      db.inspection.findMany({ where: { region, district }, take: 10, orderBy: { scheduledAt: "desc" }, include: { findings: { select: { findingType: true, severity: true, description: true } } } }),
    ]);

    const metrics = aggregateDashboardMetrics({ investigations, inspections, cases, filter: { level: "district", region, district } });

    // Sites in this district
    const siteMap = new Map<string, { targetType: string; inspectionCount: number; violationCount: number; lastInspectedAt: Date | null }>();
    for (const insp of inspections) {
      if (!insp.targetName) continue;
      if (!siteMap.has(insp.targetName)) {
        siteMap.set(insp.targetName, { targetType: insp.targetType ?? "unknown", inspectionCount: 0, violationCount: 0, lastInspectedAt: null });
      }
      const site = siteMap.get(insp.targetName)!;
      site.inspectionCount++;
      site.violationCount += insp.violationCount;
      if (insp.completedAt && (!site.lastInspectedAt || insp.completedAt > site.lastInspectedAt)) {
        site.lastInspectedAt = insp.completedAt;
      }
    }

    const sites = Array.from(siteMap.entries()).map(([targetName, data]) => ({ targetName, ...data }));

    return {
      level: "district",
      region,
      district,
      metrics,
      sites,
      recentInvestigations: recentInvestigations.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status, priority: i.priority,
        agencyName: i.agencyName, leadInvestigatorName: i.leadInvestigatorName, locationName: i.locationName,
        stepCount: i._count.steps, inspectionCount: i._count.inspections,
        createdAt: i.createdAt,
      })),
      recentInspections: recentInspections.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status,
        targetName: i.targetName, targetType: i.targetType,
        inspectorName: i.inspectorName, agencyName: i.agencyName,
        complianceLevel: i.complianceLevel, violationCount: i.violationCount,
        overallResult: i.overallResult,
        findingCount: i.findings.length,
        findings: i.findings,
        scheduledAt: i.scheduledAt, conductedAt: i.conductedAt, completedAt: i.completedAt,
      })),
    };
  }

  // ===========================================================================
  // INVESTIGATION WORKFLOW
  // ===========================================================================

  async createInvestigation(params: {
    title: string;
    description: string;
    type: string;
    priority?: string;
    triggerType: string;
    triggerId?: string;
    triggerDescription?: string;
    lat?: number;
    lng?: number;
    locationName?: string;
    region?: string;
    district?: string;
    level?: string;
    agencyId?: string;
    agencyName?: string;
    leadInvestigatorId?: string;
    leadInvestigatorName?: string;
    intelligenceEventId?: string;
    twinEntityId?: string;
    fraudAlertId?: string;
    estimatedImpactGHS?: number;
  }): Promise<{ investigationId: string }> {
    const key = `inv-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const investigation = await db.investigation.create({
      data: {
        key,
        title: params.title,
        description: params.description,
        type: params.type,
        priority: params.priority ?? "medium",
        triggerType: params.triggerType,
        triggerId: params.triggerId,
        triggerDescription: params.triggerDescription,
        lat: params.lat,
        lng: params.lng,
        locationName: params.locationName,
        region: params.region,
        district: params.district,
        level: params.level ?? "regional",
        agencyId: params.agencyId,
        agencyName: params.agencyName,
        leadInvestigatorId: params.leadInvestigatorId,
        leadInvestigatorName: params.leadInvestigatorName,
        assignedAt: params.leadInvestigatorId ? new Date() : null,
        intelligenceEventId: params.intelligenceEventId,
        twinEntityId: params.twinEntityId,
        fraudAlertId: params.fraudAlertId,
        estimatedImpactGHS: params.estimatedImpactGHS ?? 0,
        status: "open",
        metadata: JSON.stringify({ createdBy: params.leadInvestigatorId }),
      },
    });

    // Create the "opened" step
    await db.investigationStep.create({
      data: {
        investigationId: investigation.id,
        stepType: "opened",
        title: "Investigation Opened",
        description: params.description,
        performedById: params.leadInvestigatorId,
        performedByName: params.leadInvestigatorName,
        outcome: "Investigation formally opened",
      },
    });

    logger.info("government.investigation_created", { investigationId: investigation.id, type: params.type, priority: params.priority });
    return { investigationId: investigation.id };
  }

  async addInvestigationStep(params: {
    investigationId: string;
    stepType: string;
    title: string;
    description?: string;
    performedById?: string;
    performedByName?: string;
    evidence?: any;
    outcome?: string;
  }): Promise<{ stepId: string }> {
    const step = await db.investigationStep.create({
      data: {
        investigationId: params.investigationId,
        stepType: params.stepType,
        title: params.title,
        description: params.description,
        performedById: params.performedById,
        performedByName: params.performedByName,
        evidence: params.evidence ? JSON.stringify(params.evidence) : null,
        outcome: params.outcome,
      },
    });

    // Update investigation status based on step
    const statusMap: Record<string, string> = {
      opened: "open",
      evidence_collected: "investigating",
      witness_interviewed: "investigating",
      site_visited: "investigating",
      lab_analysis: "investigating",
      report_filed: "pending_review",
      reviewed: "recommended_action",
      escalated: "escalated",
      closed: "closed",
    };
    const newStatus = statusMap[params.stepType];
    if (newStatus) {
      const updateData: any = { status: newStatus };
      if (params.stepType === "closed") {
        updateData.closedAt = new Date();
        updateData.closedById = params.performedById;
      }
      await db.investigation.update({
        where: { id: params.investigationId },
        data: updateData,
      });
    }

    logger.info("government.investigation_step_added", { investigationId: params.investigationId, stepType: params.stepType });
    return { stepId: step.id };
  }

  async getInvestigation(id: string) {
    const investigation = await db.investigation.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { performedAt: "asc" } },
        inspections: { include: { _count: { select: { findings: true } } }, orderBy: { scheduledAt: "desc" } },
        cases: { include: { case: { select: { id: true, caseNumber: true, title: true, status: true } } } },
      },
    });
    if (!investigation) return null;
    return {
      ...investigation,
      findings: investigation.findings ? JSON.parse(investigation.findings) : null,
      metadata: investigation.metadata ? JSON.parse(investigation.metadata) : null,
      steps: investigation.steps.map((s) => ({
        ...s,
        evidence: s.evidence ? JSON.parse(s.evidence) : null,
      })),
    };
  }

  async listInvestigations(params?: {
    status?: string;
    type?: string;
    priority?: string;
    level?: string;
    region?: string;
    district?: string;
    limit?: number;
  }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;
    if (filters.level) where.level = filters.level;
    if (filters.region) where.region = filters.region;
    if (filters.district) where.district = filters.district;

    const investigations = await db.investigation.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { steps: true, inspections: true, cases: true } },
      },
    });

    // Compute SLA for each
    return {
      investigations: investigations.map((i) => {
        const sla = computeSlaStatus({
          filedAt: i.createdAt,
          priority: i.priority as Priority,
          closedAt: i.closedAt,
        });
        return { ...i, sla };
      }),
    };
  }

  // ===========================================================================
  // INSPECTION WORKFLOW
  // ===========================================================================

  async createInspection(params: {
    title: string;
    description?: string;
    type?: string;
    investigationId?: string;
    targetName: string;
    targetType?: string;
    twinEntityId?: string;
    lat?: number;
    lng?: number;
    locationName?: string;
    region?: string;
    district?: string;
    scheduledAt?: Date;
    inspectorId?: string;
    inspectorName?: string;
    agencyId?: string;
    agencyName?: string;
  }): Promise<{ inspectionId: string }> {
    const key = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inspection = await db.inspection.create({
      data: {
        key,
        title: params.title,
        description: params.description,
        type: params.type ?? "complaint_based",
        investigationId: params.investigationId,
        targetName: params.targetName,
        targetType: params.targetType,
        twinEntityId: params.twinEntityId,
        lat: params.lat,
        lng: params.lng,
        locationName: params.locationName,
        region: params.region,
        district: params.district,
        scheduledAt: params.scheduledAt,
        inspectorId: params.inspectorId,
        inspectorName: params.inspectorName,
        agencyId: params.agencyId,
        agencyName: params.agencyName,
        status: "scheduled",
      },
    });

    logger.info("government.inspection_created", { inspectionId: inspection.id, target: params.targetName });
    return { inspectionId: inspection.id };
  }

  async addInspectionFinding(params: {
    inspectionId: string;
    findingType: string;
    severity?: string;
    description: string;
    evidenceIds?: string[];
    lat?: number;
    lng?: number;
    violation?: string;
    penalty?: string;
  }): Promise<{ findingId: string }> {
    const finding = await db.inspectionFinding.create({
      data: {
        inspectionId: params.inspectionId,
        findingType: params.findingType,
        severity: params.severity ?? "medium",
        description: params.description,
        evidenceIds: params.evidenceIds ? JSON.stringify(params.evidenceIds) : null,
        lat: params.lat,
        lng: params.lng,
        violation: params.violation,
        penalty: params.penalty,
      },
    });

    // Increment violation count on inspection
    await db.inspection.update({
      where: { id: params.inspectionId },
      data: { violationCount: { increment: 1 } },
    });

    return { findingId: finding.id };
  }

  async completeInspection(params: {
    inspectionId: string;
    complianceLevel?: string;
    overallResult?: string;
    followUpRequired?: boolean;
    followUpDate?: Date;
    inspectorId?: string;
  }): Promise<{ inspectionId: string }> {
    const updateData: any = {
      status: "completed",
      completedAt: new Date(),
      conductedAt: new Date(),
    };
    if (params.complianceLevel) updateData.complianceLevel = params.complianceLevel;
    if (params.overallResult) updateData.overallResult = params.overallResult;
    if (params.followUpRequired !== undefined) updateData.followUpRequired = params.followUpRequired;
    if (params.followUpDate) updateData.followUpDate = params.followUpDate;

    await db.inspection.update({
      where: { id: params.inspectionId },
      data: updateData,
    });

    logger.info("government.inspection_completed", { inspectionId: params.inspectionId, compliance: params.complianceLevel });
    return { inspectionId: params.inspectionId };
  }

  async getInspection(id: string) {
    const inspection = await db.inspection.findUnique({
      where: { id },
      include: {
        findings: { orderBy: { severity: "desc" } },
        investigation: { select: { id: true, key: true, title: true, status: true } },
      },
    });
    if (!inspection) return null;
    return {
      ...inspection,
      metadata: inspection.metadata ? JSON.parse(inspection.metadata) : null,
      findings: inspection.findings.map((f) => ({
        ...f,
        evidenceIds: f.evidenceIds ? JSON.parse(f.evidenceIds) : null,
        photoUrls: f.photoUrls ? JSON.parse(f.photoUrls) : null,
      })),
    };
  }

  async listInspections(params?: {
    status?: string;
    type?: string;
    region?: string;
    district?: string;
    limit?: number;
  }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.region) where.region = filters.region;
    if (filters.district) where.district = filters.district;

    const inspections = await db.inspection.findMany({
      where,
      take: limit,
      orderBy: { scheduledAt: "desc" },
      include: { _count: { select: { findings: true } } },
    });

    return { inspections };
  }

  // ===========================================================================
  // CASE MANAGEMENT
  // ===========================================================================

  async createCase(params: {
    caseNumber: string;
    title: string;
    description: string;
    type: string;
    priority?: string;
    level?: string;
    region?: string;
    district?: string;
    leadAgencyId?: string;
    leadAgencyName?: string;
    prosecutingAgencyId?: string;
    prosecutingAgencyName?: string;
    defendantName?: string;
    defendantType?: string;
    lat?: number;
    lng?: number;
    locationName?: string;
    intelligenceEventId?: string;
    twinEntityId?: string;
    estimatedDamagesGHS?: number;
    investigationIds?: string[];
  }): Promise<{ caseId: string }> {
    const key = `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const caseRecord = await db.case.create({
      data: {
        key,
        caseNumber: params.caseNumber,
        title: params.title,
        description: params.description,
        type: params.type,
        priority: params.priority ?? "medium",
        level: params.level ?? "regional",
        region: params.region,
        district: params.district,
        leadAgencyId: params.leadAgencyId,
        leadAgencyName: params.leadAgencyName,
        prosecutingAgencyId: params.prosecutingAgencyId,
        prosecutingAgencyName: params.prosecutingAgencyName,
        defendantName: params.defendantName,
        defendantType: params.defendantType,
        lat: params.lat,
        lng: params.lng,
        locationName: params.locationName,
        intelligenceEventId: params.intelligenceEventId,
        twinEntityId: params.twinEntityId,
        estimatedDamagesGHS: params.estimatedDamagesGHS ?? 0,
        status: "filed",
      },
    });

    // Create "filed" event
    await db.caseEvent.create({
      data: {
        caseId: caseRecord.id,
        eventType: "filed",
        title: "Case Filed",
        description: params.description,
        eventData: JSON.stringify({ caseNumber: params.caseNumber, priority: params.priority }),
      },
    });

    // Link investigations if provided
    if (params.investigationIds && params.investigationIds.length > 0) {
      for (const investigationId of params.investigationIds) {
        await db.caseInvestigation.create({
          data: { caseId: caseRecord.id, investigationId },
        }).catch(() => {}); // skip duplicates
      }
    }

    logger.info("government.case_created", { caseId: caseRecord.id, caseNumber: params.caseNumber });
    return { caseId: caseRecord.id };
  }

  async addCaseEvent(params: {
    caseId: string;
    eventType: string;
    title: string;
    description?: string;
    performedById?: string;
    performedByName?: string;
    eventData?: any;
  }): Promise<{ eventId: string }> {
    const event = await db.caseEvent.create({
      data: {
        caseId: params.caseId,
        eventType: params.eventType,
        title: params.title,
        description: params.description,
        performedById: params.performedById,
        performedByName: params.performedByName,
        eventData: params.eventData ? JSON.stringify(params.eventData) : null,
      },
    });

    // Update case status based on event
    const statusMap: Record<string, string> = {
      filed: "filed",
      assigned: "under_review",
      hearing_scheduled: "pending_hearing",
      evidence_submitted: "active",
      witness_added: "active",
      motion_filed: "active",
      ruling: "adjudicated",
      adjourned: "pending_hearing",
      settled: "closed",
      closed: "closed",
      appealed: "appealed",
    };
    const newStatus = statusMap[params.eventType];
    if (newStatus) {
      const updateData: any = { status: newStatus };
      if (params.eventType === "closed" || params.eventType === "settled") {
        updateData.closedAt = new Date();
      }
      await db.case.update({
        where: { id: params.caseId },
        data: updateData,
      });
    }

    return { eventId: event.id };
  }

  async getCase(id: string) {
    const caseRecord = await db.case.findUnique({
      where: { id },
      include: {
        events: { orderBy: { eventDate: "asc" } },
        investigations: { include: { investigation: { select: { id: true, key: true, title: true, type: true, status: true, priority: true, agencyName: true, createdAt: true } } } },
      },
    });
    if (!caseRecord) return null;
    return {
      ...caseRecord,
      metadata: caseRecord.metadata ? JSON.parse(caseRecord.metadata) : null,
      events: caseRecord.events.map((e) => ({
        ...e,
        eventData: e.eventData ? JSON.parse(e.eventData) : null,
      })),
    };
  }

  async listCases(params?: {
    status?: string;
    type?: string;
    priority?: string;
    level?: string;
    region?: string;
    district?: string;
    limit?: number;
  }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;
    if (filters.level) where.level = filters.level;
    if (filters.region) where.region = filters.region;
    if (filters.district) where.district = filters.district;

    const cases = await db.case.findMany({
      where,
      take: limit,
      orderBy: { filedAt: "desc" },
      include: { _count: { select: { investigations: true, events: true } } },
    });

    return {
      cases: cases.map((c) => {
        const sla = computeSlaStatus({
          filedAt: c.filedAt,
          priority: c.priority as Priority,
          closedAt: c.closedAt,
        });
        return { ...c, sla };
      }),
    };
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  async summary() {
    const [
      totalInvestigations,
      totalInspections,
      totalCases,
      investigationsByStatus,
      inspectionsByStatus,
      casesByStatus,
      casesByType,
      investigationsByPriority,
      casesByPriority,
      recentInvestigations,
      recentCases,
      recentInspections,
      totalEstimatedDamages,
      totalFinesImposed,
      totalEstimatedImpact,
      overdueCases,
      completedInspections,
      totalFindings,
    ] = await Promise.all([
      db.investigation.count(),
      db.inspection.count(),
      db.case.count(),
      db.investigation.groupBy({ by: ["status"], _count: true }),
      db.inspection.groupBy({ by: ["status"], _count: true }),
      db.case.groupBy({ by: ["status"], _count: true }),
      db.case.groupBy({ by: ["type"], _count: true }),
      db.investigation.groupBy({ by: ["priority"], _count: true }),
      db.case.groupBy({ by: ["priority"], _count: true }),
      db.investigation.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { _count: { select: { steps: true, inspections: true } } } }),
      db.case.findMany({ take: 5, orderBy: { filedAt: "desc" }, include: { _count: { select: { investigations: true, events: true } } } }),
      db.inspection.findMany({ take: 5, orderBy: { scheduledAt: "desc" }, include: { _count: { select: { findings: true } } } }),
      db.case.aggregate({ _sum: { estimatedDamagesGHS: true } }),
      db.case.aggregate({ _sum: { finesImposedGHS: true } }),
      db.investigation.aggregate({ _sum: { estimatedImpactGHS: true } }),
      db.case.count({ where: { status: { notIn: ["closed", "adjudicated"] } } }),
      db.inspection.count({ where: { status: "completed" } }),
      db.inspectionFinding.count(),
    ]);

    // Compute overdue cases (priority-based SLA)
    const openCases = await db.case.findMany({
      where: { status: { notIn: ["closed", "adjudicated"] } },
      select: { filedAt: true, priority: true },
    });
    const overdueCount = openCases.filter((c) => {
      const sla = computeSlaStatus({ filedAt: c.filedAt, priority: c.priority as Priority });
      return sla.status === "overdue";
    }).length;

    return {
      totalInvestigations,
      totalInspections,
      totalCases,
      completedInspections,
      totalFindings,
      overdueCases: overdueCount,
      totalEstimatedDamagesGHS: totalEstimatedDamages._sum.estimatedDamagesGHS ?? 0,
      totalFinesImposedGHS: totalFinesImposed._sum.finesImposedGHS ?? 0,
      totalEstimatedImpactGHS: totalEstimatedImpact._sum.estimatedImpactGHS ?? 0,
      investigationsByStatus: investigationsByStatus.map((s) => ({ status: s.status, count: s._count })),
      inspectionsByStatus: inspectionsByStatus.map((s) => ({ status: s.status, count: s._count })),
      casesByStatus: casesByStatus.map((s) => ({ status: s.status, count: s._count })),
      casesByType: casesByType.map((t) => ({ type: t.type, count: t._count })),
      investigationsByPriority: investigationsByPriority.map((p) => ({ priority: p.priority, count: p._count })),
      casesByPriority: casesByPriority.map((p) => ({ priority: p.priority, count: p._count })),
      recentInvestigations: recentInvestigations.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status, priority: i.priority,
        region: i.region, district: i.district, agencyName: i.agencyName,
        stepCount: i._count.steps, inspectionCount: i._count.inspections,
        createdAt: i.createdAt,
      })),
      recentCases: recentCases.map((c) => ({
        id: c.id, key: c.key, caseNumber: c.caseNumber, title: c.title, type: c.type, status: c.status, priority: c.priority,
        region: c.region, district: c.district, leadAgencyName: c.leadAgencyName,
        estimatedDamagesGHS: c.estimatedDamagesGHS, finesImposedGHS: c.finesImposedGHS,
        investigationCount: c._count.investigations, eventCount: c._count.events,
        filedAt: c.filedAt,
      })),
      recentInspections: recentInspections.map((i) => ({
        id: i.id, key: i.key, title: i.title, type: i.type, status: i.status,
        targetName: i.targetName, region: i.region, district: i.district,
        inspectorName: i.inspectorName, agencyName: i.agencyName,
        complianceLevel: i.complianceLevel, violationCount: i.violationCount,
        findingCount: i._count.findings,
        scheduledAt: i.scheduledAt, completedAt: i.completedAt,
      })),
    };
  }
}

let _svc: GovernmentService | null = null;
export function getGovernmentService(): GovernmentService {
  if (!_svc) _svc = new GovernmentService();
  return _svc;
}
