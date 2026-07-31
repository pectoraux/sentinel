/**
 * Sentinel — Security Hardening Service
 * =============================================================================
 * Computes security posture across 10 domains. Tracks threats, backups,
 * pen tests, secret rotations, and disaster recovery readiness.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  DOMAIN_META,
  SEVERITY_META,
  THREAT_TYPE_META,
  computeSecurityScore,
  computeBackupHealth,
  computeDrReadiness,
  type SecurityDomain,
  type Severity,
} from "../../domain/security-types";

export class SecurityService {
  // ===========================================================================
  // SECURITY POSTURE — all 10 domains
  // ===========================================================================

  async getSecurityPosture(): Promise<{
    overallScore: number;
    level: string;
    color: string;
    domains: Array<{
      domain: SecurityDomain;
      label: string;
      color: string;
      icon: string;
      description: string;
      complianceScore: number;
      violationCount: number;
      activeThreats: number;
      policyCount: number;
      lastEventAt: Date | null;
    }>;
  }> {
    // Get all active policies grouped by domain
    const policies = await db.securityPolicy.findMany({
      where: { isActive: true },
      select: { domain: true, complianceScore: true, violationCount: true, lastViolatedAt: true },
    });

    // Get active threats per domain
    const threats = await db.threatIndicator.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get recent security events per domain
    const eventsByDomain = await db.securityEvent.groupBy({
      by: ["domain"],
      _count: true,
      _max: { detectedAt: true },
    });

    // Get active (non-resolved) events per domain
    const activeEventsByDomain = await db.securityEvent.groupBy({
      by: ["domain"],
      where: { status: "active" },
      _count: true,
    });

    // Build domain list
    const allDomains = Object.keys(DOMAIN_META) as SecurityDomain[];
    const domainData = allDomains.map((domain) => {
      const meta = DOMAIN_META[domain];
      const domainPolicies = policies.filter((p) => p.domain === domain);
      const avgCompliance = domainPolicies.length > 0
        ? domainPolicies.reduce((s, p) => s + p.complianceScore, 0) / domainPolicies.length
        : 1.0;
      const violations = domainPolicies.reduce((s, p) => s + p.violationCount, 0);
      const activeThreats = activeEventsByDomain.find((e) => e.domain === domain)?._count ?? 0;
      const lastEvent = eventsByDomain.find((e) => e.domain === domain)?._max.detectedAt ?? null;

      return {
        domain,
        label: meta.label,
        color: meta.color,
        icon: meta.icon,
        description: meta.description,
        complianceScore: avgCompliance,
        violationCount: violations,
        activeThreats,
        policyCount: domainPolicies.length,
        lastEventAt: lastEvent,
      };
    });

    // Compute overall score
    const { score, level, color } = computeSecurityScore(domainData);

    return { overallScore: score, level, color, domains: domainData };
  }

  // ===========================================================================
  // THREATS
  // ===========================================================================

  async listThreats(params?: { status?: string; severity?: string; type?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.type) where.type = filters.type;

    const threats = await db.threatIndicator.findMany({
      where,
      take: limit,
      orderBy: { detectedAt: "desc" },
    });

    return { threats };
  }

  // ===========================================================================
  // BACKUPS
  // ===========================================================================

  async listBackups(params?: { status?: string; target?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.target) where.target = filters.target;

    const backups = await db.backupRecord.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return { backups };
  }

  async getBackupHealth() {
    const backups = await db.backupRecord.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      select: { status: true, verifiedAt: true, encrypted: true, completedAt: true, sizeBytes: true },
    });

    const health = computeBackupHealth(backups);
    const lastCompleted = backups.find((b) => b.status === "completed" || b.status === "verified");

    return {
      score: health.score,
      encrypted: health.encrypted,
      totalBackups: backups.length,
      completedBackups: backups.filter((b) => b.status === "completed" || b.status === "verified").length,
      verifiedBackups: backups.filter((b) => b.verifiedAt !== null).length,
      lastBackupAt: lastCompleted?.completedAt ?? null,
      lastBackupSize: lastCompleted?.sizeBytes ?? 0,
    };
  }

  // ===========================================================================
  // PEN TESTS
  // ===========================================================================

  async listPenTests(params?: { type?: string; remediationStatus?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.remediationStatus) where.remediationStatus = filters.remediationStatus;

    const reports = await db.penTestReport.findMany({
      where,
      take: limit,
      orderBy: { testDate: "desc" },
    });

    return { reports };
  }

  // ===========================================================================
  // SECRET ROTATIONS
  // ===========================================================================

  async listSecretRotations(params?: { secretType?: string; rotationStatus?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.secretType) where.secretType = filters.secretType;
    if (filters.rotationStatus) where.rotationStatus = filters.rotationStatus;

    const rotations = await db.secretRotation.findMany({
      where,
      take: limit,
      orderBy: { nextRotationAt: "asc" },
    });

    return { rotations };
  }

  // ===========================================================================
  // DR PLANS
  // ===========================================================================

  async listDrPlans() {
    const plans = await db.disasterRecoveryPlan.findMany({
      where: { isActive: true },
      orderBy: { readinessScore: "desc" },
    });

    return {
      plans: plans.map((p) => {
        const readiness = computeDrReadiness({
          readinessScore: p.readinessScore,
          lastTestedAt: p.lastTestedAt,
          lastTestStatus: p.lastTestStatus,
        });
        return { ...p, computedScore: readiness.score, computedStatus: readiness.status, computedColor: readiness.color };
      }),
    };
  }

  // ===========================================================================
  // SECURITY EVENTS
  // ===========================================================================

  async listEvents(params?: { domain?: string; severity?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.domain) where.domain = filters.domain;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const events = await db.securityEvent.findMany({
      where,
      take: limit,
      orderBy: { detectedAt: "desc" },
    });

    return { events };
  }

  // ===========================================================================
  // POLICIES
  // ===========================================================================

  async listPolicies(params?: { domain?: string; isActive?: boolean; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.domain) where.domain = filters.domain;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const policies = await db.securityPolicy.findMany({
      where,
      take: limit,
      orderBy: { complianceScore: "asc" },
    });

    return {
      policies: policies.map((p) => ({
        ...p,
        config: p.config ? JSON.parse(p.config) : null,
        metadata: p.metadata ? JSON.parse(p.metadata) : null,
      })),
    };
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  async summary() {
    const posture = await this.getSecurityPosture();

    const [
      totalEvents,
      activeEvents,
      criticalEvents,
      totalThreats,
      blockedThreats,
      totalBackups,
      completedBackups,
      totalPenTests,
      pendingRemediation,
      totalSecrets,
      pendingRotations,
      totalDrPlans,
      readyDrPlans,
      totalPolicies,
      activePolicies,
      recentThreats,
      recentEvents,
      recentBackups,
      recentPenTests,
    ] = await Promise.all([
      db.securityEvent.count(),
      db.securityEvent.count({ where: { status: "active" } }),
      db.securityEvent.count({ where: { severity: "critical", status: "active" } }),
      db.threatIndicator.count(),
      db.threatIndicator.count({ where: { status: "blocked" } }),
      db.backupRecord.count(),
      db.backupRecord.count({ where: { status: { in: ["completed", "verified"] } } }),
      db.penTestReport.count(),
      db.penTestReport.count({ where: { remediationStatus: { in: ["pending", "in_progress"] } } }),
      db.secretRotation.count(),
      db.secretRotation.count({ where: { rotationStatus: "scheduled" } }),
      db.disasterRecoveryPlan.count({ where: { isActive: true } }),
      db.disasterRecoveryPlan.count({ where: { isActive: true, readinessStatus: "ready" } }),
      db.securityPolicy.count(),
      db.securityPolicy.count({ where: { isActive: true } }),
      db.threatIndicator.findMany({ take: 8, orderBy: { detectedAt: "desc" } }),
      db.securityEvent.findMany({ take: 8, orderBy: { detectedAt: "desc" } }),
      db.backupRecord.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { id: true, key: true, type: true, target: true, status: true, sizeBytes: true, encrypted: true, completedAt: true, verificationStatus: true, createdAt: true } }),
      db.penTestReport.findMany({ take: 5, orderBy: { testDate: "desc" }, select: { id: true, key: true, title: true, type: true, testDate: true, criticalCount: true, highCount: true, mediumCount: true, lowCount: true, totalFindings: true, remediationStatus: true, remediatedCount: true } }),
    ]);

    const backupHealth = await this.getBackupHealth();

    return {
      // Overall posture
      overallScore: posture.overallScore,
      level: posture.level,
      color: posture.color,
      domainCount: posture.domains.length,

      // Events
      totalEvents,
      activeEvents,
      criticalEvents,

      // Threats
      totalThreats,
      blockedThreats,
      activeThreats: totalThreats - blockedThreats,
      blockRate: totalThreats > 0 ? Math.round((blockedThreats / totalThreats) * 100) : 0,

      // Backups
      totalBackups,
      completedBackups,
      backupHealthScore: backupHealth.score,
      backupEncrypted: backupHealth.encrypted,
      lastBackupAt: backupHealth.lastBackupAt,

      // Pen tests
      totalPenTests,
      pendingRemediation,
      openFindings: recentPenTests.reduce((s, p) => s + (p.totalFindings - p.remediatedCount), 0),

      // Secrets
      totalSecrets,
      pendingRotations,

      // DR
      totalDrPlans,
      readyDrPlans,

      // Policies
      totalPolicies,
      activePolicies,

      // Recent items
      recentThreats: recentThreats.map((t) => ({
        id: t.id, type: t.type, severity: t.severity, status: t.status,
        title: t.title, sourceIp: t.sourceIp, sourceCountry: t.sourceCountry,
        targetEndpoint: t.targetEndpoint, detectionMethod: t.detectionMethod,
        confidence: t.confidence, detectedAt: t.detectedAt,
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id, domain: e.domain, type: e.type, severity: e.severity, status: e.status,
        title: e.title, sourceIp: e.sourceIp, targetResource: e.targetResource,
        detectedAt: e.detectedAt,
      })),
      recentBackups: recentBackups.map((b) => ({
        id: b.id, key: b.key, type: b.type, target: b.target, status: b.status,
        sizeBytes: b.sizeBytes, encrypted: b.encrypted,
        verificationStatus: b.verificationStatus,
        completedAt: b.completedAt, createdAt: b.createdAt,
      })),
      recentPenTests: recentPenTests.map((p) => ({
        id: p.id, key: p.key, title: p.title, type: p.type,
        testDate: p.testDate,
        criticalCount: p.criticalCount, highCount: p.highCount,
        mediumCount: p.mediumCount, lowCount: p.lowCount,
        totalFindings: p.totalFindings,
        remediationStatus: p.remediationStatus, remediatedCount: p.remediatedCount,
      })),

      // Domain breakdown
      domains: posture.domains.map((d) => ({
        domain: d.domain,
        label: d.label,
        color: d.color,
        icon: d.icon,
        complianceScore: Math.round(d.complianceScore * 100),
        violationCount: d.violationCount,
        activeThreats: d.activeThreats,
        policyCount: d.policyCount,
      })),
    };
  }
}

let _svc: SecurityService | null = null;
export function getSecurityService(): SecurityService {
  if (!_svc) _svc = new SecurityService();
  return _svc;
}
