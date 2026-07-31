/**
 * Sentinel — Admin: Reject a waitlist entry.
 * POST /api/v1/auth/waitlist/[id]/reject
 *
 *   - Admin-only (requires `admin` or `super_admin` role).
 *   - Marks the entry as `rejected` and records the reviewer.
 *   - Optional body: { notes?: string }
 */

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { getSession } from "@/auth/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  let notes: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.notes === "string") {
      notes = body.notes.trim().slice(0, 1000) || null;
    }
  } catch {
    notes = null;
  }

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
        { error: "Cannot reject an already-approved entry" },
        { status: 409 },
      );
    }

    await db.waitlistEntry.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    logger.info("waitlist.rejected", {
      waitlistId: id,
      email: entry.email,
      rejectedBy: session.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("waitlist.reject_failed", {
      waitlistId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to reject waitlist entry" },
      { status: 500 },
    );
  }
}
