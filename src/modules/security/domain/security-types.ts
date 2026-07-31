/**
 * Sentinel — Security Hardening Domain
 * =============================================================================
 * Comprehensive security platform covering 10 domains:
 *   1. Zero Trust        — never trust, always verify
 *   2. Encryption        — at rest (AES-256) + in transit (TLS 1.3)
 *   3. Rate Limiting     — per-API-key, per-IP, per-user throttling
 *   4. WAF               — Web Application Firewall (OWASP Top 10)
 *   5. Secret Rotation   — automatic key/secret rotation
 *   6. Pen Testing       — scheduled + ad-hoc penetration testing
 *   7. Threat Detection  — intrusion detection, SIEM, anomaly detection
 *   8. Backups           — automated encrypted backups with retention
 *   9. Disaster Recovery — RPO/RTO tracking, failover readiness
 *  10. Audit             — immutable security audit log
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Security domains
// ---------------------------------------------------------------------------

export type SecurityDomain =
  | "zero_trust"
  | "encryption"
  | "rate_limiting"
  | "waf"
  | "secret_rotation"
  | "pen_testing"
  | "threat_detection"
  | "backup"
  | "disaster_recovery"
  | "audit";

export const DOMAIN_META: Record<
  SecurityDomain,
  { label: string; color: string; icon: string; description: string }
> = {
  zero_trust: {
    label: "Zero Trust",
    color: "#0ea5e9",
    icon: "ShieldCheck",
    description: "Never trust, always verify. mTLS, device posture, least-privilege access, continuous authentication.",
  },
  encryption: {
    label: "Encryption",
    color: "#22c55e",
    icon: "Lock",
    description: "AES-256-GCM at rest, TLS 1.3 in transit, envelope encryption for sensitive data, KMS key management.",
  },
  rate_limiting: {
    label: "Rate Limiting",
    color: "#f59e0b",
    icon: "Gauge",
    description: "Per-API-key, per-IP, per-user throttling with sliding window and token bucket algorithms.",
  },
  waf: {
    label: "WAF",
    color: "#ef4444",
    icon: "ShieldAlert",
    description: "Web Application Firewall blocking OWASP Top 10 attacks: SQL injection, XSS, CSRF, RCE, path traversal.",
  },
  secret_rotation: {
    label: "Secret Rotation",
    color: "#a855f7",
    icon: "RefreshCw",
    description: "Automatic rotation of API keys, JWT secrets, database passwords, encryption keys, TLS certificates.",
  },
  pen_testing: {
    label: "Pen Testing",
    color: "#14b8a6",
    icon: "Sword",
    description: "Scheduled and ad-hoc penetration testing with vulnerability findings and remediation tracking.",
  },
  threat_detection: {
    label: "Threat Detection",
    color: "#dc2626",
    icon: "Radar",
    description: "SIEM, intrusion detection, anomaly detection, brute-force protection, bot detection, IoC tracking.",
  },
  backup: {
    label: "Backups",
    color: "#3b82f6",
    icon: "DatabaseBackup",
    description: "Automated encrypted backups with retention policies, verification, and restore testing.",
  },
  disaster_recovery: {
    label: "Disaster Recovery",
    color: "#f97316",
    icon: "ServerOff",
    description: "RPO/RTO tracking, failover readiness, regional recovery, full system restore capabilities.",
  },
  audit: {
    label: "Audit",
    color: "#64748b",
    icon: "ScrollText",
    description: "Immutable, tamper-evident security audit log with hash chain. Every security action recorded.",
  },
};

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export const SEVERITY_META: Record<
  Severity,
  { label: string; color: string; weight: number; sla: number; description: string }
> = {
  info: { label: "Info", color: "#64748b", weight: 0, sla: 0, description: "Informational event — no action required" },
  low: { label: "Low", color: "#0ea5e9", weight: 1, sla: 72, description: "Low severity — review within 72 hours" },
  medium: { label: "Medium", color: "#f59e0b", weight: 2, sla: 24, description: "Medium severity — review within 24 hours" },
  high: { label: "High", color: "#ef4444", weight: 3, sla: 4, description: "High severity — mitigate within 4 hours" },
  critical: { label: "Critical", color: "#dc2626", weight: 4, sla: 1, description: "Critical severity — immediate action required (1 hour SLA)" },
};

// ---------------------------------------------------------------------------
// Threat types
// ---------------------------------------------------------------------------

export type ThreatType =
  | "brute_force"
  | "credential_stuffing"
  | "sql_injection"
  | "xss"
  | "ddos"
  | "bot"
  | "scraping"
  | "privilege_escalation"
  | "data_exfiltration"
  | "malware"
  | "anomalous_access";

export const THREAT_TYPE_META: Record<
  ThreatType,
  { label: string; color: string; defaultSeverity: Severity; description: string }
> = {
  brute_force: { label: "Brute Force", color: "#ef4444", defaultSeverity: "high", description: "Repeated failed login attempts from same IP" },
  credential_stuffing: { label: "Credential Stuffing", color: "#dc2626", defaultSeverity: "critical", description: "Automated login attempts using leaked credentials" },
  sql_injection: { label: "SQL Injection", color: "#f59e0b", defaultSeverity: "high", description: "SQL injection attempt detected by WAF" },
  xss: { label: "XSS", color: "#f59e0b", defaultSeverity: "high", description: "Cross-site scripting attempt detected" },
  ddos: { label: "DDoS", color: "#dc2626", defaultSeverity: "critical", description: "Distributed denial of service attack" },
  bot: { label: "Bot Activity", color: "#a855f7", defaultSeverity: "medium", description: "Automated bot traffic detected" },
  scraping: { label: "Scraping", color: "#0ea5e9", defaultSeverity: "low", description: "Automated data scraping detected" },
  privilege_escalation: { label: "Privilege Escalation", color: "#dc2626", defaultSeverity: "critical", description: "Attempt to gain unauthorized privileges" },
  data_exfiltration: { label: "Data Exfiltration", color: "#dc2626", defaultSeverity: "critical", description: "Suspicious bulk data export detected" },
  malware: { label: "Malware", color: "#ef4444", defaultSeverity: "high", description: "Malware signature detected in upload" },
  anomalous_access: { label: "Anomalous Access", color: "#f59e0b", defaultSeverity: "medium", description: "Unusual access pattern detected by anomaly detection" },
};

// ---------------------------------------------------------------------------
// Backup types & targets
// ---------------------------------------------------------------------------

export type BackupType = "full" | "incremental" | "differential" | "snapshot";
export type BackupTarget = "database" | "storage" | "config" | "full_system";
export type BackupStatus = "scheduled" | "in_progress" | "completed" | "failed" | "verified" | "expired";

export const BACKUP_TYPE_META: Record<BackupType, { label: string; description: string }> = {
  full: { label: "Full Backup", description: "Complete backup of all data" },
  incremental: { label: "Incremental", description: "Changes since last backup" },
  differential: { label: "Differential", description: "Changes since last full backup" },
  snapshot: { label: "Snapshot", description: "Point-in-time snapshot" },
};

// ---------------------------------------------------------------------------
// Secret types
// ---------------------------------------------------------------------------

export type SecretType =
  | "api_key"
  | "jwt_secret"
  | "database_password"
  | "encryption_key"
  | "tls_cert"
  | "oauth_secret"
  | "webhook_secret";

export const SECRET_TYPE_META: Record<
  SecretType,
  { label: string; rotationIntervalDays: number; description: string }
> = {
  api_key: { label: "API Key", rotationIntervalDays: 90, description: "Platform API keys (sk_live_...)" },
  jwt_secret: { label: "JWT Secret", rotationIntervalDays: 30, description: "NextAuth JWT signing secret" },
  database_password: { label: "Database Password", rotationIntervalDays: 60, description: "Database connection password" },
  encryption_key: { label: "Encryption Key", rotationIntervalDays: 90, description: "AES-256 data encryption key (KMS-managed)" },
  tls_cert: { label: "TLS Certificate", rotationIntervalDays: 90, description: "TLS/SSL certificate for HTTPS" },
  oauth_secret: { label: "OAuth Secret", rotationIntervalDays: 365, description: "OAuth provider client secret" },
  webhook_secret: { label: "Webhook Secret", rotationIntervalDays: 180, description: "HMAC webhook signing secret" },
};

// ---------------------------------------------------------------------------
// Pen test types
// ---------------------------------------------------------------------------

export type PenTestType = "internal" | "external" | "red_team" | "compliance" | "bug_bounty";

export const PEN_TEST_TYPE_META: Record<
  PenTestType,
  { label: string; color: string; description: string }
> = {
  internal: { label: "Internal Test", color: "#0ea5e9", description: "Conducted by internal security team" },
  external: { label: "External Test", color: "#f59e0b", description: "Conducted by external security firm" },
  red_team: { label: "Red Team", color: "#ef4444", description: "Adversarial simulation by red team" },
  compliance: { label: "Compliance Audit", color: "#22c55e", description: "Compliance-mandated penetration test" },
  bug_bounty: { label: "Bug Bounty", color: "#a855f7", description: "Community bug bounty program findings" },
};

// ---------------------------------------------------------------------------
// DR plan types
// ---------------------------------------------------------------------------

export type DRPlanType = "failover" | "backup_restore" | "regional" | "full_system";
export type ReadinessStatus = "ready" | "degraded" | "not_ready" | "unknown";

export const READINESS_META: Record<
  ReadinessStatus,
  { label: string; color: string; description: string }
> = {
  ready: { label: "Ready", color: "#22c55e", description: "DR plan tested and ready for execution" },
  degraded: { label: "Degraded", color: "#f59e0b", description: "DR plan partially tested — some gaps" },
  not_ready: { label: "Not Ready", color: "#ef4444", description: "DR plan has critical gaps" },
  unknown: { label: "Unknown", color: "#64748b", description: "DR plan not tested recently" },
};

// ---------------------------------------------------------------------------
// Core computation functions
// ---------------------------------------------------------------------------

/**
 * Compute the overall security posture score (0-100).
 * Weighted average of domain compliance scores.
 */
