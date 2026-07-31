/** GET /api/v1/analytics/category/[category] — KPIs for a specific category */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getAnalyticsService } from "@/modules/analytics";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["hotspots", "environmental", "response_times", "community", "trust", "rewards"];

export const GET = withHandler(async (req: NextRequest) => {
  const category = req.nextUrl.pathname.split("/").pop()!;
  if (!VALID_CATEGORIES.includes(category)) {
    return errorJson({ code: "invalid_request", message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`, status: 400 });
  }
  const result = await getAnalyticsService().computeCategoryKPIs(category as any);
  return { status: 200, body: result };
});
