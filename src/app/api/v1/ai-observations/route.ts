/** GET /api/v1/ai-observations — list observations */
/** POST /api/v1/ai-observations — create from detection (body: { detectionResultId }) or batch (body: { all: true }) */
import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getObservationService } from "@/modules/ai-observations";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const minConfidence = url.searchParams.get("minConfidence") ? Number(url.searchParams.get("minConfidence")) : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return { status: 200, body: await getObservationService().list({ type, severity, minConfidence, limit }) };
});

export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { detectionResultId?: string; all?: boolean } | null;
  if (body?.all) {
    return { status: 200, body: await getObservationService().createFromAllDetections() };
  }
  if (!body?.detectionResultId) {
    return errorJson({ code: "invalid_request", message: "detectionResultId or all=true required", status: 400 });
  }
  return { status: 201, body: await getObservationService().createFromDetection({ detectionResultId: body.detectionResultId, triggeredBy: userId }) };
});
