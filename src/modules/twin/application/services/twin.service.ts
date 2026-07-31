/**
 * Sentinel — Digital Twin application services
 * =============================================================================
 * TwinEntityService, RelationshipService, EventService, TwinSummaryService.
 * Each service writes domain events to the transactional outbox.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { TwinEvents } from "../../domain/events/twin-events";

// ---------------------------------------------------------------------------
// TwinEntityService — CRUD + versioning + restore
// ---------------------------------------------------------------------------

export class TwinEntityService {
  async list(params?: {
    type?: string;
    status?: string;
    country?: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 100, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.country) where.country = filters.country;
    if (filters.organizationId) where.organizationId = filters.organizationId;

    const [entities, total] = await Promise.all([
      db.twinEntity.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: "desc" },
      }),
      db.twinEntity.count({ where }),
    ]);

    return {
      entities: entities.map((e) => this.serialize(e)),
      total,
    };
  }

  async getById(id: string) {
    const entity = await db.twinEntity.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: "desc" }, take: 10 },
        events: { orderBy: { timestamp: "desc" }, take: 10 },
        relationshipsFrom: { include: { toEntity: { select: { id: true, name: true, type: true } } } },
        relationshipsTo: { include: { fromEntity: { select: { id: true, name: true, type: true } } } },
      },
    });
    if (!entity) return null;
    return this.serializeDetailed(entity);
  }

  async getByKey(key: string) {
    const entity = await db.twinEntity.findUnique({ where: { key } });
    return entity ? this.serialize(entity) : null;
  }

  async create(params: {
    key: string;
    type: string;
    name: string;
    description?: string;
    geojson?: string;
    lat?: number;
    lng?: number;
    metadata?: Record<string, unknown>;
    organizationId?: string;
    country?: string;
    region?: string;
    createdById?: string;
  }): Promise<{ id: string; version: number }> {
    const entity = await db.twinEntity.create({
      data: {
        key: params.key,
        type: params.type,
        name: params.name,
        description: params.description,
        geojson: params.geojson,
        lat: params.lat,
        lng: params.lng,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        organizationId: params.organizationId,
        country: params.country,
        region: params.region,
        currentVersion: 1,
      },
    });

    // Create the initial version snapshot
    await db.twinEntityVersion.create({
      data: {
        entityId: entity.id,
        version: 1,
        snapshot: JSON.stringify(this.toSnapshot(entity)),
        changeReason: "Initial creation",
        diff: null,
        validFrom: new Date(),
      },
    });

    // Record creation event
    await this.recordEvent(entity.id, "created", `Entity created: ${entity.name}`, "info", {
      type: entity.type,
      key: entity.key,
    }, params.createdById);

    // Outbox
    await this.recordOutboxEvent("TwinEntity", entity.id, "twin.entity.created", {
      type: entity.type,
      key: entity.key,
    });

    logger.info("twin.entity.created", { id: entity.id, type: entity.type, key: entity.key });
    return { id: entity.id, version: 1 };
  }

  async update(id: string, params: {
    name?: string;
    description?: string | null;
    status?: string;
    geojson?: string | null;
    lat?: number | null;
    lng?: number | null;
    metadata?: Record<string, unknown> | null;
    region?: string | null;
    changeReason?: string;
    changedById?: string;
  }): Promise<{ version: number; diff: Record<string, unknown> }> {
    const current = await db.twinEntity.findUnique({ where: { id } });
    if (!current) throw new Error("entity_not_found");

    const diff: Record<string, unknown> = {};
    const updateData: Record<string, unknown> = {};
    if (params.name !== undefined && params.name !== current.name) {
      diff.name = { from: current.name, to: params.name };
      updateData.name = params.name;
    }
    if (params.description !== undefined && params.description !== current.description) {
      diff.description = "changed";
      updateData.description = params.description;
    }
    if (params.status !== undefined && params.status !== current.status) {
      diff.status = { from: current.status, to: params.status };
      updateData.status = params.status;
    }
    if (params.geojson !== undefined && params.geojson !== current.geojson) {
      diff.geojson = "changed";
      updateData.geojson = params.geojson;
    }
    if (params.lat !== undefined && params.lat !== current.lat) {
      diff.lat = { from: current.lat, to: params.lat };
      updateData.lat = params.lat;
    }
    if (params.lng !== undefined && params.lng !== current.lng) {
      diff.lng = { from: current.lng, to: params.lng };
      updateData.lng = params.lng;
    }
    if (params.metadata !== undefined) {
      diff.metadata = "changed";
      updateData.metadata = params.metadata ? JSON.stringify(params.metadata) : null;
    }
    if (params.region !== undefined && params.region !== current.region) {
      diff.region = { from: current.region, to: params.region };
      updateData.region = params.region;
    }

    if (Object.keys(diff).length === 0) {
      return { version: current.currentVersion, diff: {} };
    }

    const newVersion = current.currentVersion + 1;
    updateData.currentVersion = newVersion;

    const updated = await db.twinEntity.update({
      where: { id },
      data: updateData,
    });

    // Close the previous version's validTo (temporal engine: nothing is overwritten)
    const now = new Date();
    await db.twinEntityVersion.updateMany({
      where: { entityId: id, version: current.currentVersion },
      data: { validTo: now },
    });

    // Create version snapshot
    await db.twinEntityVersion.create({
      data: {
        entityId: id,
        version: newVersion,
        snapshot: JSON.stringify(this.toSnapshot(updated)),
        changeReason: params.changeReason ?? "Updated",
        diff: JSON.stringify(diff),
        changedById: params.changedById,
        validFrom: now,
      },
    });

    // Record update event
    await this.recordEvent(id, "updated", `Entity updated to v${newVersion}`, "info", diff, params.changedById);

    // Outbox
    await this.recordOutboxEvent("TwinEntity", id, "twin.entity.updated", {
      type: updated.type,
      fromVersion: current.currentVersion,
      toVersion: newVersion,
    });

    logger.info("twin.entity.updated", { id, fromVersion: current.currentVersion, toVersion: newVersion });
    return { version: newVersion, diff };
  }

  /**
   * Restore the entity to a past version. Creates a new version with the
   * snapshot from the target version.
   */
  async restoreVersion(id: string, targetVersion: number, restoredBy?: string): Promise<{ version: number }> {
    const entity = await db.twinEntity.findUnique({ where: { id } });
    if (!entity) throw new Error("entity_not_found");

    const targetSnap = await db.twinEntityVersion.findUnique({
      where: { entityId_version: { entityId: id, version: targetVersion } },
    });
    if (!targetSnap) throw new Error("version_not_found");

    const snapshot = JSON.parse(targetSnap.snapshot) as Record<string, unknown>;
    const newVersion = entity.currentVersion + 1;

    const updated = await db.twinEntity.update({
      where: { id },
      data: {
        name: snapshot.name as string,
        description: (snapshot.description as string) ?? null,
        status: (snapshot.status as string) ?? "active",
        geojson: (snapshot.geojson as string) ?? null,
        lat: (snapshot.lat as number) ?? null,
        lng: (snapshot.lng as number) ?? null,
        metadata: snapshot.metadata ? JSON.stringify(snapshot.metadata) : null,
        region: (snapshot.region as string) ?? null,
        currentVersion: newVersion,
      },
    });

    // Close the previous version's validTo
    const now = new Date();
    await db.twinEntityVersion.updateMany({
      where: { entityId: id, version: entity.currentVersion },
      data: { validTo: now },
    });

    await db.twinEntityVersion.create({
      data: {
        entityId: id,
        version: newVersion,
        snapshot: JSON.stringify(this.toSnapshot(updated)),
        changeReason: `Restored to version ${targetVersion}`,
        diff: JSON.stringify({ restoredFrom: targetVersion }),
        changedById: restoredBy,
        validFrom: now,
      },
    });

    await this.recordEvent(id, "restored", `Restored to v${targetVersion} → new v${newVersion}`, "info", { targetVersion }, restoredBy);
    await this.recordOutboxEvent("TwinEntity", id, "twin.entity.restored", { type: entity.type, toVersion: targetVersion });

    logger.info("twin.entity.restored", { id, targetVersion, newVersion });
    return { version: newVersion };
  }

  async getVersions(id: string) {
    const versions = await db.twinEntityVersion.findMany({
      where: { entityId: id },
      orderBy: { version: "desc" },
    });
    return {
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        changeReason: v.changeReason,
        diff: v.diff ? JSON.parse(v.diff) : null,
        changedById: v.changedById,
        validFrom: v.validFrom,
        validTo: v.validTo,
        createdAt: v.createdAt,
      })),
    };
  }

  async getVersionDetail(id: string, version: number) {
    const v = await db.twinEntityVersion.findUnique({
      where: { entityId_version: { entityId: id, version } },
    });
    if (!v) return null;
    return {
      id: v.id,
      version: v.version,
      snapshot: JSON.parse(v.snapshot),
      changeReason: v.changeReason,
      diff: v.diff ? JSON.parse(v.diff) : null,
      changedById: v.changedById,
      validFrom: v.validFrom,
      validTo: v.validTo,
    };
  }

  private toSnapshot(e: {
    key: string; type: string; name: string; description: string | null;
    status: string; geojson: string | null; lat: number | null; lng: number | null;
    metadata: string | null; organizationId: string | null; country: string | null; region: string | null;
    currentVersion: number;
  }) {
    return {
      key: e.key, type: e.type, name: e.name, description: e.description,
      status: e.status, geojson: e.geojson, lat: e.lat, lng: e.lng,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      organizationId: e.organizationId, country: e.country, region: e.region,
      version: e.currentVersion,
    };
  }

  private serialize(e: {
    id: string; key: string; type: string; name: string; description: string | null;
    status: string; geojson: string | null; lat: number | null; lng: number | null;
    metadata: string | null; currentVersion: number; organizationId: string | null;
    country: string | null; region: string | null; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: e.id, key: e.key, type: e.type, name: e.name, description: e.description,
      status: e.status, geojson: e.geojson, lat: e.lat, lng: e.lng,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      currentVersion: e.currentVersion, organizationId: e.organizationId,
      country: e.country, region: e.region, createdAt: e.createdAt, updatedAt: e.updatedAt,
    };
  }

  private serializeDetailed(e: Record<string, unknown>) {
    const base = this.serialize(e as Parameters<typeof this.serialize>[0]);
    return {
      ...base,
      versions: (e.versions as Array<Record<string, unknown>>)?.map((v) => ({
        version: v.version,
        changeReason: v.changeReason,
        validFrom: v.validFrom,
      })) ?? [],
      events: (e.events as Array<Record<string, unknown>>)?.map((ev) => ({
        id: ev.id, type: ev.type, title: ev.title, severity: ev.severity, timestamp: ev.timestamp, source: ev.source,
      })) ?? [],
      relationshipsFrom: (e.relationshipsFrom as Array<Record<string, unknown>>)?.map((r) => ({
        id: r.id, type: r.type, strength: r.strength, toEntity: r.toEntity,
      })) ?? [],
      relationshipsTo: (e.relationshipsTo as Array<Record<string, unknown>>)?.map((r) => ({
        id: r.id, type: r.type, strength: r.strength, fromEntity: r.fromEntity,
      })) ?? [],
    };
  }

  private async recordEvent(entityId: string, type: string, title: string, severity: string, payload: Record<string, unknown>, source?: string) {
    await db.twinEvent.create({
      data: {
        entityId, type, title, severity,
        payload: JSON.stringify(payload),
        source: source ?? "system",
        sourceType: "system",
      },
    });
  }

  private async recordOutboxEvent(aggregateType: string, aggregateId: string, eventType: string, payload: Record<string, unknown>) {
    await db.outboxEvent.create({
      data: { aggregateType, aggregateId, eventType, payload: JSON.stringify(payload), status: "pending" },
    });
  }
}

