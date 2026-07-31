/**
 * Sentinel — Production Readiness Domain (M28)
 * 8 domains: accessibility, i18n, offline, mobile, monitoring, incident_response, runbooks, audit
 */
export type ReadinessDomain = "accessibility" | "i18n" | "offline" | "mobile" | "monitoring" | "incident_response" | "runbooks" | "audit";

export const DOMAIN_META: Record<ReadinessDomain, { label: string; color: string; icon: string; description: string }> = {
  accessibility: { label: "Accessibility", color: "#0ea5e9", icon: "Accessibility", description: "WCAG 2.1 AA compliance, screen reader support, keyboard navigation, color contrast." },
  i18n: { label: "Internationalization", color: "#22c55e", icon: "Languages", description: "Multi-language support (English, French, Swahili, Twi, Hausa), RTL, locale formatting." },
  offline: { label: "Offline-First", color: "#f59e0b", icon: "WifiOff", description: "PWA with service worker, offline data sync, conflict resolution, background sync." },
  mobile: { label: "Mobile Optimization", color: "#a855f7", icon: "Smartphone", description: "Responsive design, touch-optimized, mobile performance, app-like experience." },
  monitoring: { label: "Monitoring", color: "#14b8a6", icon: "Activity", description: "Observability, alerting, dashboards, SLO/SLI tracking, distributed tracing." },
  incident_response: { label: "Incident Response", color: "#ef4444", icon: "Siren", description: "SEV1-5 severity, on-call rotation, MTTR tracking, postmortem, action items." },
  runbooks: { label: "Operational Runbooks", color: "#6366f1", icon: "BookOpen", description: "Documented procedures for deployment, scaling, recovery, security, maintenance." },
  audit: { label: "Final Production Audit", color: "#ec4899", icon: "ClipboardCheck", description: "Comprehensive go/no-go checklist covering all domains before production launch." },
};

export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4" | "SEV5";
export const SEVERITY_META: Record<IncidentSeverity, { label: string; color: string; sla: string; description: string }> = {
  SEV1: { label: "SEV1 — Critical", color: "#dc2626", sla: "15 min ack, 1h resolve", description: "Total platform outage. All users affected." },
  SEV2: { label: "SEV2 — High", color: "#ef4444", sla: "30 min ack, 4h resolve", description: "Major feature broken. Many users affected." },
  SEV3: { label: "SEV3 — Medium", color: "#f59e0b", sla: "2h ack, 24h resolve", description: "Feature degraded. Some users affected." },
  SEV4: { label: "SEV4 — Low", color: "#0ea5e9", sla: "1 business day ack", description: "Minor issue. Workaround exists." },
  SEV5: { label: "SEV5 — Info", color: "#64748b", sla: "Best effort", description: "Cosmetic or informational. No user impact." },
};

export type WcagLevel = "A" | "AA" | "AAA";
export const WCAG_LEVEL_META: Record<WcagLevel, { label: string; description: string }> = {
  A: { label: "WCAG A", description: "Minimum accessibility — basic screen reader support" },
  AA: { label: "WCAG AA", description: "Standard accessibility — target for production (government compliance)" },
  AAA: { label: "WCAG AAA", description: "Enhanced accessibility — gold standard" },
};

export function computeReadinessScore(checks: Array<{ status: string }>): { score: number; level: string; color: string } {
  if (checks.length === 0) return { score: 0, level: "Unknown", color: "#64748b" };
  const passed = checks.filter(c => c.status === "passed").length;
  const warning = checks.filter(c => c.status === "warning").length;
  const failed = checks.filter(c => c.status === "failed").length;
  const score = Math.round(((passed + warning * 0.5) / checks.length) * 100);
  const level = score >= 95 ? "Production Ready" : score >= 80 ? "Nearly Ready" : score >= 60 ? "Needs Work" : "Not Ready";
  const color = score >= 95 ? "#22c55e" : score >= 80 ? "#0ea5e9" : score >= 60 ? "#f59e0b" : "#ef4444";
  return { score, level, color };
}
