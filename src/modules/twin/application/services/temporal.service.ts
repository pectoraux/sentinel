/**
 * Sentinel — Temporal Engine
 * =============================================================================
 * "Nothing is overwritten. Everything is versioned."
 *
 * The Temporal Engine provides bi-temporal queries over the Digital Twin:
 *   - Point-in-time queries: "What was the state of this entity yesterday?"
 *   - Range queries: "Show me all changes in the last month"
 *   - Version comparison: "What changed between v3 and v5?"
 *   - History replay: "Replay all changes from January to June"
 *
 * The engine uses the valid-time model: each TwinEntityVersion has a validFrom
 * (when this version became the current truth) and validTo (when it was
 * superseded). A version with validTo=null is the current truth. To query the
 * state at time T, we find the version where validFrom <= T AND (validTo IS NULL
 * OR validTo > T).
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";

// ---------------------------------------------------------------------------
// Point-in-time queries
// ---------------------------------------------------------------------------

export class TemporalService {
  /**
   * Get the state of an entity at a specific point in time.
   * Returns the version that was valid (current) at that timestamp.
   */
  async getStateAtTime(entityId: string, at: Date) {
    const version = await db.twinEntityVersion.findFirst({
      where: {
        entityId,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
      },
      orderBy: { version: "desc" },
    });

    if (!version) return null;

    const entity = await db.twinEntity.findUnique({
      where: { id: entityId },
      select: { id: true, key: true, type: true, name: true },
    });

    return {
      entity,
      version: version.version,
      snapshot: JSON.parse(version.snapshot),
      validFrom: version.validFrom,
      validTo: version.validTo,
      changeReason: version.changeReason,
      queriedAt: at.toISOString(),
      isCurrent: version.validTo === null,
    };
  }

  /**
   * Get the state of ALL entities at a specific point in time.
   * Returns a snapshot of the entire system as it was at that timestamp.
   */
  async getSystemStateAtTime(at: Date, type?: string) {
    // Get all entities that existed at that time (createdAt <= at)
    const entityWhere: Record<string, unknown> = {
      createdAt: { lte: at },
    };
    if (type) entityWhere.type = type;

    const entities = await db.twinEntity.findMany({
      where: entityWhere,
      select: { id: true, key: true, type: true, name: true },
    });

    // For each entity, find the version valid at that time
    const states = await Promise.all(
      entities.map(async (e) => {
        const v = await db.twinEntityVersion.findFirst({
          where: {
            entityId: e.id,
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gt: at } }],
          },
          orderBy: { version: "desc" },
        });
        if (!v) return null;
        return {
          entityId: e.id,
          key: e.key,
          type: e.type,
          name: e.name,
          version: v.version,
          snapshot: JSON.parse(v.snapshot),
          validFrom: v.validFrom,
          isCurrent: v.validTo === null,
        };
      }),
    );

    return {
      queriedAt: at.toISOString(),
      entityCount: states.filter((s) => s !== null).length,
      states: states.filter((s) => s !== null),
    };
  }

  // ---------------------------------------------------------------------------
  // Timeline queries (range)
  // ---------------------------------------------------------------------------

  /**
   * Get the full timeline for a single entity: all versions + events in a
   * time range, ordered chronologically.
   */
  async getEntityTimeline(entityId: string, from?: Date, to?: Date) {
    const versionWhere: Record<string, unknown> = { entityId };
    if (from || to) {
      versionWhere.validFrom = {};
      if (from) (versionWhere.validFrom as { gte?: Date }).gte = from;
      if (to) (versionWhere.validFrom as { lte?: Date }).lte = to;
    }

    const eventWhere: Record<string, unknown> = { entityId };
    if (from || to) {
      eventWhere.timestamp = {};
      if (from) (eventWhere.timestamp as { gte?: Date }).gte = from;
      if (to) (eventWhere.timestamp as { lte?: Date }).lte = to;
    }

    const [versions, events, entity] = await Promise.all([
      db.twinEntityVersion.findMany({
        where: versionWhere,
        orderBy: { validFrom: "asc" },
      }),
      db.twinEvent.findMany({
        where: eventWhere,
        orderBy: { timestamp: "asc" },
      }),
      db.twinEntity.findUnique({
        where: { id: entityId },
        select: { id: true, key: true, type: true, name: true, currentVersion: true },
      }),
    ]);

    if (!entity) return null;

    // Merge into a single chronological timeline
    const timeline = [
      ...versions.map((v) => ({
        kind: "version" as const,
        timestamp: v.validFrom,
        version: v.version,
        changeReason: v.changeReason,
        diff: v.diff ? JSON.parse(v.diff) : null,
        validTo: v.validTo,
      })),
      ...events.map((e) => ({
        kind: "event" as const,
        timestamp: e.timestamp,
        eventType: e.type,
        title: e.title,
        severity: e.severity,
        source: e.source,
        sourceType: e.sourceType,
        payload: e.payload ? JSON.parse(e.payload) : null,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      entity,
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      versionCount: versions.length,
      eventCount: events.length,
      timeline,
    };
  }

  /**
   * Get the system-wide timeline: all changes across ALL entities in a time
   * range. This is the "replay" data source.
   */
  async getSystemTimeline(params: {
    from?: Date;
    to?: Date;
    type?: string;
    limit?: number;
  }) {
    const { from, to, type, limit = 500 } = params;

    const versionWhere: Record<string, unknown> = {};
    if (from || to) {
      versionWhere.validFrom = {};
      if (from) (versionWhere.validFrom as { gte?: Date }).gte = from;
      if (to) (versionWhere.validFrom as { lte?: Date }).lte = to;
    }
    if (type) versionWhere.entity = { type };

    const eventWhere: Record<string, unknown> = {};
    if (from || to) {
      eventWhere.timestamp = {};
      if (from) (eventWhere.timestamp as { gte?: Date }).gte = from;
      if (to) (eventWhere.timestamp as { lte?: Date }).lte = to;
    }
    if (type) eventWhere.entity = { type };

    const [versions, events] = await Promise.all([
      db.twinEntityVersion.findMany({
        where: versionWhere,
        take: limit,
        orderBy: { validFrom: "asc" },
        include: {
          entity: { select: { id: true, key: true, type: true, name: true } },
        },
      }),
      db.twinEvent.findMany({
        where: eventWhere,
        take: limit,
        orderBy: { timestamp: "asc" },
        include: {
          entity: { select: { id: true, key: true, type: true, name: true } },
        },
      }),
    ]);

    // Merge into a single chronological timeline
    const timeline = [
      ...versions.map((v) => ({
        kind: "version" as const,
        timestamp: v.validFrom.toISOString(),
        entityId: v.entityId,
        entity: v.entity,
        version: v.version,
        changeReason: v.changeReason,
        diff: v.diff ? JSON.parse(v.diff) : null,
      })),
      ...events.map((e) => ({
        kind: "event" as const,
        timestamp: e.timestamp.toISOString(),
        entityId: e.entityId,
        entity: e.entity,
        eventType: e.type,
        title: e.title,
        severity: e.severity,
        source: e.source,
        sourceType: e.sourceType,
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      totalChanges: timeline.length,
      versionCount: versions.length,
      eventCount: events.length,
      timeline: timeline.slice(0, limit),
    };
  }

  // ---------------------------------------------------------------------------
  // Version comparison
  // ---------------------------------------------------------------------------

  /**
   * Compare two versions of an entity and return a structured diff.
   */
  async compareVersions(entityId: string, v1: number, v2: number) {
    const [version1, version2] = await Promise.all([
      db.twinEntityVersion.findUnique({
        where: { entityId_version: { entityId, version: v1 } },
      }),
      db.twinEntityVersion.findUnique({
        where: { entityId_version: { entityId, version: v2 } },
      }),
    ]);

    if (!version1 || !version2) {
      return { error: "version_not_found", v1: !!version1, v2: !!version2 };
    }

    const snap1 = JSON.parse(version1.snapshot) as Record<string, unknown>;
    const snap2 = JSON.parse(version2.snapshot) as Record<string, unknown>;

    const diff = computeDiff(snap1, snap2);

    return {
      entityId,
      v1: { version: v1, snapshot: snap1, validFrom: version1.validFrom, validTo: version1.validTo, changeReason: version1.changeReason },
      v2: { version: v2, snapshot: snap2, validFrom: version2.validFrom, validTo: version2.validTo, changeReason: version2.changeReason },
      diff,
      fieldCount: Object.keys(diff).length,
    };
  }

  // ---------------------------------------------------------------------------
  // Replay
  // ---------------------------------------------------------------------------

  /**
   * Generate a replay sequence: a chronological list of all state changes
   * in a time range, with the reconstructed system state at each step.
   * The UI can "play" this sequence to animate history.
   */
  async replayTimeline(params: {
    from?: Date;
    to?: Date;
    type?: string;
    limit?: number;
  }) {
    const timeline = await this.getSystemTimeline(params);

    // Group by day for a day-by-day replay
    const byDay = new Map<string, typeof timeline.timeline>();
    for (const entry of timeline.timeline) {
      const day = new Date(entry.timestamp).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(entry);
    }

    return {
      ...timeline,
      replay: Array.from(byDay.entries()).map(([day, entries]) => ({
        date: day,
        changeCount: entries.length,
        changes: entries,
      })),
      dayCount: byDay.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Temporal summary (aggregate metrics over time)
  // ---------------------------------------------------------------------------

  async temporalSummary(from?: Date, to?: Date) {
    const versionWhere: Record<string, unknown> = {};
    if (from || to) {
      versionWhere.validFrom = {};
      if (from) (versionWhere.validFrom as { gte?: Date }).gte = from;
      if (to) (versionWhere.validFrom as { lte?: Date }).lte = to;
    }

    const eventWhere: Record<string, unknown> = {};
    if (from || to) {
      eventWhere.timestamp = {};
      if (from) (eventWhere.timestamp as { gte?: Date }).gte = from;
      if (to) (eventWhere.timestamp as { lte?: Date }).lte = to;
    }

    const [
      totalVersions,
      totalEvents,
      entitiesByType,
      versionsByDay,
      eventsBySeverity,
      eventsByType,
      recentChanges,
      oldestVersion,
      newestVersion,
    ] = await Promise.all([
      db.twinEntityVersion.count({ where: versionWhere }),
      db.twinEvent.count({ where: eventWhere }),
      db.twinEntity.groupBy({ by: ["type"], _count: true }),
      // Versions by day (SQLite-compatible: use date string grouping)
      db.twinEntityVersion.findMany({
        where: versionWhere,
        select: { validFrom: true },
        orderBy: { validFrom: "asc" },
      }),
      db.twinEvent.groupBy({ by: ["severity"], _count: true }),
      db.twinEvent.groupBy({ by: ["type"], _count: true }),
      db.twinEntityVersion.findMany({
        where: versionWhere,
        take: 10,
        orderBy: { validFrom: "desc" },
        include: { entity: { select: { id: true, key: true, type: true, name: true } } },
      }),
      db.twinEntityVersion.findFirst({
        where: versionWhere,
        orderBy: { validFrom: "asc" },
        select: { validFrom: true },
      }),
      db.twinEntityVersion.findFirst({
        where: versionWhere,
        orderBy: { validFrom: "desc" },
        select: { validFrom: true },
      }),
    ]);

    // Group versions by day manually (portable across SQLite + PostgreSQL)
    const dayMap = new Map<string, number>();
    for (const v of versionsByDay) {
      const day = v.validFrom.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
    const changesByDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        earliest: oldestVersion?.validFrom ?? null,
        latest: newestVersion?.validFrom ?? null,
      },
      totalVersions,
      totalEvents,
      entitiesByType: entitiesByType.map((g) => ({ type: g.type, count: g._count })),
      eventsBySeverity: eventsBySeverity.map((g) => ({ severity: g.severity, count: g._count })),
      eventsByType: eventsByType.map((g) => ({ type: g.type, count: g._count })),
      changesByDay,
      recentChanges: recentChanges.map((v) => ({
        entityId: v.entityId,
        version: v.version,
        validFrom: v.validFrom,
        changeReason: v.changeReason,
        entity: v.entity,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Deep diff computation (for version comparison)
// ---------------------------------------------------------------------------

function computeDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const av = a[key];
    const bv = b[key];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      diff[key] = { from: av ?? null, to: bv ?? null };
    }
  }
  return diff;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _temporal: TemporalService | null = null;
export function getTemporalService(): TemporalService {
  if (!_temporal) _temporal = new TemporalService();
  return _temporal;
}

// ---------------------------------------------------------------------------
// Quick time-range helpers (yesterday, last month, last year)
// ---------------------------------------------------------------------------

export function timeRange(preset: "yesterday" | "last_week" | "last_month" | "last_year" | "all"): { from?: Date; to?: Date } {
  const now = new Date();
  switch (preset) {
    case "yesterday": {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { from: start, to: end };
    }
    case "last_week": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from, to: now };
    }
    case "last_month": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      return { from, to: now };
    }
    case "last_year": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from, to: now };
    }
    case "all":
    default:
      return {};
  }
}

/**
 * A point in time for "query as-of" presets.
 */
export function timePoint(preset: "yesterday" | "last_month" | "last_year" | "now"): Date {
  const now = new Date();
  switch (preset) {
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    case "last_month": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    case "last_year": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    case "now":
    default:
      return now;
  }
}
