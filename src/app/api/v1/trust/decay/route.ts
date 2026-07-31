/** POST /api/v1/trust/decay — apply decay to all users */
import { json, withAuth } from "@/lib/api";
import { getCivilTrustService } from "@/modules/trust";
export const dynamic = "force-dynamic";
export const POST = withAuth("system:admin")(async () => {
  const result = await getCivilTrustService().applyDecayAll();
  return { status: 200, body: result };
});
