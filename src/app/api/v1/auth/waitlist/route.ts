/**
 * Sentinel — Waitlist signup API.
 * =============================================================================
 * POST /api/v1/auth/waitlist
 *   Body: { name, email, password, organization?, roleInterest? }
 *
 *   - Validates input (Zod).
 *   - Hashes the password with bcrypt (so an admin can later approve the entry
 *     without ever touching the plaintext password).
 *   - Creates a `WaitlistEntry` record with status `pending`.
 *   - Returns 201 on success, 409 if the email is already on the waitlist or
 *     is already a registered user, 422 on validation errors.
 * =============================================================================
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";

const ROLE_INTERESTS = [
  "citizen_reporter",
  "field_inspector",
  "government_official",
  "researcher",
  "ngo",
  "other",
] as const;

const waitlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(200, "Password is too long"),
  organization: z
    .string()
    .trim()
    .max(160, "Organization name is too long")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  roleInterest: z.enum(ROLE_INTERESTS).default("citizen_reporter"),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = waitlistSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const { name, email, password, organization, roleInterest } = parsed.data;

  try {
    // Reject if the email is already a registered user (prevents account
    // hijack via waitlist re-approval).
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 },
      );
    }

    // Reject duplicate waitlist entries.
    const existingEntry = await db.waitlistEntry.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (existingEntry) {
      return NextResponse.json(
        {
          error:
            existingEntry.status === "approved"
              ? "This email has already been approved. Please sign in."
              : "You're already on the waitlist. We'll be in touch soon.",
          status: existingEntry.status,
        },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const entry = await db.waitlistEntry.create({
      data: {
        email,
        name,
        passwordHash,
        organization,
        roleInterest,
        status: "pending",
      },
      select: {
        id: true,
        email: true,
        name: true,
        roleInterest: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info("waitlist.submitted", {
      waitlistId: entry.id,
      email: entry.email,
      roleInterest: entry.roleInterest,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "You're on the waitlist! Our team will review your request shortly.",
        entry,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error("waitlist.submit_failed", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to join the waitlist. Please try again later." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to join the waitlist." },
    { status: 405 },
  );
}