// ---------------------------------------------------------------------------
// RelationshipService — graph edges between entities
// ---------------------------------------------------------------------------

export class RelationshipService {
  async list(params?: { entityId?: string; type?: string; limit?: number }) {
    const { limit = 200, entityId, type } = params ?? {};
    const where: Record<string, unknown> = {};
    if (entityId) where.OR = [{ fromEntityId: entityId }, { toEntityId: entityId }];
    if (type) where.type = type;

    const rels = await db.twinRelationship.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        fromEntity: { select: { id: true, name: true, type: true } },
        toEntity: { select: { id: true, name: true, type: true } },
      },
    });

    return {
      relationships: rels.map((r) => ({
        id: r.id,
        fromEntityId: r.fromEntityId,
        toEntityId: r.toEntityId,
        type: r.type,
        strength: r.strength,
        bidirectional: r.bidirectional,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        validFrom: r.validFrom,
        fromEntity: r.fromEntity,
        toEntity: r.toEntity,
      })),
    };
  }

  async create(params: {
    fromEntityId: string;
    toEntityId: string;
    type: string;
    strength?: number;
    metadata?: Record<string, unknown>;
    bidirectional?: boolean;
  }): Promise<{ id: string }> {
    const rel = await db.twinRelationship.create({
      data: {
        fromEntityId: params.fromEntityId,
        toEntityId: params.toEntityId,
        type: params.type,
        strength: params.strength ?? 1.0,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        bidirectional: params.bidirectional ?? false,
      },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "TwinRelationship",
        aggregateId: `${params.fromEntityId}->${params.toEntityId}`,
        eventType: "twin.relationship.created",
        payload: JSON.stringify({ fromId: params.fromEntityId, toId: params.toEntityId, relType: params.type }),
        status: "pending",
      },
    });
    logger.info("twin.relationship.created", { from: params.fromEntityId, to: params.toEntityId, type: params.type });
    return { id: rel.id };
  }

  async delete(id: string): Promise<void> {
    await db.twinRelationship.delete({ where: { id } });
  }
}

