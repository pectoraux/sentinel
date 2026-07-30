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
   
  console.log("[seed] Done.");
}

main()
  .catch((e) => {
     
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
