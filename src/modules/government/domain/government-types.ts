/**
 * Sentinel — Government Operations Center Domain
 * =============================================================================
 * Three-tier government dashboard (National → Regional → District) with
 * investigation workflow, inspection workflow, and case management.
 *
 * Dashboard levels:
 *   - National: country-wide overview, all regions, all agencies
 *   - Regional: single region (e.g. "Western"), all districts
 *   - District: single district (e.g. "Prestea-Huni Valley"), local detail
 *
 * Workflows:
 *   - Investigation: open → investigating → pending_review → recommended_action → closed
 *   - Inspection: scheduled → in_progress → completed
 *   - Case: filed → under_review → active → pending_hearing → adjudicated → closed
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Dashboard levels
// ---------------------------------------------------------------------------

export type DashboardLevel = "national" | "regional" | "district";

export const DASHBOARD_LEVEL_META: Record<
  DashboardLevel,
  { label: string; color: string; icon: string; description: string }
> = {
  national: {
    label: "National Dashboard",
    color: "#dc2626",
    icon: "Landmark",
    description: "Country-wide overview — all regions, all agencies, all cases. National-level KPIs and cross-regional trends.",
  },
  regional: {
    label: "Regional Dashboard",
    color: "#f59e0b",
    icon: "Map",
    description: "Single region overview — all districts within the region, regional agency performance, regional case load.",
  },
  district: {
    label: "District Dashboard",
    color: "#0ea5e9",
    icon: "MapPin",
    description: "District-level detail — individual sites, inspections, and field operations within a single district.",
  },
};

// ---------------------------------------------------------------------------
// Investigation types & statuses
// ---------------------------------------------------------------------------

export type InvestigationType =
  | "illegal_mining"
  | "water_pollution"
  | "deforestation"
  | "land_degradation"
  | "mercury_use"
  | "child_labor"
  | "tax_evasion"
  | "other";

export const INVESTIGATION_TYPE_META: Record<
  InvestigationType,
  { label: string; color: string; description: string }
> = {
  illegal_mining: { label: "Illegal Mining", color: "#ef4444", description: "Unauthorized excavation, galamsey operations" },
  water_pollution: { label: "Water Pollution", color: "#0ea5e9", description: "River/stream contamination from mining runoff" },
  deforestation: { label: "Deforestation", color: "#22c55e", description: "Forest clearing for mining activities" },
  land_degradation: { label: "Land Degradation", color: "#f59e0b", description: "Land destruction, soil erosion, pit abandonment" },
  mercury_use: { label: "Mercury Use", color: "#a855f7", description: "Illegal mercury use in gold processing" },
  child_labor: { label: "Child Labor", color: "#ec4899", description: "Minors employed in mining operations" },
  tax_evasion: { label: "Tax Evasion", color: "#64748b", description: "Unpaid royalties and taxes on mineral extraction" },
  other: { label: "Other", color: "#6b7280", description: "Other environmental/mining offenses" },
};

export type InvestigationStatus =
  | "open"
  | "investigating"
  | "pending_review"
  | "recommended_action"
  | "closed"
  | "escalated";

export const INVESTIGATION_STATUS_META: Record<
  InvestigationStatus,
  { label: string; color: string; stage: number; description: string }
> = {
  open: { label: "Open", color: "#f59e0b", stage: 0, description: "Investigation filed, awaiting assignment" },
  investigating: { label: "Investigating", color: "#0ea5e9", stage: 1, description: "Actively gathering evidence and conducting interviews" },
  pending_review: { label: "Pending Review", color: "#a855f7", stage: 2, description: "Evidence gathered, awaiting supervisor review" },
  recommended_action: { label: "Action Recommended", color: "#f97316", stage: 3, description: "Review complete, action recommended" },
  closed: { label: "Closed", color: "#22c55e", stage: 4, description: "Investigation resolved and closed" },
  escalated: { label: "Escalated", color: "#dc2626", stage: 5, description: "Escalated to higher jurisdiction" },
};

export type InvestigationStepType =
  | "opened"
  | "evidence_collected"
  | "witness_interviewed"
  | "site_visited"
  | "lab_analysis"
  | "report_filed"
  | "reviewed"
  | "escalated"
  | "closed";

export const INVESTIGATION_STEP_META: Record<
  InvestigationStepType,
  { label: string; icon: string; description: string }
> = {
  opened: { label: "Opened", icon: "FileText", description: "Investigation formally opened" },
  evidence_collected: { label: "Evidence Collected", icon: "FolderSearch", description: "Evidence gathered and catalogued" },
  witness_interviewed: { label: "Witness Interviewed", icon: "Users", description: "Witness statement recorded" },
  site_visited: { label: "Site Visited", icon: "MapPin", description: "Field visit conducted" },
  lab_analysis: { label: "Lab Analysis", icon: "FlaskConical", description: "Samples sent for laboratory analysis" },
  report_filed: { label: "Report Filed", icon: "FileCheck", description: "Investigation report filed" },
  reviewed: { label: "Reviewed", icon: "Eye", description: "Supervisor review completed" },
  escalated: { label: "Escalated", icon: "ArrowUp", description: "Escalated to higher authority" },
  closed: { label: "Closed", icon: "CheckCircle2", description: "Investigation closed" },
};

// ---------------------------------------------------------------------------
// Inspection types & statuses
// ---------------------------------------------------------------------------

export type InspectionType =
  | "routine"
  | "complaint_based"
  | "follow_up"
  | "emergency"
  | "compliance_check";

export const INSPECTION_TYPE_META: Record<
  InspectionType,
  { label: string; description: string }
> = {
  routine: { label: "Routine", description: "Scheduled routine inspection" },
  complaint_based: { label: "Complaint-Based", description: "Triggered by citizen report or complaint" },
  follow_up: { label: "Follow-Up", description: "Follow-up to a previous violation" },
  emergency: { label: "Emergency", description: "Emergency response to active incident" },
  compliance_check: { label: "Compliance Check", description: "Verify compliance with regulations" },
};

export type InspectionStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "failed";

export const INSPECTION_STATUS_META: Record<
  InspectionStatus,
  { label: string; color: string; description: string }
> = {
  scheduled: { label: "Scheduled", color: "#f59e0b", description: "Inspection scheduled" },
  in_progress: { label: "In Progress", color: "#0ea5e9", description: "Inspection underway" },
  completed: { label: "Completed", color: "#22c55e", description: "Inspection completed" },
  cancelled: { label: "Cancelled", color: "#64748b", description: "Inspection cancelled" },
  failed: { label: "Failed", color: "#ef4444", description: "Inspection could not be completed" },
};

export type ComplianceLevel =
  | "compliant"
  | "minor_violations"
  | "major_violations"
  | "critical_violations";

export const COMPLIANCE_LEVEL_META: Record<
  ComplianceLevel,
  { label: string; color: string; severity: number; description: string }
> = {
  compliant: { label: "Compliant", color: "#22c55e", severity: 0, description: "No violations found" },
  minor_violations: { label: "Minor Violations", color: "#eab308", severity: 1, description: "Minor issues, warning issued" },
  major_violations: { label: "Major Violations", color: "#f59e0b", severity: 2, description: "Significant violations, fine/shutdown" },
  critical_violations: { label: "Critical Violations", color: "#ef4444", severity: 3, description: "Critical violations, immediate shutdown" },
};

export type FindingType =
  | "excavation"
  | "water_pollution"
  | "deforestation"
  | "mercury_use"
  | "equipment"
  | "worker_safety"
  | "documentation"
  | "other";

export const FINDING_TYPE_META: Record<
  FindingType,
  { label: string; description: string }
> = {
  excavation: { label: "Excavation", description: "Illegal excavation or pit" },
  water_pollution: { label: "Water Pollution", description: "Water contamination" },
  deforestation: { label: "Deforestation", description: "Forest clearing" },
  mercury_use: { label: "Mercury Use", description: "Mercury in gold processing" },
  equipment: { label: "Equipment", description: "Illegal mining equipment" },
  worker_safety: { label: "Worker Safety", description: "Safety violations" },
  documentation: { label: "Documentation", description: "Missing/invalid permits" },
  other: { label: "Other", description: "Other violation" },
};

// ---------------------------------------------------------------------------
// Case types & statuses
// ---------------------------------------------------------------------------

export type CaseType =
  | "illegal_mining"
  | "water_pollution"
  | "deforestation"
  | "mercury_contamination"
  | "tax_evasion"
  | "other";

export const CASE_TYPE_META: Record<
  CaseType,
  { label: string; color: string; description: string }
> = {
  illegal_mining: { label: "Illegal Mining", color: "#ef4444", description: "Illegal mining operation" },
  water_pollution: { label: "Water Pollution", color: "#0ea5e9", description: "Water body pollution" },
  deforestation: { label: "Deforestation", color: "#22c55e", description: "Forest destruction" },
  mercury_contamination: { label: "Mercury Contamination", color: "#a855f7", description: "Mercury contamination case" },
  tax_evasion: { label: "Tax Evasion", color: "#64748b", description: "Unpaid mining taxes/royalties" },
  other: { label: "Other", color: "#6b7280", description: "Other case type" },
};

export type CaseStatus =
  | "filed"
  | "under_review"
  | "active"
  | "pending_hearing"
  | "adjudicated"
  | "closed"
  | "appealed";

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; color: string; stage: number; description: string }
> = {
  filed: { label: "Filed", color: "#f59e0b", stage: 0, description: "Case filed, awaiting review" },
  under_review: { label: "Under Review", color: "#0ea5e9", stage: 1, description: "Case under initial review" },
  active: { label: "Active", color: "#a855f7", stage: 2, description: "Case actively proceeding" },
  pending_hearing: { label: "Pending Hearing", color: "#f97316", stage: 3, description: "Awaiting court/tribunal hearing" },
  adjudicated: { label: "Adjudicated", color: "#6366f1", stage: 4, description: "Ruling issued" },
  closed: { label: "Closed", color: "#22c55e", stage: 5, description: "Case closed" },
  appealed: { label: "Appealed", color: "#dc2626", stage: 6, description: "Case under appeal" },
};

export type CaseEventType =
  | "filed"
  | "assigned"
  | "hearing_scheduled"
  | "evidence_submitted"
  | "witness_added"
  | "motion_filed"
  | "ruling"
  | "adjourned"
  | "settled"
  | "closed"
  | "appealed";

export const CASE_EVENT_META: Record<
  CaseEventType,
  { label: string; icon: string; description: string }
> = {
  filed: { label: "Filed", icon: "FileText", description: "Case formally filed" },
  assigned: { label: "Assigned", icon: "UserCheck", description: "Case assigned to prosecutor/judge" },
  hearing_scheduled: { label: "Hearing Scheduled", icon: "Calendar", description: "Hearing date set" },
  evidence_submitted: { label: "Evidence Submitted", icon: "FolderSearch", description: "Evidence submitted to court" },
  witness_added: { label: "Witness Added", icon: "Users", description: "Witness added to case" },
  motion_filed: { label: "Motion Filed", icon: "FileEdit", description: "Legal motion filed" },
  ruling: { label: "Ruling", icon: "Gavel", description: "Ruling/judgment issued" },
  adjourned: { label: "Adjourned", icon: "Clock", description: "Hearing adjourned" },
  settled: { label: "Settled", icon: "Handshake", description: "Case settled out of court" },
  closed: { label: "Closed", icon: "CheckCircle2", description: "Case closed" },
  appealed: { label: "Appealed", icon: "ArrowUp", description: "Case appealed" },
};

// ---------------------------------------------------------------------------
// Priority levels (shared across investigations and cases)
// ---------------------------------------------------------------------------

export type Priority = "low" | "medium" | "high" | "urgent";

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; weight: number; sla: number; description: string }
> = {
  low: { label: "Low", color: "#64748b", weight: 1, sla: 30, description: "Standard timeline (30-day SLA)" },
  medium: { label: "Medium", color: "#0ea5e9", weight: 2, sla: 14, description: "Expedited timeline (14-day SLA)" },
  high: { label: "High", color: "#f59e0b", weight: 3, sla: 7, description: "Priority timeline (7-day SLA)" },
  urgent: { label: "Urgent", color: "#dc2626", weight: 4, sla: 3, description: "Immediate action (3-day SLA)" },
};

// ---------------------------------------------------------------------------
// Recommended actions & resolutions
// ---------------------------------------------------------------------------

export type RecommendedAction =
  | "warning"
  | "fine"
  | "shutdown"
  | "prosecution"
  | "referral";

export const RECOMMENDED_ACTION_META: Record<
  RecommendedAction,
  { label: string; color: string; description: string }
> = {
  warning: { label: "Warning", color: "#eab308", description: "Issue formal warning" },
  fine: { label: "Fine", color: "#f59e0b", description: "Impose financial penalty" },
  shutdown: { label: "Shutdown", color: "#ef4444", description: "Order operation shutdown" },
  prosecution: { label: "Prosecution", color: "#dc2626", description: "Refer for criminal prosecution" },
  referral: { label: "Referral", color: "#a855f7", description: "Refer to another agency" },
};

// ---------------------------------------------------------------------------
// Ghana regions & districts (for the dashboard)
// ---------------------------------------------------------------------------

export const GHANA_REGIONS = [
  "Greater Accra",
  "Western",
  "Western North",
  "Central",
  "Ashanti",
  "Eastern",
  "Volta",
  "Bono",
  "Bono East",
  "Ahafo",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
  "Oti",
] as const;

export const GHANA_DISTRICTS: Record<string, string[]> = {
  Western: ["Prestea-Huni Valley", "Tarkwa-Nsuaem", "Wassa Amenfi East", "Ahanta West", "Sekondi-Takoradi"],
  "Western North": ["Bibiani-Anhwiaso-Bekwai", "Sefwi-Wiawso", "Juaboso"],
  Central: ["Upper Denkyira East", "Upper Denkyira West", "Twifo-Ati Morkwa", "Wassa Amenfi West"],
  Ashanti: ["Obuasi Municipal", "Amansie Central", "Amansie West", "Adansi North", "Adansi South"],
  Eastern: ["Atiwa East", "Atiwa West", "Kwaebibirem", "Birim North", "Fanteakwa"],
  "Greater Accra": ["Accra Metropolitan", "Ga West", "Ga East", "Ledzokuku-Krowor"],
};

// ---------------------------------------------------------------------------
// Core computation functions
// ---------------------------------------------------------------------------

/**
 * Compute the SLA status for an investigation or case.
 * Returns whether it's on track, approaching deadline, or overdue.
 */
