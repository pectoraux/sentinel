/** GET /api/v1/dev/webhooks — list webhook endpoints */
/** POST /api/v1/dev/webhooks — create webhook endpoint */
import { NextRequest } from "next/server";
import { withHandler, withAuth, errorJson } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const isActive = url.searchParams.get("isActive") === "true" ? true : url.searchParams.get("isActive") === "false" ? false : undefined;
  return { status: 200, body: await getDeveloperService().listWebhooks({ isActive }) };
});

export const POST = withAuth("identity:review_verifications")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    url?: string;
    events?: string[];
  } | null;

  if (!body?.name || !body.url || !body.events || !Array.isArray(body.events)) {
    return errorJson({ code: "invalid_request", message: "name, url, events (array) required", status: 400 });
  }

  return { status: 201, body: await getDeveloperService().createWebhook(body) };
});
