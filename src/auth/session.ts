/**
 * Sentinel — Auth server helpers.
 * Thin wrappers around next-auth for server components / route handlers.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import type { RbacContext } from "@/modules/iam/infrastructure/rbac";

export interface SentinelSession {
  userId: string;
  email: string;
  name?: string | null;
  image?: string | null;
  roles: string[];
  permissions: string[];
}

export async function getSession(): Promise<SentinelSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as {
    id?: string;
    email?: string;
    name?: string | null;
    image?: string | null;
    roles?: string[];
    permissions?: string[];
  };
  if (!u.id || !u.email) return null;
  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    roles: u.roles ?? [],
    permissions: u.permissions ?? [],
  };
}

export async function getRbacContext(): Promise<RbacContext> {
  const session = await getSession();
  return {
    userId: session?.userId,
    roles: session?.roles,
  };
}

export async function requirePermission(permissionKey: string): Promise<{
  allowed: boolean;
  session: SentinelSession | null;
  reason?: string;
}> {
  const session = await getSession();
  if (!session) return { allowed: false, session: null, reason: "unauthenticated" };
  if (session.permissions.includes("*")) return { allowed: true, session };
  if (session.permissions.includes(permissionKey)) return { allowed: true, session };
  const [resource] = permissionKey.split(":");
  if (session.permissions.includes(`${resource}:*`)) return { allowed: true, session };
  return { allowed: false, session, reason: "forbidden" };
}
