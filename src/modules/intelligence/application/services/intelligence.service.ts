/**
 * Sentinel — Community Intelligence Application Service
 * =============================================================================
 * Event-sourced service: every action appends to the EventStreamEntry table,
 * then the projection (IntelligenceEvent) is updated by folding the stream.
 *
 * This guarantees:
 *   - Complete audit trail (every comment, subscription, share is recorded)
 *   - Rebuildable projections (the stream is the source of truth)
 *   - M5 temporal integration (stream events have timestamps → time travel)
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import type {
  IntelligenceEventType,
  EventStreamEvent,
} from "../../domain/events/intelligence-events";

// ---------------------------------------------------------------------------
// IntelligenceService
// ---------------------------------------------------------------------------

export class IntelligenceService {
  /**
   * Create a new intelligence event. Appends a "created" event to the stream
   * and creates the projection.
   */
  async createEvent(params: {
    key: string;
    title: string;
    description?: string;
    type: string;
    severity?: string;
    lat?: number;
    lng?: number;
    locationName?: string;
    evidenceIds?: string[];
    createdById: string;
    organizationId?: string;
    twinEntityId?: string;
  }): Promise<{ id: string; streamVersion: number }> {
    const event = await db.intelligenceEvent.create({
      data: {
        key: params.key,
        title: params.title,
        description: params.description,
        type: params.type,
        severity: params.severity ?? "medium",
        lat: params.lat,
        lng: params.lng,
        locationName: params.locationName,
        createdById: params.createdById,
        organizationId: params.organizationId,
        twinEntityId: params.twinEntityId,
        evidenceIds: params.evidenceIds ? JSON.stringify(params.evidenceIds) : null,
        streamVersion: 1,
      },
    });

    // Append "created" event to the stream
    await this.appendEvent(event.id, {
      eventType: "created",
      actorId: params.createdById,
      actorType: "user",
      payload: {
        title: params.title,
        description: params.description,
        type: params.type,
        severity: params.severity ?? "medium",
        lat: params.lat,
        lng: params.lng,
        locationName: params.locationName,
        evidenceIds: params.evidenceIds ?? [],
      },
    });

    // Outbox for cross-context event bus
    await db.outboxEvent.create({
      data: {
        aggregateType: "IntelligenceEvent",
        aggregateId: event.id,
        eventType: "intelligence.event.created",
        payload: JSON.stringify({ type: params.type, key: params.key, title: params.title }),
        status: "pending",
      },
    });

    logger.info("intelligence.event.created", { id: event.id, type: params.type, key: params.key });
    return { id: event.id, streamVersion: 1 };
  }

  /**
   * Add a comment. Appends a "commented" event and increments the projection.
   */
  async comment(params: {
    eventId: string;
    authorId: string;
    body: string;
    parentId?: string;
    attachments?: string[];
  }): Promise<{ commentId: string; streamVersion: number }> {
    const comment = await db.eventComment.create({
      data: {
        eventId: params.eventId,
        authorId: params.authorId,
        body: params.body,
        parentId: params.parentId,
        attachments: params.attachments ? JSON.stringify(params.attachments) : null,
      },
    });

    const version = await this.appendEvent(params.eventId, {
      eventType: "commented",
      actorId: params.authorId,
      actorType: "user",
      payload: {
        commentId: comment.id,
        body: params.body,
        parentId: params.parentId,
        attachments: params.attachments ?? [],
      },
    });

    await db.intelligenceEvent.update({
      where: { id: params.eventId },
      data: { commentCount: { increment: 1 }, streamVersion: version, updatedAt: new Date() },
    });

    return { commentId: comment.id, streamVersion: version };
  }

  /**
   * Subscribe (watch / follow / mute). Appends a "subscribed" event.
   */
  async subscribe(params: {
    eventId: string;
    userId: string;
    type: "watch" | "follow" | "mute";
  }): Promise<{ subscriptionId: string; streamVersion: number }> {
    // Remove existing subscription of this type (idempotent)
    await db.eventSubscription.deleteMany({
      where: { eventId: params.eventId, userId: params.userId, type: params.type },
    });

    const sub = await db.eventSubscription.create({
      data: {
        eventId: params.eventId,
        userId: params.userId,
        type: params.type,
      },
    });

    const version = await this.appendEvent(params.eventId, {
      eventType: "subscribed",
      actorId: params.userId,
      actorType: "user",
      payload: { userId: params.userId, subscriptionType: params.type },
    });

    // Update projection counters
    const updateData: Record<string, unknown> = { streamVersion: version, updatedAt: new Date() };
    if (params.type === "watch") {
      updateData.watcherCount = { increment: 1 };
      updateData.subscriberCount = { increment: 1 };
    } else if (params.type === "follow") {
      updateData.subscriberCount = { increment: 1 };
    }
    await db.intelligenceEvent.update({
      where: { id: params.eventId },
      data: updateData,
    });

    return { subscriptionId: sub.id, streamVersion: version };
  }

  /**
   * Unsubscribe. Appends an "unsubscribed" event.
   */
  async unsubscribe(params: {
    eventId: string;
    userId: string;
    type: "watch" | "follow" | "mute";
  }): Promise<{ streamVersion: number }> {
    await db.eventSubscription.deleteMany({
      where: { eventId: params.eventId, userId: params.userId, type: params.type },
    });

    const version = await this.appendEvent(params.eventId, {
      eventType: "unsubscribed",
      actorId: params.userId,
      actorType: "user",
      payload: { userId: params.userId, subscriptionType: params.type },
    });

    // Decrement projection counters
    const updateData: Record<string, unknown> = { streamVersion: version, updatedAt: new Date() };
    if (params.type === "watch") {
      updateData.watcherCount = { decrement: 1 };
      updateData.subscriberCount = { decrement: 1 };
    } else if (params.type === "follow") {
      updateData.subscriberCount = { decrement: 1 };
    }
    await db.intelligenceEvent.update({
      where: { id: params.eventId },
      data: updateData,
    });

    return { streamVersion: version };
  }

  /**
   * Share an event. Appends a "shared" event.
   */
  async share(params: {
    eventId: string;
    sharedById: string;
    platform: string;
    recipientId?: string;
    message?: string;
  }): Promise<{ shareId: string; streamVersion: number }> {
    const share = await db.eventShare.create({
      data: {
        eventId: params.eventId,
        sharedById: params.sharedById,
        platform: params.platform,
        recipientId: params.recipientId,
        message: params.message,
      },
    });

    const version = await this.appendEvent(params.eventId, {
      eventType: "shared",
      actorId: params.sharedById,
      actorType: "user",
      payload: { platform: params.platform, recipientId: params.recipientId, message: params.message },
    });

    await db.intelligenceEvent.update({
      where: { id: params.eventId },
      data: { shareCount: { increment: 1 }, streamVersion: version, updatedAt: new Date() },
    });

    return { shareId: share.id, streamVersion: version };
  }

  /**
   * Record a view. Appends a "viewed" event (fire-and-forget, no projection update needed for every view).
   */
  async view(eventId: string, userId?: string, ip?: string): Promise<void> {
    await this.appendEvent(eventId, {
      eventType: "viewed",
      actorId: userId,
      actorType: userId ? "user" : "anonymous",
      payload: { userId, ip },
    });

    await db.intelligenceEvent.update({
      where: { id: eventId },
      data: { viewCount: { increment: 1 } },
    });
  }

  /**
   * Change status. Appends a "status_changed" event.
   */
  async changeStatus(eventId: string, newStatus: string, actorId: string, reason?: string): Promise<{ streamVersion: number }> {
    const current = await db.intelligenceEvent.findUnique({ where: { id: eventId } });
    if (!current) throw new Error("event_not_found");

    const version = await this.appendEvent(eventId, {
      eventType: "status_changed",
      actorId,
      actorType: "user",
      payload: { from: current.status, to: newStatus, reason },
    });

    await db.intelligenceEvent.update({
      where: { id: eventId },
      data: { status: newStatus, streamVersion: version, updatedAt: new Date() },
    });

    return { streamVersion: version };
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async listEvents(params?: {
    type?: string;
    status?: string;
    severity?: string;
    organizationId?: string;
    createdById?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.createdById) where.createdById = filters.createdById;

    const [events, total] = await Promise.all([
      db.intelligenceEvent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { comments: true, subscriptions: true, shares: true } },
        },
      }),
      db.intelligenceEvent.count({ where }),
    ]);

    return {
      events: events.map((e) => this.serializeEvent(e)),
      total,
    };
  }

  async getEventById(id: string) {
    const event = await db.intelligenceEvent.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: "asc" },
          take: 50,
        },
        subscriptions: { where: { type: "watch" }, take: 20 },
        shares: { orderBy: { createdAt: "desc" }, take: 10 },
        _count: { select: { comments: true, subscriptions: true, shares: true, stream: true } },
      },
    });
    if (!event) return null;
    return this.serializeEvent(event);
  }

  /**
   * Get the full event stream (the source of truth) for an intelligence event.
   * Used for replay, audit, and temporal queries.
   */
  async getEventStream(eventId: string, from?: Date, to?: Date) {
    const where: Record<string, unknown> = { eventId };
    if (from || to) {
      where.timestamp = {};
      if (from) (where.timestamp as { gte?: Date }).gte = from;
      if (to) (where.timestamp as { lte?: Date }).lte = to;
    }

    const entries = await db.eventStreamEntry.findMany({
      where,
      orderBy: { version: "asc" },
    });

    return {
      eventId,
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      entryCount: entries.length,
      stream: entries.map((e) => ({
        id: e.id,
        version: e.version,
        eventType: e.eventType,
        actorId: e.actorId,
        actorType: e.actorType,
        payload: e.payload ? JSON.parse(e.payload) : null,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
        timestamp: e.timestamp,
      })),
    };
  }

  /**
   * Get comments for an event (threaded).
   */
  async getComments(eventId: string) {
    const comments = await db.eventComment.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
    return {
      comments: comments.map((c) => ({
        ...c,
        attachments: c.attachments ? JSON.parse(c.attachments) : null,
      })),
    };
  }

  /**
   * Aggregate summary metrics.
   */
  async summary() {
    const [
      total,
      byType,
      byStatus,
      bySeverity,
      totalComments,
      totalSubscriptions,
      totalShares,
      totalStreamEntries,
      recentEvents,
    ] = await Promise.all([
      db.intelligenceEvent.count(),
      db.intelligenceEvent.groupBy({ by: ["type"], _count: true }),
      db.intelligenceEvent.groupBy({ by: ["status"], _count: true }),
      db.intelligenceEvent.groupBy({ by: ["severity"], _count: true }),
      db.eventComment.count(),
      db.eventSubscription.count(),
      db.eventShare.count(),
      db.eventStreamEntry.count(),
      db.intelligenceEvent.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { comments: true, subscriptions: true, shares: true } } },
      }),
    ]);

    return {
      total,
      byType: byType.map((g) => ({ type: g.type, count: g._count })),
      byStatus: byStatus.map((g) => ({ status: g.status, count: g._count })),
      bySeverity: bySeverity.map((g) => ({ severity: g.severity, count: g._count })),
      totalComments,
      totalSubscriptions,
      totalShares,
      totalStreamEntries,
      recentEvents: recentEvents.map((e) => this.serializeEvent(e)),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Append an event to the stream. Returns the new version number.
   */
  private async appendEvent(eventId: string, event: {
    eventType: IntelligenceEventType;
    actorId?: string;
    actorType?: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    // Get current version
    const current = await db.intelligenceEvent.findUnique({
      where: { id: eventId },
      select: { streamVersion: true },
    });
    const version = (current?.streamVersion ?? 0) + 1;

    await db.eventStreamEntry.create({
      data: {
        eventId,
        version,
        eventType: event.eventType,
        actorId: event.actorId,
        actorType: event.actorType ?? "user",
        payload: JSON.stringify(event.payload),
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });

    return version;
  }

  private serializeEvent(e: any) {
    return {
      id: e.id,
      key: e.key,
      title: e.title,
      description: e.description,
      type: e.type,
      status: e.status,
      severity: e.severity,
      lat: e.lat,
      lng: e.lng,
      locationName: e.locationName,
      createdById: e.createdById,
      organizationId: e.organizationId,
      twinEntityId: e.twinEntityId,
      evidenceIds: e.evidenceIds ? JSON.parse(e.evidenceIds) : [],
      commentCount: e.commentCount ?? e._count?.comments ?? 0,
      subscriberCount: e.subscriberCount ?? e._count?.subscriptions ?? 0,
      watcherCount: e.watcherCount ?? 0,
      shareCount: e.shareCount ?? e._count?.shares ?? 0,
      viewCount: e.viewCount ?? 0,
      streamVersion: e.streamVersion ?? 0,
      streamEntryCount: e._count?.stream ?? 0,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      comments: e.comments?.map((c: any) => ({
        ...c,
        attachments: c.attachments ? JSON.parse(c.attachments) : null,
      })),
      shares: e.shares?.map((s: any) => s),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _svc: IntelligenceService | null = null;
export function getIntelligenceService(): IntelligenceService {
  if (!_svc) _svc = new IntelligenceService();
  return _svc;
}
