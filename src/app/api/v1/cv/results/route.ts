/** GET /api/v1/cv/results — list detection results */
import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getCVService } from "@/modules/cv";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const detected = url.searchParams.get("detected") === "true" ? true : undefined;
  const minConfidence = url.searchParams.get("minConfidence") ? Number(url.searchParams.get("minConfidence")) : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return { status: 200, body: await getCVService().listResults({ type, detected, minConfidence, limit, offset }) };
});
