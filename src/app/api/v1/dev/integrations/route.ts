/** GET /api/v1/dev/integrations — list third-party integrations */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  return { status: 200, body: await getDeveloperService().listIntegrations({ category }) };
});
