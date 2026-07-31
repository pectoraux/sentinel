/** GET /api/v1/hotspots — list hotspot predictions */
import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getHotspotService } from "@/modules/hotspots";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const riskLevel = url.searchParams.get("riskLevel") ?? undefined;
  const minProbability = url.searchParams.get("minProbability") ? Number(url.searchParams.get("minProbability")) : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return { status: 200, body: await getHotspotService().list({ type, riskLevel, minProbability, limit }) };
});
