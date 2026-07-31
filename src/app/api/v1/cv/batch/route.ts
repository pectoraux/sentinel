/** GET /api/v1/cv/batch — list detection batches */
import { json, withHandler } from "@/lib/api";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => {
  const batches = await db.detectionBatch.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  return { status: 200, body: { batches } };
});
