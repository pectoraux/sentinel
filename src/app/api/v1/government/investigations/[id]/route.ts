/** GET /api/v1/government/investigations/[id] */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getGovernmentService } from "@/modules/government";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const investigation = await getGovernmentService().getInvestigation(id);
  if (!investigation) return errorJson({ code: "not_found", message: "Investigation not found", status: 404 });
  return { status: 200, body: investigation };
});
