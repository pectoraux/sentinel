/** POST /api/v1/simulations/compare — compare multiple scenarios */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getSimulationService } from "@/modules/simulation";
export const dynamic = "force-dynamic";

export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    scenarioIds?: string[];
    createdBy?: string;
  } | null;

  if (!body?.scenarioIds || body.scenarioIds.length < 2) {
    return errorJson({ code: "invalid_request", message: "scenarioIds (array, min 2) required", status: 400 });
  }

  try {
    const result = await getSimulationService().compareScenarios({
      name: body.name ?? "Comparison",
      description: body.description,
      scenarioIds: body.scenarioIds,
      createdBy: body.createdBy,
    });
    return { status: 200, body: result };
  } catch (e) {
    return errorJson({ code: "comparison_failed", message: e instanceof Error ? e.message : "unknown", status: 400 });
  }
});
