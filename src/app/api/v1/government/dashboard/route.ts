/** GET /api/v1/government/dashboard?level=national|regional|district&region=X&district=Y */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getGovernmentService } from "@/modules/government";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const level = url.searchParams.get("level") ?? "national";
  const region = url.searchParams.get("region") ?? undefined;
  const district = url.searchParams.get("district") ?? undefined;

  if (level === "national") {
    return { status: 200, body: await getGovernmentService().getNationalDashboard() };
  }
  if (level === "regional") {
    if (!region) return errorJson({ code: "invalid_request", message: "region required for regional level", status: 400 });
    return { status: 200, body: await getGovernmentService().getRegionalDashboard(region) };
  }
  if (level === "district") {
    if (!region || !district) return errorJson({ code: "invalid_request", message: "region and district required for district level", status: 400 });
    return { status: 200, body: await getGovernmentService().getDistrictDashboard(region, district) };
  }
  return errorJson({ code: "invalid_request", message: "level must be national, regional, or district", status: 400 });
});
