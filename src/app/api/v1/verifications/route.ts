/**
 * GET /api/v1/verifications — list identity verifications (requires identity:review_verifications)
 * POST /api/v1/verifications — submit a verification (requires identity:submit_verification)
 */

import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getIdentityVerificationService } from "@/modules/identity";

export const dynamic = "force-dynamic";

export const GET = withAuth("identity:review_verifications")(async (_userId, req: NextRequest) => {
  const url = req.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const userId = url.searchParams.get("userId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await getIdentityVerificationService().list({
    status,
    type,
    userId,
    limit,
    offset,
  });
  return { status: 200, body: result };
});

export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { type?: string; organizationId?: string; documentReference?: string; submittedData?: Record<string, unknown> }
    | null;
  if (!body?.type) {
    return errorJson({ code: "invalid_request", message: "type is required", status: 400 });
  }
  const result = await getIdentityVerificationService().submit({
    userId,
    type: body.type,
    organizationId: body.organizationId,
    documentReference: body.documentReference,
    submittedData: body.submittedData,
  });
  return { status: 201, body: result };
});
