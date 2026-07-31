/** POST /api/v1/simulations/run — run a simulation scenario */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getSimulationService } from "@/modules/simulation";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    interventionType?: string;
    interventionParams?: Record<string, number>;
    timeHorizonMonths?: number;
    region?: string;
    district?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    isBaseline?: boolean;
    createdBy?: string;
  } | null;

  if (!body?.interventionType || !body.timeHorizonMonths) {
    return errorJson({ code: "invalid_request", message: "interventionType, timeHorizonMonths required", status: 400 });
  }

  const validTypes = ["baseline", "increase_inspections", "protect_watershed", "close_roads", "deploy_drones", "combined"];
  if (!validTypes.includes(body.interventionType)) {
    return errorJson({ code: "invalid_request", message: `interventionType must be one of: ${validTypes.join(", ")}`, status: 400 });
  }

  try {
    const result = await getSimulationService().runSimulation({
      name: body.name ?? `${body.interventionType} scenario`,
      description: body.description ?? "",
      interventionType: body.interventionType as any,
      interventionParams: body.interventionParams ?? {},
      timeHorizonMonths: body.timeHorizonMonths,
      region: body.region,
      district: body.district,
      locationName: body.locationName,
      lat: body.lat,
      lng: body.lng,
      radiusKm: body.radiusKm,
      isBaseline: body.isBaseline,
      createdBy: body.createdBy,
    });
    return { status: 201, body: result };
  } catch (e) {
    return errorJson({ code: "simulation_failed", message: e instanceof Error ? e.message : "Unknown error", status: 500 });
  }
});
