/**
 * Sentinel — Digital Twin AI Copilot Service
 * =============================================================================
 * Natural language interface to the Digital Twin. Uses the real LLM via
 * z-ai-web-dev-sdk to answer questions about the platform's data.
 *
 * Examples:
 *   "Show illegal mining near Pra River."
 *   "Why is this event high confidence?"
 *   "What's the risk to Atewa Forest?"
 *   "Explain the sediment prediction for Offin River."
 *
 * The copilot:
 *   1. Parses the user's natural language query
 *   2. Retrieves relevant data from the platform (twin entities, events,
 *      detections, predictions, fusion results)
 *   3. Constructs a context-rich prompt for the LLM
 *   4. Returns a natural language answer with referenced entities/events
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";

const SYSTEM_PROMPT = `You are Sentinel, an AI Copilot for an environmental intelligence platform monitoring illegal mining in Ghana.

You have access to real platform data including:
- Digital Twin entities (rivers, mines, forests, communities, protected areas, equipment)
- Intelligence events (citizen reports, AI observations)
- Computer Vision detections (excavation, roads, tailings, forest loss, water changes)
- Evidence fusion results (multi-source confidence scores)
- Environmental predictions (sediment, river impact, forest loss, downstream effects, protected area risk)
- Hotspot predictions (illegal mining hotspots, expansion forecasts)
- AI observations with reasoning chains
- Satellite scenes and imagery
- Trust scores and corroboration data

Answer questions naturally and concisely. When referencing specific entities, events, or predictions, mention them by name. If asked about confidence or reasoning, explain the factors that contribute to the score. If the data doesn't fully answer the question, say so and suggest what data would help.

Always be specific — use the actual data provided, not generic responses.`;

export class CopilotService {
  private zaiInstance: any = null;

  private async getLLM() {
    if (!this.zaiInstance) {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      this.zaiInstance = await ZAI.create();
    }
    return this.zaiInstance;
  }

  /**
   * Process a natural language query about the Digital Twin.
   * Retrieves relevant data and uses the LLM to generate a response.
   */
  async query(params: {
    question: string;
    conversationId?: string;
    userId?: string;
  }): Promise<{
    conversationId: string;
    messageId: string;
    response: string;
    retrievedData: Record<string, unknown>;
    referencedEntities: string[];
    referencedEvents: string[];
  }> {
    const startTime = Date.now();

    // 1. Retrieve relevant data based on the question
    const retrieved = await this.retrieveContext(params.question);

    // 2. Construct the prompt with real data
    const contextPrompt = this.buildContextPrompt(params.question, retrieved);

    // 3. Get conversation history (if exists) — best-effort
    let messages: Array<{ role: string; content: string }> = [
      { role: "assistant", content: SYSTEM_PROMPT },
    ];

    if (params.conversationId) {
      try {
        const history = await db.copilotMessage.findMany({
          where: { conversationId: params.conversationId },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: { role: true, content: true },
        });
        for (const h of history) {
          messages.push({ role: h.role, content: h.content });
        }
      } catch (e) {
        logger.warn("copilot.history.failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    messages.push({ role: "user", content: contextPrompt });

    // 4. Call the LLM (with graceful fallback if SDK fails)
    let response: string;
    try {
      const zai = await this.getLLM();
      const completion = await zai.chat.completions.create({
        messages: messages as any,
        thinking: { type: "disabled" },
      });
      response = completion.choices[0]?.message?.content || "I couldn't process that query.";
    } catch (llmErr) {
      logger.warn("copilot.llm.fallback", {
        error: llmErr instanceof Error ? llmErr.message : String(llmErr),
      });
      // Fallback: synthesize a deterministic answer from the retrieved data
      response = this.synthesizeFallback(params.question, retrieved.summary);
    }
    const processingMs = Date.now() - startTime;

    // 5. Create or update conversation — best-effort persistence
    let conversationId = params.conversationId;
    if (!conversationId) {
      try {
        const title = params.question.slice(0, 60) + (params.question.length > 60 ? "..." : "");
        const conv = await db.copilotConversation.create({
          data: {
            userId: params.userId,
            title,
            context: JSON.stringify({ entities: retrieved.entityIds, events: retrieved.eventIds }),
            messageCount: 0,
          },
        });
        conversationId = conv.id;
      } catch (e) {
        logger.warn("copilot.conversation.create.failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 6. Save user message — best-effort
    if (conversationId) {
      try {
        await db.copilotMessage.create({
          data: {
            conversationId,
            role: "user",
            content: params.question,
          },
        });
      } catch (e) {
        logger.warn("copilot.message.user.failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 7. Save assistant response — best-effort
    let assistantMsgId: string | undefined;
    if (conversationId) {
      try {
        const assistantMsg = await db.copilotMessage.create({
          data: {
            conversationId,
            role: "assistant",
            content: response,
            retrievedData: JSON.stringify(retrieved.summary),
            referencedEntities: JSON.stringify(retrieved.entityIds),
            referencedEvents: JSON.stringify(retrieved.eventIds),
            model: "llm-zai",
            processingMs,
          },
        });
        assistantMsgId = assistantMsg.id;
      } catch (e) {
        logger.warn("copilot.message.assistant.failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 8. Update conversation count — best-effort
    if (conversationId) {
      try {
        await db.copilotConversation.update({
          where: { id: conversationId },
          data: { messageCount: { increment: 2 }, updatedAt: new Date() },
        });
      } catch (e) {
        logger.warn("copilot.conversation.update.failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    logger.info("copilot.query", {
      conversationId,
      messageId: assistantMsgId,
      processingMs,
      entitiesReferenced: retrieved.entityIds.length,
    });

    return {
      conversationId: conversationId ?? "",
      messageId: assistantMsgId ?? "",
      response,
      retrievedData: retrieved.summary,
      referencedEntities: retrieved.entityIds,
      referencedEvents: retrieved.eventIds,
    };
  }

  /**
   * Retrieve relevant platform data based on the natural language question.
   * Uses keyword matching to find relevant entities, events, predictions, etc.
   * Wrapped in try/catch so a Prisma/datasource error doesn't crash the LLM
   * call — we'll synthesize a fallback answer from whatever we have.
   */
  private async retrieveContext(question: string): Promise<{
    entityIds: string[];
    eventIds: string[];
    summary: Record<string, unknown>;
  }> {
    const q = question.toLowerCase();
    const entityIds: string[] = [];
    const eventIds: string[] = [];
    const summary: Record<string, unknown> = {};

    // Search twin entities by name (case-insensitive on both SQLite & Postgres)
    try {
      const entities = await db.twinEntity.findMany({
        where: {
          OR: [
            { name: { contains: question } },
            { key: { contains: question } },
          ],
        },
        take: 5,
        select: { id: true, name: true, type: true, status: true, description: true, lat: true, lng: true, metadata: true },
      });
      if (entities.length > 0) {
        entityIds.push(...entities.map((e) => e.id));
        summary.entities = entities.map((e) => ({
          name: e.name, type: e.type, status: e.status,
          description: e.description?.slice(0, 200),
          lat: e.lat, lng: e.lng,
        }));
      }
    } catch (e) {
      logger.warn("copilot.retrieve.entities.failed", { error: e instanceof Error ? e.message : String(e) });
    }

    // All subsequent retrieval queries are best-effort: if any one fails
    // (e.g. schema mismatch, datasource error), we still want to return
    // whatever context we managed to gather so the LLM/fallback can answer.
    try {
      // If asking about mining, get mines
      if (q.includes("mining") || q.includes("mine") || q.includes("galamsey") || q.includes("excavation")) {
        const mines = await db.twinEntity.findMany({
          where: { type: "mine" },
          take: 5,
          select: { id: true, name: true, status: true, lat: true, lng: true, metadata: true },
        });
        entityIds.push(...mines.map((m) => m.id));
        summary.mines = mines.map((m) => ({ name: m.name, status: m.status, lat: m.lat, lng: m.lng }));
      }

      // If asking about rivers/water
      if (q.includes("river") || q.includes("water") || q.includes("pra") || q.includes("offin") || q.includes("ankobra") || q.includes("sediment") || q.includes("pollution")) {
        const rivers = await db.twinEntity.findMany({
          where: { type: "river" },
          take: 5,
          select: { id: true, name: true, status: true, lat: true, lng: true, metadata: true },
        });
        entityIds.push(...rivers.map((r) => r.id));
        summary.rivers = rivers.map((r) => ({ name: r.name, status: r.status, metadata: r.metadata ? JSON.parse(r.metadata) : null }));
      }

      // If asking about forests
      if (q.includes("forest") || q.includes("deforestation") || q.includes("canopy") || q.includes("atewa")) {
        const forests = await db.twinEntity.findMany({
          where: { type: "forest" },
          take: 5,
          select: { id: true, name: true, status: true, metadata: true },
        });
        entityIds.push(...forests.map((f) => f.id));
        summary.forests = forests.map((f) => ({ name: f.name, status: f.status }));
      }

      // If asking about confidence/trust/fusion
      if (q.includes("confidence") || q.includes("trust") || q.includes("why") || q.includes("score") || q.includes("fusion")) {
        const fusions = await db.fusionResult.findMany({
          take: 5,
          orderBy: { fusedConfidence: "desc" },
          include: { sources: { take: 5, orderBy: { weightedScore: "desc" } } },
        });
        summary.fusions = fusions.map((f) => ({
          fusedConfidence: f.fusedConfidence,
          fusedSeverity: f.fusedSeverity,
          sourceCount: f.sourceCount,
          consensusLevel: f.consensusLevel,
          hasConflict: f.hasConflict,
          locationName: f.locationName,
          sources: f.sources.map((s) => ({ type: s.sourceType, confidence: s.rawConfidence, weight: s.weight })),
        }));
      }

      // If asking about predictions/hotspots/risk
      if (q.includes("predict") || q.includes("hotspot") || q.includes("risk") || q.includes("expansion") || q.includes("future")) {
        const hotspots = await db.hotspotPrediction.findMany({
          take: 5,
          orderBy: { probability: "desc" },
          select: { id: true, type: true, locationName: true, probability: true, confidence: true, riskLevel: true, prediction: true, expansionDirection: true, expansionRadiusKm: true },
        });
        summary.hotspots = hotspots.map((h) => ({
          type: h.type, location: h.locationName, probability: h.probability,
          riskLevel: h.riskLevel, prediction: h.prediction?.slice(0, 200),
          expansion: h.expansionDirection ? `${h.expansionDirection} ${h.expansionRadiusKm}km` : null,
        }));

        const envPreds = await db.environmentalPrediction.findMany({
          take: 5,
          orderBy: { riskScore: "desc" },
          select: { id: true, type: true, targetName: true, riskScore: true, riskLevel: true, prediction: true },
        });
        summary.predictions = envPreds.map((p) => ({
          type: p.type, target: p.targetName, riskScore: p.riskScore,
          riskLevel: p.riskLevel, prediction: p.prediction?.slice(0, 200),
        }));
      }

      // If asking about observations/detections/AI
      if (q.includes("ai") || q.includes("detection") || q.includes("observation") || q.includes("vision")) {
        const observations = await db.aIObservation.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, type: true, severity: true, confidence: true, summary: true, reasoning: true },
        });
        summary.observations = observations.map((o) => ({
          title: o.title, type: o.type, severity: o.severity,
          confidence: o.confidence, summary: o.summary?.slice(0, 200),
        }));
      }

      // If asking about events/intelligence
      if (q.includes("event") || q.includes("report") || q.includes("intelligence") || q.includes("what")) {
        const events = await db.intelligenceEvent.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, type: true, severity: true, status: true, description: true, locationName: true },
        });
        eventIds.push(...events.map((e) => e.id));
        summary.events = events.map((e) => ({
          title: e.title, type: e.type, severity: e.severity, status: e.status,
          location: e.locationName, description: e.description?.slice(0, 200),
        }));
      }

      // Always include a platform overview
      const [twinCount, eventCount, detectionCount, fusionCount, predCount, hotspotCount] = await Promise.all([
        db.twinEntity.count(),
        db.intelligenceEvent.count(),
        db.detectionResult.count({ where: { detected: true } }),
        db.fusionResult.count(),
        db.environmentalPrediction.count(),
        db.hotspotPrediction.count(),
      ]);
      summary.platformOverview = { twinCount, eventCount, detectionCount, fusionCount, predCount, hotspotCount };
    } catch (e) {
      logger.warn("copilot.retrieve.context.partial", { error: e instanceof Error ? e.message : String(e) });
    }

    return { entityIds: [...new Set(entityIds)], eventIds: [...new Set(eventIds)], summary };
  }

  /**
   * Build a context-rich prompt for the LLM using retrieved data.
   */
  private buildContextPrompt(question: string, retrieved: { summary: Record<string, unknown> }): string {
    const dataStr = JSON.stringify(retrieved.summary, null, 2);
    return `User Question: "${question}"

Platform Data Retrieved:
${dataStr}

Based on the above real platform data, answer the user's question. Be specific and reference actual entities, events, and predictions by name. If the data is insufficient, say what's missing.`;
  }

  /**
   * Deterministic fallback when the LLM is unavailable.
   * Produces a concise answer from the retrieved summary data.
   */
  private synthesizeFallback(question: string, summary: Record<string, unknown>): string {
    const overview = summary.platformOverview as
      | { twinCount?: number; eventCount?: number; detectionCount?: number; fusionCount?: number; predCount?: number; hotspotCount?: number }
      | undefined;
    const lines: string[] = [];
    lines.push(`I couldn't reach the live LLM, but I retrieved real platform data for your question:`);
    lines.push("");
    lines.push(`Question: "${question}"`);
    if (overview) {
      lines.push("");
      lines.push(`Platform overview:`);
      lines.push(`- ${overview.twinCount ?? 0} twin entities`);
      lines.push(`- ${overview.eventCount ?? 0} intelligence events`);
      lines.push(`- ${overview.detectionCount ?? 0} CV detections`);
      lines.push(`- ${overview.fusionCount ?? 0} fusion results`);
      lines.push(`- ${overview.predCount ?? 0} environmental predictions`);
      lines.push(`- ${overview.hotspotCount ?? 0} hotspot predictions`);
    }
    if (Array.isArray(summary.entities) && summary.entities.length > 0) {
      lines.push("");
      lines.push(`Related entities:`);
      for (const e of summary.entities.slice(0, 5)) {
        const ent = e as { name?: string; type?: string; status?: string; description?: string };
        lines.push(`- ${ent.name ?? "Unknown"} (${ent.type ?? "?"}, ${ent.status ?? "?"})${ent.description ? ` — ${ent.description.slice(0, 80)}` : ""}`);
      }
    }
    if (Array.isArray(summary.events) && summary.events.length > 0) {
      lines.push("");
      lines.push(`Recent intelligence events:`);
      for (const e of summary.events.slice(0, 5)) {
        const ev = e as { title?: string; type?: string; severity?: string; status?: string; location?: string };
        lines.push(`- ${ev.title ?? "Unknown"} [${ev.severity ?? "?"}/${ev.status ?? "?"}]${ev.location ? ` @ ${ev.location}` : ""}`);
      }
    }
    if (Array.isArray(summary.fusions) && summary.fusions.length > 0) {
      lines.push("");
      lines.push(`Top fusion results:`);
      for (const f of summary.fusions.slice(0, 3)) {
        const fu = f as { fusedConfidence?: number; fusedSeverity?: string; sourceCount?: number; locationName?: string };
        lines.push(`- ${fu.locationName ?? "?"}: ${Math.round((fu.fusedConfidence ?? 0) * 100)}% confidence (${fu.fusedSeverity ?? "?"}, ${fu.sourceCount ?? 0} sources)`);
      }
    }
    if (Array.isArray(summary.hotspots) && summary.hotspots.length > 0) {
      lines.push("");
      lines.push(`Hotspot predictions:`);
      for (const h of summary.hotspots.slice(0, 3)) {
        const ho = h as { type?: string; location?: string; probability?: number; riskLevel?: string };
        lines.push(`- ${ho.location ?? "?"}: ${Math.round((ho.probability ?? 0) * 100)}% probability (${ho.riskLevel ?? "?"})`);
      }
    }
    lines.push("");
    lines.push(`Try again in a moment to get a fully synthesized LLM response.`);
    return lines.join("\n");
  }

  /**
   * Get conversation history.
   */
  async getConversation(conversationId: string) {
    const conv = await db.copilotConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conv) return null;
    return {
      ...conv,
      context: conv.context ? JSON.parse(conv.context) : null,
      messages: conv.messages.map((m) => ({
        ...m,
        retrievedData: m.retrievedData ? JSON.parse(m.retrievedData) : null,
        referencedEntities: m.referencedEntities ? JSON.parse(m.referencedEntities) : null,
        referencedEvents: m.referencedEvents ? JSON.parse(m.referencedEvents) : null,
      })),
    };
  }

  /**
   * List recent conversations.
   */
  async listConversations(limit = 20) {
    const convs = await db.copilotConversation.findMany({
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, messageCount: true, createdAt: true, updatedAt: true },
    });
    return { conversations: convs };
  }

  /**
   * Aggregate summary.
   */
  async summary() {
    const [totalConvs, totalMessages, avgProcessingMs, recentConvs] = await Promise.all([
      db.copilotConversation.count(),
      db.copilotMessage.count(),
      db.copilotMessage.aggregate({ _avg: { processingMs: true } }),
      db.copilotConversation.findMany({
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, messageCount: true, updatedAt: true },
      }),
    ]);

    return {
      totalConversations: totalConvs,
      totalMessages,
      avgProcessingMs: avgProcessingMs._avg.processingMs ?? 0,
      recentConversations: recentConvs,
    };
  }
}

let _svc: CopilotService | null = null;
export function getCopilotService(): CopilotService {
  if (!_svc) _svc = new CopilotService();
  return _svc;
}