export function computeSecurityScore(domains: Array<{
  domain: SecurityDomain;
  complianceScore: number;
  violationCount: number;
  activeThreats: number;
}>): { score: number; level: string; color: string } {
  if (domains.length === 0) return { score: 0, level: "Unknown", color: "#64748b" };

  // Weight each domain by its criticality
  const domainWeights: Record<SecurityDomain, number> = {
    zero_trust: 1.5,
    encryption: 1.5,
    rate_limiting: 1.0,
    waf: 1.2,
    secret_rotation: 1.0,
    pen_testing: 0.8,
    threat_detection: 1.3,
    backup: 1.2,
    disaster_recovery: 1.0,
    audit: 0.8,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const d of domains) {
    const weight = domainWeights[d.domain] ?? 1.0;
    // Reduce score based on violations and active threats
    const penalty = Math.min(0.5, d.violationCount * 0.05 + d.activeThreats * 0.1);
    const adjustedScore = Math.max(0, d.complianceScore - penalty);
    weightedSum += adjustedScore * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  let level: string;
  let color: string;
  if (score >= 90) { level = "Excellent"; color = "#22c55e"; }
  else if (score >= 75) { level = "Good"; color = "#0ea5e9"; }
  else if (score >= 60) { level = "Fair"; color = "#f59e0b"; }
  else if (score >= 40) { level = "Poor"; color = "#ef4444"; }
  else { level = "Critical"; color = "#dc2626"; }

  return { score, level, color };
}

/**
 * Compute the backup health score based on backup records.
 */
export function computeBackupHealth(backups: Array<{
  status: string;
  verifiedAt: Date | null;
  encrypted: boolean;
}>): { score: number; lastBackupAgo: string | null; encrypted: boolean } {
  if (backups.length === 0) return { score: 0, lastBackupAgo: null, encrypted: false };

  const completed = backups.filter((b) => b.status === "completed" || b.status === "verified");
  const verified = backups.filter((b) => b.verifiedAt !== null);
  const encrypted = backups.every((b) => b.encrypted);

  const completionRate = completed.length / backups.length;
  const verificationRate = completed.length > 0 ? verified.length / completed.length : 0;
  const encryptionBonus = encrypted ? 1.0 : 0.5;

  const score = Math.round((completionRate * 0.4 + verificationRate * 0.4 + encryptionBonus * 0.2) * 100);

  return { score, lastBackupAgo: null, encrypted };
}

/**
 * Compute the DR readiness score.
 */
export function computeDrReadiness(params: {
  readinessScore: number;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
}): { score: number; status: ReadinessStatus; color: string } {
  let score = params.readinessScore * 100;

  // Penalty for stale tests
  if (params.lastTestedAt) {
    const daysSinceTest = (Date.now() - params.lastTestedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceTest > 180) score *= 0.5;
    else if (daysSinceTest > 90) score *= 0.7;
    else if (daysSinceTest > 30) score *= 0.9;
  } else {
    score *= 0.3; // never tested
  }

  // Penalty for failed tests
  if (params.lastTestStatus === "failed") score *= 0.5;
  else if (params.lastTestStatus === "partial") score *= 0.75;

  score = Math.round(score);

  let status: ReadinessStatus;
  let color: string;
  if (score >= 80) { status = "ready"; color = "#22c55e"; }
  else if (score >= 50) { status = "degraded"; color = "#f59e0b"; }
  else { status = "not_ready"; color = "#ef4444"; }

  return { score, status, color };
}
