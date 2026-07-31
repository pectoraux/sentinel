/** GET /api/v1/dev/webhooks/[id] — get webhook endpoint with delivery history */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const webhook = await getDeveloperService().getWebhook(id);
  if (!webhook) return errorJson({ code: "not_found", message: "Webhook not found", status: 404 });
  return { status: 200, body: webhook };
});
