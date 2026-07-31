/**
 * GET /api/v1/intelligence/feed — community feed (recent events, public)
 */

import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const result = await getIntelligenceService().listEvents({ limit });
  return { status: 200, body: result };
});
