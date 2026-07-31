/**
 * Sentinel — Minimal Production Seed
 * Seeds essential data for Vercel/Neon deployment
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSION_CATALOGUE, ROLE_CATALOGUE } from "../src/modules/iam/infrastructure/rbac";
import { DEFAULT_FLAGS } from "../src/modules/feature-flags";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed-minimal] Starting...");

  // 1. Permissions
  for (const p of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where: { key: `${p.resource}:${p.action}` },
      create: { resource: p.resource, action: p.action, name: p.name, description: p.description, key: `${p.resource}:${p.action}` },
      update: {},
    });
  }
  console.log(`[seed-minimal] Seeded ${PERMISSION_CATALOGUE.length} permissions`);

  // Wildcard permission
  await prisma.permission.upsert({
    where: { key: "*" },
    create: { resource: "*", action: "*", name: "Wildcard", description: "All permissions", key: "*" },
    update: {},
  });

  // 2. Roles
  for (const r of ROLE_CATALOGUE) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
      update: {},
    });
    if (r.permissions.includes("*")) {
      const wildcard = await prisma.permission.findUnique({ where: { key: "*" } });
      if (wildcard) await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: wildcard.id } },
        create: { roleId: role.id, permissionId: wildcard.id },
        update: {},
      });
    } else {
      for (const permKey of r.permissions) {
        const perm = await prisma.permission.findUnique({ where: { key: permKey } });
        if (perm) await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          create: { roleId: role.id, permissionId: perm.id },
          update: {},
        });
      }
    }
  }
  console.log(`[seed-minimal] Seeded ${ROLE_CATALOGUE.length} roles`);

  // 3. Feature flags
  for (const f of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: { key: f.key, name: f.name, description: f.description, enabled: f.enabled, strategy: f.strategy },
      update: {},
    });
  }
  console.log(`[seed-minimal] Seeded ${DEFAULT_FLAGS.length} feature flags`);

  // 4. Users — admin + demo accounts + real admin
  const demoPass = await bcrypt.hash("SentinelDemo2024!", 12);
  const adminPass = await bcrypt.hash("SentinelAdmin2024!", 12);
  const realAdminPass = await bcrypt.hash("Payswap123456", 12);

  const users = [
    { email: "admin@sentinel.africa", name: "Sentinel Admin", pass: adminPass, role: "super_admin" },
    { email: "citizen@sentinel.africa", name: "Demo Citizen Reporter", pass: demoPass, role: "citizen_reporter" },
    { email: "inspector@sentinel.africa", name: "Demo Inspector", pass: demoPass, role: "inspector" },
    { email: "gov@sentinel.africa", name: "Demo Government Official", pass: demoPass, role: "analyst" },
    { email: "ekontetevi@gmail.com", name: "Eric Admin", pass: realAdminPass, role: "super_admin" },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, passwordHash: u.pass, status: "active" },
      update: {},
    });
    const role = await prisma.role.findUnique({ where: { key: u.role } });
    if (role) await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
  }
  console.log(`[seed-minimal] Seeded ${users.length} users`);

  // 5. Organizations
  const orgs = [
    { key: "epa-ghana", name: "Environmental Protection Agency — Ghana", type: "government_agency", country: "GH", region: "Greater Accra", description: "National environmental regulator", status: "active" },
    { key: "minerals-commission-gh", name: "Minerals Commission — Ghana", type: "regulator", country: "GH", region: "Greater Accra", description: "Regulates mineral rights and licenses", status: "active" },
    { key: "wacam-ghana", name: "WACAM — Concerned Farmers", type: "ngo", country: "GH", region: "Western", description: "Community advocacy NGO", status: "active" },
    { key: "kwame-nkrumah-geoscience", name: "KNUST Geoscience Research Group", type: "researcher", country: "GH", region: "Ashanti", description: "Academic research on remote sensing", status: "active" },
  ];

  for (const org of orgs) {
    await prisma.organization.upsert({
      where: { key: org.key },
      create: { ...org, verifiedAt: new Date(), verifiedById: (await prisma.user.findFirst({ where: { email: "admin@sentinel.africa" } }))?.id },
      update: {},
    });
  }
  console.log(`[seed-minimal] Seeded ${orgs.length} organizations`);

  console.log("[seed-minimal] Done!");
}

main().catch(e => { console.error("[seed-minimal] Failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
