/** GET /api/v1/government/inspections/[id] */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getGovernmentService } from "@/modules/government";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const inspection = await getGovernmentService().getInspection(id);
  if (!inspection) return errorJson({ code: "not_found", message: "Inspection not found", status: 404 });
  return { status: 200, body: inspection };
});
