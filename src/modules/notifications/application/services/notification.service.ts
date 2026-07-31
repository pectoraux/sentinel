/**
 * Sentinel — Notification Service
 * =============================================================================
 * Multi-channel notification system: Push, Email, SMS, In-app.
 * Supports geofenced subscriptions, interest subscriptions, digest mode,
 * and priority notifications.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  pointInCircularGeofence,
  pointInPolygonGeofence,
  matchInterest,
  type ChannelType,
  type Priority,
} from "../../domain/notification-types";

export class NotificationService {
  /**
   * Send a notification to a user via their preferred channels.
   */
  async send(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    priority?: Priority;
    data?: Record<string, unknown>;
    source?: string;
    matchedGeofence?: string;
    channels?: ChannelType[];
  }): Promise<{ id: string }> {
    const priority = params.priority ?? 1;
    const channels = params.channels ?? ["in_app" as ChannelType];

    const notification = await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        priority,
        channels: JSON.stringify(channels),
        data: params.data ? JSON.stringify(params.data) : null,
        source: params.source ?? "system",
        matchedGeofence: params.matchedGeofence,
        deliveryStatus: JSON.stringify(
          channels.map((ch) => ({
            channel: ch,
            status: ch === "in_app" ? "delivered" : "pending",
            deliveredAt: ch === "in_app" ? new Date().toISOString() : null,
          })),
        ),
      },
    });

    // In production, this would enqueue delivery jobs for push/email/SMS
    // via the background job system. For now, in_app is instant.
    logger.info("notification.sent", {
      id: notification.id,
      userId: params.userId,
      type: params.type,
      priority,
      channels,
    });

    return { id: notification.id };
  }

  /**
   * Broadcast a notification to all users matching a set of subscription criteria.
   * Used by the event bus handler when intelligence events are created.
   */
  async broadcast(params: {
    type: string;
    title: string;
    body: string;
    priority?: Priority;
    data?: Record<string, unknown>;
    source?: string;
    // Geofence matching
    lat?: number;
    lng?: number;
    // Interest matching
    eventType?: string;
    eventMetadata?: Record<string, unknown>;
    // Entity matching
    entityId?: string;
  }): Promise<{ sent: number; geofenceMatches: number; interestMatches: number }> {
    const priority = params.priority ?? 1;
    let sent = 0;
    let geofenceMatches = 0;
    let interestMatches = 0;

    // 1. Geofence subscriptions
    if (params.lat !== undefined && params.lng !== undefined) {
      const geofences = await db.geofenceSubscription.findMany({
        where: { isActive: true },
      });

      const matchedUserIds = new Set<string>();

      for (const gf of geofences) {
        let isMatch = false;

        if (gf.radiusM) {
          // Circular geofence
          isMatch = pointInCircularGeofence(
            params.lat,
            params.lng,
            gf.centerLat,
            gf.centerLng,
            gf.radiusM,
          );
        } else {
          // Polygon geofence
          try {
            const geojson = JSON.parse(gf.geojson);
            if (geojson?.geometry?.coordinates?.[0]) {
              isMatch = pointInPolygonGeofence(
                params.lat,
                params.lng,
                geojson.geometry.coordinates[0] as Array<[number, number]>,
              );
            }
          } catch {
            // invalid geojson
          }
        }

        if (isMatch && priority >= gf.minPriority) {
          matchedUserIds.add(gf.userId);
          geofenceMatches++;
          const channels: ChannelType[] = JSON.parse(gf.channels);
          await this.send({
            userId: gf.userId,
            type: params.type,
            title: params.title,
            body: params.body,
            priority,
            data: params.data,
            source: params.source ?? "event_bus",
            matchedGeofence: gf.name,
            channels,
          });
          sent++;
        }
      }
    }

    // 2. Interest subscriptions
    if (params.eventType) {
      const interests = matchInterest(params.eventType, params.eventMetadata ?? {});
      if (interests.length > 0) {
        const subs = await db.notificationSubscription.findMany({
          where: {
            subscriptionType: "interest",
            isActive: true,
            target: { in: interests },
          },
        });

        const matchedUserIds = new Set<string>();
        for (const sub of subs) {
          if (priority < sub.minPriority) continue;
          if (matchedUserIds.has(sub.userId)) continue;
          matchedUserIds.add(sub.userId);
          interestMatches++;

          // Check digest mode — if not "none", don't send immediately
          if (sub.digestMode !== "none") {
            // Create a notification with source="digest" — it will be batched
            await this.send({
              userId: sub.userId,
              type: params.type,
              title: params.title,
              body: params.body,
              priority,
              data: params.data,
              source: "digest",
              channels: ["in_app" as ChannelType], // digest will re-route to configured channels
            });
          } else {
            const channels: ChannelType[] = JSON.parse(sub.channels);
            await this.send({
              userId: sub.userId,
              type: params.type,
              title: params.title,
              body: params.body,
              priority,
              data: params.data,
              source: params.source ?? "event_bus",
              channels,
            });
          }
          sent++;
        }
      }
    }

    // 3. Event type subscriptions
    if (params.eventType) {
      const eventSubs = await db.notificationSubscription.findMany({
        where: {
          subscriptionType: "event_type",
          isActive: true,
          target: params.eventType,
        },
      });

      for (const sub of eventSubs) {
        if (priority < sub.minPriority) continue;
        const channels: ChannelType[] = JSON.parse(sub.channels);
        await this.send({
          userId: sub.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          priority,
          data: params.data,
          source: params.source ?? "event_bus",
          channels,
        });
        sent++;
      }
    }

    // 4. Entity subscriptions
    if (params.entityId) {
      const entitySubs = await db.notificationSubscription.findMany({
        where: {
          subscriptionType: "entity",
          isActive: true,
          target: params.entityId,
        },
      });

      for (const sub of entitySubs) {
        if (priority < sub.minPriority) continue;
        const channels: ChannelType[] = JSON.parse(sub.channels);
        await this.send({
          userId: sub.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          priority,
          data: params.data,
          source: params.source ?? "event_bus",
          channels,
        });
        sent++;
      }
    }

    logger.info("notification.broadcast", { sent, geofenceMatches, interestMatches, type: params.type });
    return { sent, geofenceMatches, interestMatches };
  }

  /**
   * List notifications for a user (inbox).
   */
  async listForUser(userId: string, params?: {
    unreadOnly?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = { userId };
    if (filters.unreadOnly) where.isRead = false;
    if (filters.type) where.type = filters.type;

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        ...n,
        channels: JSON.parse(n.channels),
        data: n.data ? JSON.parse(n.data) : null,
        deliveryStatus: n.deliveryStatus ? JSON.parse(n.deliveryStatus) : null,
      })),
      total,
      unreadCount,
    };
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all as read.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  async subscribe(params: {
    userId: string;
    subscriptionType: string;
    target: string;
    channels?: ChannelType[];
    minPriority?: number;
    digestMode?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const sub = await db.notificationSubscription.upsert({
      where: {
        userId_subscriptionType_target: {
          userId: params.userId,
          subscriptionType: params.subscriptionType,
          target: params.target,
        },
      },
      create: {
        userId: params.userId,
        subscriptionType: params.subscriptionType,
        target: params.target,
        channels: JSON.stringify(params.channels ?? ["in_app"]),
        minPriority: params.minPriority ?? 0,
        digestMode: params.digestMode ?? "none",
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
      update: {
        channels: JSON.stringify(params.channels ?? ["in_app"]),
        minPriority: params.minPriority ?? 0,
        digestMode: params.digestMode ?? "none",
        isActive: true,
      },
    });
    return { id: sub.id };
  }

  async unsubscribe(userId: string, subscriptionType: string, target: string): Promise<void> {
    await db.notificationSubscription.updateMany({
      where: { userId, subscriptionType, target },
      data: { isActive: false },
    });
  }

  async listSubscriptions(userId: string) {
    const subs = await db.notificationSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return {
      subscriptions: subs.map((s) => ({
        ...s,
        channels: JSON.parse(s.channels),
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Geofences
  // ---------------------------------------------------------------------------

  async createGeofence(params: {
    userId: string;
    name: string;
    centerLat: number;
    centerLng: number;
    radiusM?: number;
    geojson?: string;
    channels?: ChannelType[];
    minPriority?: number;
    eventTypes?: string[];
  }): Promise<{ id: string }> {
    const gf = await db.geofenceSubscription.create({
      data: {
        userId: params.userId,
        name: params.name,
        centerLat: params.centerLat,
        centerLng: params.centerLng,
        radiusM: params.radiusM,
        geojson: params.geojson ?? JSON.stringify({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[
            [params.centerLng - 0.01, params.centerLat - 0.01],
            [params.centerLng + 0.01, params.centerLat - 0.01],
            [params.centerLng + 0.01, params.centerLat + 0.01],
            [params.centerLng - 0.01, params.centerLat + 0.01],
            [params.centerLng - 0.01, params.centerLat - 0.01],
          ]] },
        }),
        channels: JSON.stringify(params.channels ?? ["push", "in_app"]),
        minPriority: params.minPriority ?? 1,
        eventTypes: params.eventTypes ? JSON.stringify(params.eventTypes) : null,
      },
    });
    return { id: gf.id };
  }

  async listGeofences(userId: string) {
    const geofences = await db.geofenceSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return {
      geofences: geofences.map((g) => ({
        ...g,
        channels: JSON.parse(g.channels),
        eventTypes: g.eventTypes ? JSON.parse(g.eventTypes) : null,
        geojson: g.geojson ? JSON.parse(g.geojson) : null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Digest
  // ---------------------------------------------------------------------------

  /**
   * Compile digests for all users with digest-mode subscriptions.
   * Collects unread notifications from the period and creates a digest entry.
   */
  async compileDigests(period: "hourly" | "daily" | "weekly"): Promise<{ digestsCreated: number }> {
    const now = new Date();
    const intervalMs = period === "hourly" ? 60 * 60 * 1000 : period === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const startTime = new Date(now.getTime() - intervalMs);

    // Find users with digest-mode subscriptions for this period
    const subs = await db.notificationSubscription.findMany({
      where: { digestMode: period, isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    });

    let digestsCreated = 0;
    for (const sub of subs) {
      // Collect unread notifications from the period
      const notifications = await db.notification.findMany({
        where: {
          userId: sub.userId,
          createdAt: { gte: startTime, lte: now },
          source: "digest", // only notifications deferred for digest
        },
        select: { id: true },
      });

      if (notifications.length === 0) continue;

      // Create the digest
      await db.notificationDigest.create({
        data: {
          userId: sub.userId,
          period,
          startTime,
          endTime: now,
          notificationIds: JSON.stringify(notifications.map((n) => n.id)),
          count: notifications.length,
          status: "sent",
          sentAt: now,
          channels: JSON.stringify(["in_app", "email"]),
        },
      });

      // Send a digest notification
      await this.send({
        userId: sub.userId,
        type: "digest",
        title: `${period.charAt(0).toUpperCase() + period.slice(1)} Digest`,
        body: `You have ${notifications.length} notifications in your ${period} digest.`,
        priority: 0,
        source: "digest",
        data: { digestCount: notifications.length, period },
      });

      digestsCreated++;
    }

    logger.info("notification.digests_compiled", { period, digestsCreated });
    return { digestsCreated };
  }

  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------

  async listChannels(userId: string) {
    const channels = await db.notificationChannel.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return {
      channels: channels.map((c) => ({
        ...c,
        preferences: c.preferences ? JSON.parse(c.preferences) : null,
      })),
    };
  }

  async registerChannel(params: {
    userId: string;
    type: ChannelType;
    address?: string;
  }): Promise<{ id: string }> {
    const channel = await db.notificationChannel.create({
      data: {
        userId: params.userId,
        type: params.type,
        address: params.address,
        isVerified: params.type === "in_app", // in_app is auto-verified
      },
    });
    return { id: channel.id };
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  async summary() {
    const [
      totalNotifications,
      unreadCount,
      byType,
      byPriority,
      totalChannels,
      channelsByType,
      totalSubscriptions,
      subsByType,
      totalGeofences,
      activeGeofences,
      totalDigests,
      digestsByPeriod,
      recentNotifications,
    ] = await Promise.all([
      db.notification.count(),
      db.notification.count({ where: { isRead: false } }),
      db.notification.groupBy({ by: ["type"], _count: true }),
      db.notification.groupBy({ by: ["priority"], _count: true }),
      db.notificationChannel.count(),
      db.notificationChannel.groupBy({ by: ["type"], _count: true }),
      db.notificationSubscription.count(),
      db.notificationSubscription.groupBy({ by: ["subscriptionType"], _count: true }),
      db.geofenceSubscription.count(),
      db.geofenceSubscription.count({ where: { isActive: true } }),
      db.notificationDigest.count(),
      db.notificationDigest.groupBy({ by: ["period"], _count: true }),
      db.notification.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      total: totalNotifications,
      unread: unreadCount,
      byType: byType.map((g) => ({ type: g.type, count: g._count })),
      byPriority: byPriority.map((g) => ({ priority: g.priority, count: g._count })),
      channels: {
        total: totalChannels,
        byType: channelsByType.map((g) => ({ type: g.type, count: g._count })),
      },
      subscriptions: {
        total: totalSubscriptions,
        byType: subsByType.map((g) => ({ type: g.subscriptionType, count: g._count })),
      },
      geofences: {
        total: totalGeofences,
        active: activeGeofences,
      },
      digests: {
        total: totalDigests,
        byPeriod: digestsByPeriod.map((g) => ({ period: g.period, count: g._count })),
      },
      recent: recentNotifications.map((n) => ({
        ...n,
        channels: JSON.parse(n.channels),
        data: n.data ? JSON.parse(n.data) : null,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _svc: NotificationService | null = null;
export function getNotificationService(): NotificationService {
  if (!_svc) _svc = new NotificationService();
  return _svc;
}
