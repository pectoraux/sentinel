/**
 * GET /api/v1/roles — list RBAC roles + permissions (requires roles:read).
 */

import { json, withAuth } from "@/lib/api";
import { getIamService } from "@/modules/iam/application/services/iam.service";

export const dynamic = "force-dynamic";

export const GET = withAuth("roles:read")(async () => {
  const roles = await getIamService().listRoles();
  return { status: 200, body: { roles, count: roles.length } };
});
