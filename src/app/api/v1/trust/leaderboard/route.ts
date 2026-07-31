/** GET /api/v1/trust/leaderboard?limit= */
import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getCivilTrustService } from "@/modules/trust";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  return { status: 200, body: await getCivilTrustService().leaderboard(limit) };
});
