/** GET /api/v1/satellite/archive — historical archive */
import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getSatelliteIngestionService } from "@/modules/satellite";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const satellite = req.nextUrl.searchParams.get("satellite") ?? undefined;
  return { status: 200, body: await getSatelliteIngestionService().getArchive({ satellite }) };
});
