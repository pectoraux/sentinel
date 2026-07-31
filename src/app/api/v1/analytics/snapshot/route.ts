/** POST /api/v1/analytics/snapshot — save a snapshot for trend tracking */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getAnalyticsService } from "@/modules/analytics";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["hotspots", "environmental", "response_times", "community", "trust", "rewards"];

export const POST = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const category = url.searchParams.get("category");
  const period = url.searchParams.get("period") ?? "daily";

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return errorJson({ code: "invalid_request", message: `category (one of: ${VALID_CATEGORIES.join(", ")}) required`, status: 400 });
  }

  const result = await getAnalyticsService().saveSnapshot(category as any, period);
  return { status: 201, body: result };
});
