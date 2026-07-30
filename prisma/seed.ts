/**
 * Sentinel — Database seed
 * =============================================================================
 * Idempotent: safe to run multiple times. Seeds:
 *   - Permission catalogue
 *   - Role catalogue (with role→permission mappings)
 *   - Default feature flags
 *   - A bootstrap super_admin user (dev only)
 *
 * Run: `bun run db:seed`
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PERMISSION_CATALOGUE,
  ROLE_CATALOGUE,
} from "@/modules/iam/infrastructure/rbac";
import { DEFAULT_FLAGS } from "@/modules/feature-flags";

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const p of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where: { key: `${p.resource}:${p.action}` },
      create: {
        key: `${p.resource}:${p.action}`,
        name: p.name,
        description: p.description,
        resource: p.resource,
        action: p.action,
      },
      update: { name: p.name, description: p.description },
    });
  }
  // Wildcard permission for super_admin
  await prisma.permission.upsert({
    where: { key: "*" },
    create: {
      key: "*",
      name: "Wildcard",
      description: "Grants all permissions",
      resource: "*",
      action: "*",
    },
    update: {},
  });
}

async function seedRoles() {
  for (const r of ROLE_CATALOGUE) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: true,
      },
      update: { name: r.name, description: r.description },
    });
    // Map permissions
    if (r.permissions.includes("*")) {
      const wildcard = await prisma.permission.findUnique({ where: { key: "*" } });
      if (wildcard) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: wildcard.id },
          },
          create: { roleId: role.id, permissionId: wildcard.id },
          update: {},
        });
      }
    } else {
      for (const permKey of r.permissions) {
        const perm = await prisma.permission.findUnique({ where: { key: permKey } });
        if (perm) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: perm.id },
            },
            create: { roleId: role.id, permissionId: perm.id },
            update: {},
          });
        }
      }
    }
  }
}

async function seedFeatureFlags() {
  for (const f of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: {
        key: f.key,
        name: f.name,
        description: f.description,
        strategy: f.strategy,
        enabled: f.enabled,
      },
      update: {
        name: f.name,
        description: f.description,
        strategy: f.strategy,
      },
    });
  }
}

async function seedBootstrapUser() {
  // Development-only bootstrap admin. Password: "SentinelAdmin2024!"
  const passwordHash = await bcrypt.hash("SentinelAdmin2024!", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@sentinel.africa" },
    create: {
      email: "admin@sentinel.africa",
      name: "Sentinel Bootstrap Admin",
      passwordHash,
      status: "active",
    },
    update: {},
  });

  const adminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      create: { userId: user.id, roleId: adminRole.id },
      update: {},
    });
  }

   
  console.log("[seed] Bootstrap admin: admin@sentinel.africa / SentinelAdmin2024!");
}

async function main() {
   
  console.log("[seed] Seeding permissions...");
  await seedPermissions();
   
  console.log("[seed] Seeding roles...");
  await seedRoles();
   
  console.log("[seed] Seeding feature flags...");
  await seedFeatureFlags();
   
  console.log("[seed] Seeding bootstrap user...");
  await seedBootstrapUser();

  console.log("[seed] Seeding M2 identity & trust data...");
  await seedIdentityData();
   
  console.log("[seed] Done.");
}

// ---------------------------------------------------------------------------
// M2 — Identity & Trust seed data
// ---------------------------------------------------------------------------

const SAMPLE_ORGS = [
  {
    key: "epa-ghana",
    name: "Environmental Protection Agency — Ghana",
    type: "government_agency",
    country: "GH",
    region: "Greater Accra",
    description: "National environmental regulator coordinating anti-galamsey enforcement.",
    status: "active",
  },
  {
    key: "minerals-commission-gh",
    name: "Minerals Commission — Ghana",
    type: "regulator",
    country: "GH",
    region: "Greater Accra",
    description: "Regulates mineral rights and licenses; investigates illegal mining.",
    status: "active",
  },
  {
    key: "wacam-ghana",
    name: "WACAM — Concerned Farmers",
    type: "ngo",
    country: "GH",
    region: "Western",
    description: "Community advocacy NGO for farmers affected by mining pollution.",
    status: "active",
  },
  {
    key: "kwame-nkrumah-geoscience",
    name: "KNUST Geoscience Research Group",
    type: "researcher",
    country: "GH",
    region: "Ashanti",
    description: "Academic research on remote sensing for environmental monitoring.",
    status: "active",
  },
  {
    key: "forestry-commission-gh",
    name: "Forestry Commission — Ghana",
    type: "government_agency",
    country: "GH",
    region: "Greater Accra",
    description: "Protects forest reserves from illegal mining incursions.",
    status: "pending_verification",
  },
  {
    key: "akuapem-community-watch",
    name: "Akuapem Community Watch",
    type: "community",
    country: "GH",
    region: "Eastern",
    description: "Grassroots community intelligence network for environmental crimes.",
    status: "pending_verification",
  },
];

async function seedIdentityData() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@sentinel.africa" },
  });
  if (!admin) return;

  // Create sample organizations
  const orgIds: string[] = [];
  for (const org of SAMPLE_ORGS) {
    const created = await prisma.organization.upsert({
      where: { key: org.key },
      create: {
        key: org.key,
        name: org.name,
        type: org.type,
        country: org.country,
        region: org.region,
        description: org.description,
        status: org.status,
        verifiedAt: org.status === "active" ? new Date() : null,
        verifiedById: org.status === "active" ? admin.id : null,
      },
      update: {},
    });
    orgIds.push(created.id);
  }

  // Admin joins the EPA as owner (already verified active)
  const epa = await prisma.organization.findUnique({ where: { key: "epa-ghana" } });
  if (epa) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: epa.id, userId: admin.id },
      },
      create: {
        organizationId: epa.id,
        userId: admin.id,
        role: "owner",
        status: "active",
      },
      update: {},
    });
  }

  // Seed additional demo users + trust profiles
  const demoUsers = [
    { email: "inspector.kofi@epa-ghana.gov", name: "Kofi Mensah", role: "inspector", orgKey: "epa-ghana", orgRole: "inspector" },
    { email: "moderator.ama@sentinel.africa", name: "Ama Boateng", role: "moderator", orgKey: null, orgRole: null },
    { email: "researcher.yaw@knust.edu.gh", name: "Yaw Owusu", role: "analyst", orgKey: "kwame-nkrumah-geoscience", orgRole: "member" },
    { email: "agent.akua@wacam-ghana.org", name: "Akua Adjei", role: "field_agent", orgKey: "wacam-ghana", orgRole: "member" },
    { email: "reporter.kwame@community.org", name: "Kwame Tetteh", role: "citizen_reporter", orgKey: "akuapem-community-watch", orgRole: "member" },
  ];

  for (const du of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: du.email },
      create: {
        email: du.email,
        name: du.name,
        passwordHash: await bcrypt.hash("SentinelUser2024!", 12),
        status: "active",
      },
      update: {},
    });
    // Assign RBAC role
    const role = await prisma.role.findUnique({ where: { key: du.role } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
    // Add to org
    if (du.orgKey) {
      const org = await prisma.organization.findUnique({ where: { key: du.orgKey } });
      if (org) {
        await prisma.organizationMember.upsert({
          where: {
            organizationId_userId: { organizationId: org.id, userId: user.id },
          },
          create: {
            organizationId: org.id,
            userId: user.id,
            role: du.orgRole ?? "member",
            status: "active",
            invitedBy: admin.id,
          },
          update: {},
        });
      }
    }
    // Seed a device for each demo user
    const fingerprint = `fp_${du.email.replace(/[^a-z0-9]/g, "_").slice(0, 24)}`;
    await prisma.device.upsert({
      where: { fingerprint },
      create: {
        userId: user.id,
        fingerprint,
        label: `${du.name.split(" ")[0]}'s Device`,
        platform: du.role === "field_agent" ? "android" : "web",
        userAgent: "Mozilla/5.0 (Sentinel Client)",
        status: Math.random() > 0.4 ? "trusted" : "active",
        lastSeenAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        lastSeenIp: `102.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      update: {},
    });
    // Seed verifications for some users
    const verifTypes = ["government_id", "phone_otp", "email"];
    for (const vtype of verifTypes) {
      if (Math.random() > 0.55) {
        await prisma.identityVerification.create({
          data: {
            userId: user.id,
            type: vtype,
            status: "approved",
            submittedData: JSON.stringify({ country: "GH" }),
            reviewedById: admin.id,
            reviewedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
            submittedAt: new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000)),
          },
        });
      }
    }
    // Seed trust profile (compute simply from approved verifications)
    const approvedCount = await prisma.identityVerification.count({
      where: { userId: user.id, status: "approved" },
    });
    const orgCount = du.orgKey ? 1 : 0;
    const score = Math.min(
      100,
      approvedCount * 15 + orgCount * 10 + Math.floor(Math.random() * 20),
    );
    const tier = score >= 80 ? "elite" : score >= 60 ? "trusted" : score >= 40 ? "verified" : score >= 20 ? "basic" : "unverified";
    const badges: string[] = [];
    if (approvedCount >= 1) badges.push("id_verified");
    if (orgCount >= 1) badges.push("org_member");
    if (tier === "elite") badges.push("elite_member");
    await prisma.trustProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        score,
        tier,
        factors: JSON.stringify({ verifications: approvedCount, orgMemberships: orgCount }),
        badges: JSON.stringify(badges),
        lastRecalculatedAt: new Date(),
      },
      update: {},
    });
  }

  // Admin trust profile
  await prisma.trustProfile.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      score: 100,
      tier: "elite",
      factors: JSON.stringify({ verifications: 5, orgMemberships: 1, accountAgeDays: 1 }),
      badges: JSON.stringify(["id_verified", "thoroughly_verified", "org_member", "elite_member"]),
      lastRecalculatedAt: new Date(),
    },
    update: {},
  });

  console.log(`[seed] Seeded ${SAMPLE_ORGS.length} organizations, ${demoUsers.length} demo users with devices/verifications/trust.`);
}

main()
  .catch((e) => {
     
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
