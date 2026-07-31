/** GET /api/v1/fusion — list fusion results */
/** POST /api/v1/fusion — fuse for event (body: { eventId }) or batch (body: { all: true }) */
import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getFusionService } from "@/modules/fusion";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const minConfidence = url.searchParams.get("minConfidence") ? Number(url.searchParams.get("minConfidence")) : undefined;
  const hasConflict = url.searchParams.get("hasConflict") === "true" ? true : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return { status: 200, body: await getFusionService().list({ minConfidence, hasConflict, limit }) };
});

export const POST = withAuth("identity:submit_verification")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { eventId?: string; all?: boolean } | null;
  if (body?.all) {
    return { status: 200, body: await getFusionService().fuseAll() };
  }
  if (!body?.eventId) {
    return errorJson({ code: "invalid_request", message: "eventId or all=true required", status: 400 });
  }
  return { status: 201, body: await getFusionService().fuseForEvent(body.eventId) };
});
