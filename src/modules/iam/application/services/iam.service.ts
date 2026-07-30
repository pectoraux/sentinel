/**
 * Sentinel — IAM application services
 * Orchestrates use cases over the User/Role domain.
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { getRbac } from "@/modules/iam/infrastructure/rbac";

export class IamService {
  async listUsers(limit = 50, offset = 0) {
    const [users, total] = await Promise.all([
      db.user.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      db.user.count(),
    ]);
    return { users, total };
  }

  async getUserProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) return null;
    const { roles, keys } = await getRbac().getPermissions(userId);
    return { ...user, roles, permissions: keys };
  }

  async assignRole(params: {
    userId: string;
    roleKey: string;
    assignedBy?: string;
    expiresAt?: Date;
  }) {
    const role = await db.role.findUnique({ where: { key: params.roleKey } });
    if (!role) throw new Error(`Role not found: ${params.roleKey}`);
    const userRole = await db.userRole.upsert({
      where: { userId_roleId: { userId: params.userId, roleId: role.id } },
      create: {
        userId: params.userId,
        roleId: role.id,
        assignedBy: params.assignedBy,
        expiresAt: params.expiresAt,
      },
      update: { assignedBy: params.assignedBy, expiresAt: params.expiresAt },
    });
    getRbac().invalidate(params.userId);
    logger.info("iam.role.assigned", { userId: params.userId, roleKey: params.roleKey });
    return userRole;
  }

  async listRoles() {
    const roles = await db.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { key: "asc" },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((rp) => ({
        key: rp.permission.key,
        resource: rp.permission.resource,
        action: rp.permission.action,
        name: rp.permission.name,
      })),
    }));
  }
}

let instance: IamService | null = null;
export function getIamService(): IamService {
  if (!instance) instance = new IamService();
  return instance;
}
