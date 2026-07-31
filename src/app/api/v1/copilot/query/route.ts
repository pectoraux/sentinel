/** POST /api/v1/copilot/query — natural language query to the Digital Twin AI Copilot */
import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getCopilotService } from "@/modules/copilot";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function err(code: string, message: string, status: number): ApiResult {
  return { status, body: { error: code, message } };
}

export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { question?: string; conversationId?: string }
    | null;

  if (!body?.question) {
    return err("invalid_request", "question is required", 400);
  }

  // Demo mode: use demo-user as the userId (auth bypassed at middleware via demo cookie).
  const userId = "demo-user";

  try {
    const result = await getCopilotService().query({
      question: body.question,
      conversationId: body.conversationId,
      userId,
    });

    return { status: 200, body: result };
  } catch (error) {
    logger.error("copilot.query.error", { error: error instanceof Error ? error.message : String(error) });
    return err("query_failed", error instanceof Error ? error.message : "Query failed", 500);
  }
});
