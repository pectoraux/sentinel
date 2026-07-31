/** GET /api/v1/simulations/scenarios/[id] */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getSimulationService } from "@/modules/simulation";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const scenario = await getSimulationService().getById(id);
  if (!scenario) return errorJson({ code: "not_found", message: "Scenario not found", status: 404 });
  return { status: 200, body: scenario };
});
