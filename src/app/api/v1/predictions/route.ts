/** GET /api/v1/predictions — list predictions */
import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getPredictionService } from "@/modules/predictions";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const riskLevel = url.searchParams.get("riskLevel") ?? undefined;
  const minRisk = url.searchParams.get("minRisk") ? Number(url.searchParams.get("minRisk")) : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return { status: 200, body: await getPredictionService().list({ type, riskLevel, minRisk, limit }) };
});
