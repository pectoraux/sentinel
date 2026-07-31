/** GET /api/v1/dev/sdk — list SDK releases */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const language = req.nextUrl.searchParams.get("language") ?? undefined;
  return { status: 200, body: await getDeveloperService().listSdkReleases({ language }) };
});
