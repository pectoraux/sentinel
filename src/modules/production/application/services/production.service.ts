/**
 * Sentinel — Production Readiness Service (M28)
 */
import { db } from "@/lib/db";
import { computeReadinessScore, type ReadinessDomain } from "../../domain/production-types";

export class ProductionService {
  async getReadinessPosture() {
    const allDomains = ["accessibility", "i18n", "offline", "mobile", "monitoring", "incident_response", "runbooks", "audit"] as ReadinessDomain[];
    const checks = await db.prodReadinessCheck.findMany({ select: { domain: true, status: true } });
    const domains = allDomains.map(domain => {
      const dc = checks.filter(c => c.domain === domain);
      const { score, level, color } = computeReadinessScore(dc);
      return { domain, score, level, color, total: dc.length, passed: dc.filter(c => c.status === "passed").length, warning: dc.filter(c => c.status === "warning").length, failed: dc.filter(c => c.status === "failed").length };
    });
    const overallScore = domains.length > 0 ? Math.round(domains.reduce((s, d) => s + d.score, 0) / domains.length) : 0;
    return { overallScore, level: overallScore >= 95 ? "Production Ready" : overallScore >= 80 ? "Nearly Ready" : overallScore >= 60 ? "Needs Work" : "Not Ready", color: overallScore >= 95 ? "#22c55e" : overallScore >= 80 ? "#0ea5e9" : overallScore >= 60 ? "#f59e0b" : "#ef4444", domains };
  }

  async listIncidents(params?: { severity?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    return { incidents: await db.incidentReport.findMany({ where, take: limit, orderBy: { detectedAt: "desc" } }) };
  }

  async listRunbooks(params?: { category?: string; limit?: number }) {
    const { limit = 50, category } = params ?? {};
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    return { runbooks: await db.runbook.findMany({ where, take: limit, orderBy: { updatedAt: "desc" } }) };
  }

  async listAccessibilityAudits() {
    return { audits: await db.accessibilityAudit.findMany({ take: 50, orderBy: { auditedAt: "desc" } }) };
  }

  async listI18nLocales() {
    return { locales: await db.i18nLocale.findMany({ orderBy: { translationPct: "desc" } }) };
  }

  async listDeployments(params?: { environment?: string; limit?: number }) {
    const { limit = 20, environment } = params ?? {};
    const where: Record<string, unknown> = {};
    if (environment) where.environment = environment;
    return { deployments: await db.deploymentPipeline.findMany({ where, take: limit, orderBy: { createdAt: "desc" } }) };
  }

  async summary() {
    const posture = await this.getReadinessPosture();
    const [totalChecks, passedChecks, failedChecks, warningChecks, totalIncidents, activeIncidents, sev1Count, totalRunbooks, totalAudits, totalLocales, activeLocales, totalDeployments, prodDeploys, recentIncidents, recentDeployments, audits, locales] = await Promise.all([
      db.prodReadinessCheck.count(),
      db.prodReadinessCheck.count({ where: { status: "passed" } }),
      db.prodReadinessCheck.count({ where: { status: "failed" } }),
      db.prodReadinessCheck.count({ where: { status: "warning" } }),
      db.incidentReport.count(),
      db.incidentReport.count({ where: { status: { notIn: ["resolved", "postmortem"] } } }),
      db.incidentReport.count({ where: { severity: "SEV1" } }),
      db.runbook.count({ where: { status: "active" } }),
      db.accessibilityAudit.count(),
      db.i18nLocale.count(),
      db.i18nLocale.count({ where: { status: "active" } }),
      db.deploymentPipeline.count(),
      db.deploymentPipeline.count({ where: { environment: "production", status: "success" } }),
      db.incidentReport.findMany({ take: 8, orderBy: { detectedAt: "desc" }, select: { id: true, key: true, title: true, severity: true, status: true, affectedUsers: true, detectedAt: true, mttrMinutes: true, oncallEngineer: true } }),
      db.deploymentPipeline.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { id: true, key: true, name: true, environment: true, status: true, version: true, branch: true, durationSec: true, triggeredBy: true, triggeredAt: true, completedAt: true } }),
      db.accessibilityAudit.findMany({ take: 6, orderBy: { auditedAt: "desc" }, select: { id: true, key: true, title: true, pageUrl: true, targetLevel: true, totalChecks: true, passedChecks: true, failedChecks: true, complianceScore: true, achievedLevel: true, status: true, auditedAt: true } }),
      db.i18nLocale.findMany({ orderBy: { translationPct: "desc" }, select: { id: true, locale: true, language: true, nativeName: true, direction: true, translationPct: true, status: true, totalKeys: true, translatedKeys: true, missingKeys: true } }),
    ]);
    // Compute avg MTTR
    const resolvedIncidents = await db.incidentReport.findMany({ where: { mttrMinutes: { not: null } }, select: { mttrMinutes: true } });
    const avgMttr = resolvedIncidents.length > 0 ? Math.round(resolvedIncidents.reduce((s, i) => s + (i.mttrMinutes ?? 0), 0) / resolvedIncidents.length) : 0;
    // Compute avg accessibility score
    const auditScores = audits.length > 0 ? audits.reduce((s, a) => s + a.complianceScore, 0) / audits.length : 0;
    return {
      overallScore: posture.overallScore, level: posture.level, color: posture.color,
      totalChecks, passedChecks, failedChecks, warningChecks,
      totalIncidents, activeIncidents, sev1Count, avgMttr,
      totalRunbooks, totalAudits, avgAccessibilityScore: Math.round(auditScores),
      totalLocales, activeLocales,
      totalDeployments, prodDeploys,
      domains: posture.domains,
      recentIncidents, recentDeployments, audits, locales,
    };
  }
}

let _svc: ProductionService | null = null;
export function getProductionService(): ProductionService { if (!_svc) _svc = new ProductionService(); return _svc; }
