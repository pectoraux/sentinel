/** POST /api/v1/copilot/query — natural language query to the Digital Twin AI Copilot */
import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getCopilotService } from "@/modules/copilot";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withAuth("identity:switch_role")(async (userId, req: NextRequest) => {
  try {
    const body = (await req.json().catch(() => null)) as
      | { question?: string; conversationId?: string }
      | null;

    if (!body?.question) {
      return errorJson({ code: "invalid_request", message: "question is required", status: 400 });
    }

    const result = await getCopilotService().query({
      question: body.question,
      conversationId: body.conversationId,
      userId,
    });

    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("copilot.query.error", { error: error instanceof Error ? error.message : String(error) });
    return errorJson({ code: "query_failed", message: error instanceof Error ? error.message : "Query failed", status: 500 });
  }
});
