/** GET /api/v1/missions — list missions */
import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const priority = url.searchParams.get("priority") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return { status: 200, body: await getMissionService().list({ status, type, priority, limit }) };
});
