/**
 * GET /api/v1/twin/graph — entity graph (nodes + edges) for visualization
 */

import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getTwinSummaryService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const graph = await getTwinSummaryService().graph({ type, limit });
  return { status: 200, body: graph };
});
