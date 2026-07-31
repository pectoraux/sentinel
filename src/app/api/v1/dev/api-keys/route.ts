/** GET /api/v1/dev/api-keys — list API keys */
/** POST /api/v1/dev/api-keys — create API key */
import { NextRequest } from "next/server";
import { withHandler, withAuth, errorJson } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  return { status: 200, body: await getDeveloperService().listApiKeys() };
});

export const POST = withAuth("identity:review_verifications")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    scopes?: string[];
    rateLimitPerMin?: number;
    rateLimitPerDay?: number;
  } | null;

  if (!body?.name || !body.scopes || !Array.isArray(body.scopes)) {
    return errorJson({ code: "invalid_request", message: "name, scopes (array) required", status: 400 });
  }

  return { status: 201, body: await getDeveloperService().createApiKey(body) };
});
