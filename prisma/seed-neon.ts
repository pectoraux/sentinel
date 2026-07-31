/**
 * Sentinel — Standalone Neon Seed (no app imports)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { resource: "users", action: "read", name: "Read users" },
  { resource: "users", action: "manage", name: "Manage users" },
  { resource: "users", action: "assign_roles", name: "Assign roles" },
  { resource: "roles", action: "read", name: "Read roles" },
  { resource: "roles", action: "manage", name: "Manage roles" },
  { resource: "feature_flags", action: "read", name: "Read flags" },
  { resource: "feature_flags", action: "toggle", name: "Toggle flags" },
  { resource: "feature_flags", action: "manage", name: "Manage flags" },
  { resource: "audit", action: "read", name: "Read audit" },
  { resource: "audit", action: "export", name: "Export audit" },
  { resource: "system", action: "view_health", name: "View health" },
  { resource: "system", action: "view_metrics", name: "View metrics" },
  { resource: "system", action: "admin", name: "System admin" },
  { resource: "organizations", action: "read", name: "Read orgs" },
  { resource: "organizations", action: "manage", name: "Manage orgs" },
  { resource: "organizations", action: "verify", name: "Verify orgs" },
  { resource: "organizations", action: "invite", name: "Invite members" },
  { resource: "devices", action: "read", name: "Read devices" },
  { resource: "devices", action: "manage", name: "Manage devices" },
  { resource: "identity", action: "submit_verification", name: "Submit verification" },
  { resource: "identity", action: "review_verifications", name: "Review verifications" },
  { resource: "identity", action: "view_trust", name: "View trust" },
  { resource: "identity", action: "manage_trust", name: "Manage trust" },
  { resource: "sessions", action: "manage", name: "Manage sessions" },
  { resource: "identity", action: "switch_role", name: "Switch role" },
];

const ROLES = [
  { key: "super_admin", name: "Super Administrator", description: "Unrestricted access", permissions: ["*"] },
  { key: "admin", name: "Administrator", description: "Platform administration", permissions: ["users:read","users:manage","users:assign_roles","roles:read","roles:manage","feature_flags:read","feature_flags:toggle","feature_flags:manage","audit:read","audit:export","system:view_health","system:view_metrics","organizations:read","organizations:manage","organizations:verify","organizations:invite","devices:read","devices:manage","identity:review_verifications","identity:view_trust","identity:manage_trust","sessions:manage","identity:switch_role"] },
  { key: "inspector", name: "Inspector", description: "Reviews identity verifications", permissions: ["users:read","organizations:read","devices:read","identity:review_verifications","identity:view_trust","audit:read","system:view_health"] },
  { key: "analyst", name: "Analyst", description: "Read-only platform access", permissions: ["users:read","organizations:read","devices:read","identity:view_trust","audit:read","system:view_health"] },
  { key: "field_agent", name: "Field Agent", description: "Field operations", permissions: ["users:read","organizations:read","devices:read","identity:view_trust","system:view_health"] },
  { key: "citizen_reporter", name: "Citizen Reporter", description: "Community reporter", permissions: ["users:read","identity:submit_verification","identity:view_trust","system:view_health"] },
];

const FLAGS = [
  { key: "platform.foundation", name: "Platform Foundation", description: "Core platform infrastructure", enabled: true, strategy: "boolean" },
  { key: "identity.trust", name: "Identity & Trust", description: "Identity verification and trust profiles", enabled: true, strategy: "boolean" },
  { key: "geospatial.engine", name: "Geospatial Engine", description: "GIS and spatial queries", enabled: true, strategy: "boolean" },
  { key: "twin.core", name: "Digital Twin Core", description: "Versioned entities and relationships", enabled: true, strategy: "boolean" },
  { key: "evidence.platform", name: "Evidence Platform", description: "Evidence upload and verification", enabled: true, strategy: "boolean" },
  { key: "intelligence.community", name: "Community Intelligence", description: "Event-sourced community reporting", enabled: true, strategy: "boolean" },
  { key: "trust.engine", name: "Civil Trust Engine", description: "8-factor trust scoring", enabled: true, strategy: "boolean" },
  { key: "notifications.platform", name: "Notification Platform", description: "Multi-channel notifications", enabled: true, strategy: "boolean" },
  { key: "satellite.ingestion", name: "Satellite Ingestion", description: "Satellite imagery pipeline", enabled: true, strategy: "boolean" },
  { key: "cv.platform", name: "Computer Vision", description: "AI-powered CV detection", enabled: true, strategy: "boolean" },
];

async function main() {
  console.log("[seed] Starting standalone seed...");

  // Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: `${p.resource}:${p.action}` }, create: { ...p, key: `${p.resource}:${p.action}` }, update: {} });
  }
  await prisma.permission.upsert({ where: { key: "*" }, create: { resource: "*", action: "*", name: "Wildcard", description: "All permissions", key: "*" }, update: {} });
  console.log(`[seed] ${PERMISSIONS.length + 1} permissions`);

  // Roles
  for (const r of ROLES) {
    const role = await prisma.role.upsert({ where: { key: r.key }, create: { key: r.key, name: r.name, description: r.description, isSystem: true }, update: {} });
    if (r.permissions.includes("*")) {
      const wc = await prisma.permission.findUnique({ where: { key: "*" } });
      if (wc) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: wc.id } }, create: { roleId: role.id, permissionId: wc.id }, update: {} });
    } else {
      for (const pk of r.permissions) {
        const perm = await prisma.permission.findUnique({ where: { key: pk } });
        if (perm) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } }, create: { roleId: role.id, permissionId: perm.id }, update: {} });
      }
    }
  }
  console.log(`[seed] ${ROLES.length} roles`);

  // Feature flags
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, create: f, update: {} });
  }
  console.log(`[seed] ${FLAGS.length} feature flags`);

  // Users
  const dp = await bcrypt.hash("SentinelDemo2024!", 12);
  const ap = await bcrypt.hash("SentinelAdmin2024!", 12);
  const rp = await bcrypt.hash("Payswap123456", 12);

  const users = [
    { email: "admin@sentinel.africa", name: "Sentinel Admin", pass: ap, role: "super_admin" },
    { email: "citizen@sentinel.africa", name: "Demo Citizen Reporter", pass: dp, role: "citizen_reporter" },
    { email: "inspector@sentinel.africa", name: "Demo Inspector", pass: dp, role: "inspector" },
    { email: "gov@sentinel.africa", name: "Demo Government Official", pass: dp, role: "analyst" },
    { email: "ekontetevi@gmail.com", name: "Eric Admin", pass: rp, role: "super_admin" },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({ where: { email: u.email }, create: { email: u.email, name: u.name, passwordHash: u.pass, status: "active" }, update: {} });
    const role = await prisma.role.findUnique({ where: { key: u.role } });
    if (role) await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
  }
  console.log(`[seed] ${users.length} users`);

  // Organizations
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@sentinel.africa" } });
  const orgs = [
    { key: "epa-ghana", name: "Environmental Protection Agency — Ghana", type: "government_agency", country: "GH", region: "Greater Accra", description: "National environmental regulator", status: "active" },
    { key: "minerals-commission-gh", name: "Minerals Commission — Ghana", type: "regulator", country: "GH", region: "Greater Accra", description: "Regulates mineral rights", status: "active" },
    { key: "wacam-ghana", name: "WACAM — Concerned Farmers", type: "ngo", country: "GH", region: "Western", description: "Community advocacy NGO", status: "active" },
    { key: "kwame-nkrumah-geoscience", name: "KNUST Geoscience Research Group", type: "researcher", country: "GH", region: "Ashanti", description: "Academic research", status: "active" },
  ];
  for (const org of orgs) {
    await prisma.organization.upsert({ where: { key: org.key }, create: { ...org, verifiedAt: new Date(), verifiedById: adminUser?.id }, update: {} });
  }
  console.log(`[seed] ${orgs.length} organizations`);

  console.log("[seed] Done! Login: admin@sentinel.africa / SentinelAdmin2024! | ekontetevi@gmail.com / Payswap123456");
}

main().catch(e => { console.error("[seed] Failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
