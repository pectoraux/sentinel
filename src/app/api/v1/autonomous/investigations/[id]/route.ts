import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getAutonomousInvestigationService } from "@/modules/autonomous";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const inv = await getAutonomousInvestigationService().getById(id);
  if (!inv) return errorJson({ code: "not_found", message: "Investigation not found", status: 404 });
  return { status: 200, body: inv };
});
