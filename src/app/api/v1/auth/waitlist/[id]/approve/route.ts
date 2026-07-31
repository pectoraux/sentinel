/**
 * Sentinel — Admin: Approve a waitlist entry.
 * POST /api/v1/auth/waitlist/[id]/approve
 *
 *   - Admin-only (requires `admin` or `super_admin` role).
 *   - Creates a User account (with a freshly generated temporary password),
 *     a TrustProfile, and assigns the closest-matching RBAC role based on the
 *     requested `roleInterest`.
 *   - Marks the waitlist entry as `approved`.
 *   - Returns the temporary password so the admin can share it with the new
 *     user through a secure channel.
 */

import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { getSession } from "@/auth/session";

// Map waitlist `roleInterest` → RBAC role key (best-fit; falls back to citizen_reporter).
const ROLE_INTEREST_TO_ROLE_KEY: Record<string, string> = {
  citizen_reporter: "citizen_reporter",
  field_inspector: "field_agent",
  government_official: "inspector",
  researcher: "analyst",
  ngo: "analyst",
  other: "citizen_reporter",
};

function generateTemporaryPassword(length = 16): string {
  // URL-safe alphabet so the password is easy to copy/paste.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // --- Authz ----------------------------------------------------------------
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const isAdmin =
    session.roles.includes("super_admin") || session.roles.includes("admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const entry = await db.waitlistEntry.findUnique({ where: { id } });
    if (!entry) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 },
      );
    }
    if (entry.status === "approved") {
      return NextResponse.json(
        { error: "This entry has already been approved" },
        { status: 409 },
      );
    }

    // Reject if a user with this email already exists (idempotency guard).
    const existingUser = await db.user.findUnique({
      where: { email: entry.email },
      select: { id: true },
    });
    if (existingUser) {
      await db.waitlistEntry.update({
        where: { id },
        data: {
          status: "approved",
          reviewedById: session.userId,
          reviewedAt: new Date(),
          reviewNotes: "Linked to pre-existing user account.",
        },
      });
      return NextResponse.json({
        ok: true,
        message: "A user with this email already exists. Waitlist entry marked approved.",
        userId: existingUser.id,
        temporaryPassword: null,
      });
    }

    // Generate a fresh temporary password (overrides the pre-hashed password
    // captured at signup — the admin shares this via a secure channel).
    const temporaryPassword = generateTemporaryPassword(16);
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    // Resolve the target RBAC role key (fall back to citizen_reporter).
    const roleKey =
      ROLE_INTEREST_TO_ROLE_KEY[entry.roleInterest] ?? "citizen_reporter";

    // Create user + trust profile + role assignment atomically.
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: entry.email,
          name: entry.name,
          passwordHash,
          status: "active",
          emailVerified: new Date(),
        },
      });

      await tx.trustProfile.create({
        data: {
          userId: user.id,
          score: 0,
          tier: "unverified",
          factors: JSON.stringify({
            verifications: 0,
            reportsSubmitted: 0,
            reportsVerified: 0,
            disputes: 0,
          }),
          badges: JSON.stringify(["waitlist_approved"]),
          lastRecalculatedAt: new Date(),
        },
      });

      const role = await tx.role.findUnique({
        where: { key: roleKey },
        select: { id: true },
      });
      if (role) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
            assignedBy: session.userId,
          },
        }).catch(() => {
          // UserRole may already exist in a race; safe to ignore.
        });
      }

      await tx.waitlistEntry.update({
        where: { id },
        data: {
          status: "approved",
          reviewedById: session.userId,
          reviewedAt: new Date(),
        },
      });

      return user;
    });

    logger.info("waitlist.approved", {
      waitlistId: id,
      userId: created.id,
      email: created.email,
      roleKey,
      approvedBy: session.userId,
    });

    return NextResponse.json({
      ok: true,
      message: "User account created.",
      userId: created.id,
      email: created.email,
      roleKey,
      temporaryPassword,
    });
  } catch (err) {
    logger.error("waitlist.approve_failed", {
      waitlistId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to approve waitlist entry" },
      { status: 500 },
    );
  }
}