// ---------------------------------------------------------------------------
// EventService — timeline of entity events
// ---------------------------------------------------------------------------

export class EventService {
  async listForEntity(entityId: string, limit = 50) {
    const events = await db.twinEvent.findMany({
      where: { entityId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return {
      events: events.map((e) => ({
        ...e,
        payload: e.payload ? JSON.parse(e.payload) : null,
      })),
    };
  }

  async record(params: {
    entityId: string;
    type: string;
    title: string;
    description?: string;
    severity?: string;
    payload?: Record<string, unknown>;
    source?: string;
    sourceType?: string;
  }): Promise<{ id: string }> {
    const event = await db.twinEvent.create({
      data: {
        entityId: params.entityId,
        type: params.type,
        title: params.title,
        description: params.description,
        severity: params.severity ?? "info",
        payload: params.payload ? JSON.stringify(params.payload) : null,
        source: params.source ?? "system",
        sourceType: params.sourceType ?? "system",
      },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "TwinEvent",
        aggregateId: params.entityId,
        eventType: "twin.event.recorded",
        payload: JSON.stringify({ eventType: params.type, severity: params.severity }),
        status: "pending",
      },
    });
    return { id: event.id };
  }
}

// ---------------------------------------------------------------------------
// TwinSummaryService — aggregate metrics + graph data
// ---------------------------------------------------------------------------

export class TwinSummaryService {
  async summary() {
    const [
      totalEntities,
      entitiesByType,
      entitiesByStatus,
      totalVersions,
      totalRelationships,
      relsByType,
      totalEvents,
      eventsBySeverity,
      recentEntities,
      recentEvents,
    ] = await Promise.all([
      db.twinEntity.count(),
      db.twinEntity.groupBy({ by: ["type"], _count: true }),
      db.twinEntity.groupBy({ by: ["status"], _count: true }),
      db.twinEntityVersion.count(),
      db.twinRelationship.count(),
      db.twinRelationship.groupBy({ by: ["type"], _count: true }),
      db.twinEvent.count(),
      db.twinEvent.groupBy({ by: ["severity"], _count: true }),
      db.twinEntity.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        select: { id: true, key: true, type: true, name: true, status: true, currentVersion: true, updatedAt: true },
      }),
      db.twinEvent.findMany({
        take: 8,
        orderBy: { timestamp: "desc" },
        include: { entity: { select: { id: true, name: true, type: true } } },
      }),
    ]);

    return {
      entities: {
        total: totalEntities,
        byType: entitiesByType.map((g) => ({ type: g.type, count: g._count })),
        byStatus: entitiesByStatus.map((g) => ({ status: g.status, count: g._count })),
      },
      versions: { total: totalVersions },
      relationships: {
        total: totalRelationships,
        byType: relsByType.map((g) => ({ type: g.type, count: g._count })),
      },
      events: {
        total: totalEvents,
        bySeverity: eventsBySeverity.map((g) => ({ severity: g.severity, count: g._count })),
      },
      recent: {
        entities: recentEntities,
        events: recentEvents.map((e) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          severity: e.severity,
          timestamp: e.timestamp,
          entity: e.entity,
        })),
      },
    };
  }

  /**
   * Export the entity graph as nodes + edges (for graph visualization).
   */
  async graph(params?: { type?: string; limit?: number }) {
    const { limit = 100, type } = params ?? {};
    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const [entities, relationships] = await Promise.all([
      db.twinEntity.findMany({
        where,
        take: limit,
        select: { id: true, key: true, type: true, name: true, status: true, lat: true, lng: true },
      }),
      db.twinRelationship.findMany({
        include: {
          fromEntity: { select: { id: true } },
          toEntity: { select: { id: true } },
        },
      }),
    ]);

    return {
      nodes: entities.map((e) => ({
        id: e.id,
        key: e.key,
        type: e.type,
        name: e.name,
        status: e.status,
        lat: e.lat,
        lng: e.lng,
      })),
      edges: relationships.map((r) => ({
        id: r.id,
        source: r.fromEntityId,
        target: r.toEntityId,
        type: r.type,
        strength: r.strength,
        bidirectional: r.bidirectional,
      })),
      stats: {
        nodeCount: entities.length,
        edgeCount: relationships.length,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

let _ent: TwinEntityService | null = null;
let _rel: RelationshipService | null = null;
let _evt: EventService | null = null;
let _sum: TwinSummaryService | null = null;

export function getTwinEntityService(): TwinEntityService {
  if (!_ent) _ent = new TwinEntityService();
  return _ent;
}
export function getRelationshipService(): RelationshipService {
  if (!_rel) _rel = new RelationshipService();
  return _rel;
}
export function getEventService(): EventService {
  if (!_evt) _evt = new EventService();
  return _evt;
}
export function getTwinSummaryService(): TwinSummaryService {
  if (!_sum) _sum = new TwinSummaryService();
  return _sum;
}
