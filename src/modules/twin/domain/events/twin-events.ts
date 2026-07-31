/**
 * Sentinel — Digital Twin domain events
 * =============================================================================
 * Domain events produced by the Twin bounded context. Flow:
 *   Aggregate → Outbox → Event Bus → Audit handler + projectors.
 * =============================================================================
 */

import { createDomainEvent, type DomainEvent } from "@/core/shared";

export const TwinEvents = {
  EntityCreated: (entityId: string, type: string, key: string, createdBy?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TwinEntity",
      aggregateId: entityId,
      eventType: "twin.entity.created",
      payload: { type, key },
      metadata: { userId: createdBy },
    }),
  EntityUpdated: (entityId: string, type: string, fromVersion: number, toVersion: number, changedBy?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TwinEntity",
      aggregateId: entityId,
      eventType: "twin.entity.updated",
      payload: { type, fromVersion, toVersion },
      metadata: { userId: changedBy },
    }),
  EntityRestored: (entityId: string, type: string, toVersion: number, restoredBy?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TwinEntity",
      aggregateId: entityId,
      eventType: "twin.entity.restored",
      payload: { type, toVersion },
      metadata: { userId: restoredBy },
    }),
  RelationshipCreated: (fromId: string, toId: string, relType: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TwinRelationship",
      aggregateId: `${fromId}->${toId}`,
      eventType: "twin.relationship.created",
      payload: { fromId, toId, relType },
    }),
  EventRecorded: (entityId: string, eventType: string, severity: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "TwinEvent",
      aggregateId: entityId,
      eventType: "twin.event.recorded",
      payload: { eventType, severity },
    }),
} as const;
