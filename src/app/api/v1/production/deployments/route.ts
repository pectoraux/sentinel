import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getProductionService } from "@/modules/production";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  return { status: 200, body: await getProductionService().listDeployments({ environment: url.searchParams.get("environment") ?? undefined }) };
});
