/**
 * GET /api/v1/feature-flags — list all feature flags.
 * PATCH /api/v1/feature-flags — toggle a flag (requires feature_flags:toggle).
 */

import { json, withAuth, withHandler, errorJson } from "@/lib/api";
import { getFeatureFlagService } from "@/modules/feature-flags";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const service = getFeatureFlagService();
  const flags = await service.list();
  return { status: 200, body: { flags, count: flags.length } };
});

export const PATCH = withAuth("feature_flags:toggle")(
  async (userId, req: NextRequest) => {
    const body = (await req.json().catch(() => null)) as
      | { key?: string; enabled?: boolean }
      | null;
    if (!body?.key || typeof body.enabled !== "boolean") {
      return errorJson({
        code: "invalid_request",
        message: "key (string) and enabled (boolean) are required",
        status: 400,
      });
    }
    await getFeatureFlagService().toggle(body.key, body.enabled, userId);
    return {
      status: 200,
      body: { key: body.key, enabled: body.enabled, toggledBy: userId },
    };
  },
);