export function computeSlaStatus(params: {
  filedAt: Date;
  priority: Priority;
  closedAt?: Date | null;
}): { slaDays: number; daysElapsed: number; daysRemaining: number; status: "on_track" | "approaching" | "overdue" | "closed" } {
  const slaDays = PRIORITY_META[params.priority].sla;
  const now = params.closedAt ?? new Date();
  const daysElapsed = Math.floor((now.getTime() - params.filedAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = slaDays - daysElapsed;

  if (params.closedAt) return { slaDays, daysElapsed, daysRemaining: 0, status: "closed" };
  if (daysRemaining < 0) return { slaDays, daysElapsed, daysRemaining, status: "overdue" };
  if (daysRemaining <= 2) return { slaDays, daysElapsed, daysRemaining, status: "approaching" };
  return { slaDays, daysElapsed, daysRemaining, status: "on_track" };
}

/**
 * Compute the compliance score for a set of inspections.
 * Score = (compliant + minor*0.5) / total
 */
export function computeComplianceScore(inspections: Array<{ complianceLevel?: string | null }>): number {
  if (inspections.length === 0) return 1.0;
  let score = 0;
  for (const insp of inspections) {
    const level = insp.complianceLevel;
    if (level === "compliant") score += 1;
    else if (level === "minor_violations") score += 0.5;
    else if (level === "major_violations") score += 0;
    else if (level === "critical_violations") score += 0;
    else score += 0.5; // unknown — neutral
  }
  return Math.round((score / inspections.length) * 100) / 100;
}

/**
 * Aggregate dashboard metrics for a given set of investigations, inspections, and cases.
 */
export function aggregateDashboardMetrics(params: {
  investigations: Array<{ status: string; priority: string; level: string; region?: string | null; district?: string | null; estimatedImpactGHS: number; createdAt: Date; closedAt?: Date | null }>;
  inspections: Array<{ status: string; complianceLevel?: string | null; violationCount: number; region?: string | null; district?: string | null; scheduledAt?: Date | null; completedAt?: Date | null }>;
  cases: Array<{ status: string; priority: string; type: string; level: string; region?: string | null; district?: string | null; estimatedDamagesGHS: number; finesImposedGHS: number; filedAt: Date; closedAt?: Date | null; resolution?: string | null }>;
  filter?: { level?: DashboardLevel; region?: string; district?: string };
}) {
  const filter = params.filter ?? {};

  const filterFn = <T extends { region?: string | null; district?: string | null; level?: string | null }>(item: T): boolean => {
    if (filter.region && item.region !== filter.region) return false;
    if (filter.district && item.district !== filter.district) return false;
    return true;
  };

  // Note: investigations and cases have a `level` field; inspections don't
  const investigations = params.investigations.filter(filterFn);
  const inspections = params.inspections.filter(filterFn);
  const cases = params.cases.filter(filterFn);

  // Investigations by status
  const investigationsByStatus: Record<string, number> = {};
  for (const inv of investigations) {
    investigationsByStatus[inv.status] = (investigationsByStatus[inv.status] ?? 0) + 1;
  }

  // Inspections by status
  const inspectionsByStatus: Record<string, number> = {};
  for (const insp of inspections) {
    inspectionsByStatus[insp.status] = (inspectionsByStatus[insp.status] ?? 0) + 1;
  }

  // Cases by status
  const casesByStatus: Record<string, number> = {};
  for (const c of cases) {
    casesByStatus[c.status] = (casesByStatus[c.status] ?? 0) + 1;
  }

  // Cases by type
  const casesByType: Record<string, number> = {};
  for (const c of cases) {
    casesByType[c.type] = (casesByType[c.type] ?? 0) + 1;
  }

  // Compliance score
  const complianceScore = computeComplianceScore(inspections.filter((i) => i.status === "completed"));

  // Financial metrics
  const estimatedDamagesGHS = cases.reduce((s, c) => s + c.estimatedDamagesGHS, 0);
  const finesImposedGHS = cases.reduce((s, c) => s + c.finesImposedGHS, 0);
  const estimatedImpactGHS = investigations.reduce((s, i) => s + i.estimatedImpactGHS, 0);

  // SLA tracking
  const openCases = cases.filter((c) => c.status !== "closed" && c.status !== "adjudicated");
  const overdueCount = openCases.filter((c) => {
    const sla = computeSlaStatus({ filedAt: c.filedAt, priority: c.priority as Priority });
    return sla.status === "overdue";
  }).length;

  // Resolution rate
  const closedCases = cases.filter((c) => c.status === "closed").length;
  const resolutionRate = cases.length > 0 ? closedCases / cases.length : 0;

  return {
    totals: {
      investigations: investigations.length,
      inspections: inspections.length,
      cases: cases.length,
      openInvestigations: investigations.filter((i) => i.status !== "closed").length,
      scheduledInspections: inspections.filter((i) => i.status === "scheduled").length,
      completedInspections: inspections.filter((i) => i.status === "completed").length,
      openCases: openCases.length,
      closedCases,
    },
    byStatus: {
      investigations: investigationsByStatus,
      inspections: inspectionsByStatus,
      cases: casesByStatus,
    },
    byType: {
      cases: casesByType,
    },
    complianceScore,
    financials: {
      estimatedDamagesGHS,
      finesImposedGHS,
      estimatedImpactGHS,
    },
    sla: {
      overdueCount,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
    },
  };
}
