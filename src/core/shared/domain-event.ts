import { randomUUID } from "node:crypto";
import type { UniqueId } from "./unique-id";

/**
 * DomainEvent — an immutable fact about a state change in the domain.
 *
 * Events are named in past tense (e.g. UserCreated, FeatureFlagEnabled).
 * They are dispatched via the Event Bus and consumed by:
 *   - cross-aggregate projectors (read models)
 *   - integration event relays (outbox -> external systems)
 *   - audit / notification handlers
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createDomainEvent(params: {
  aggregateType: string;
  aggregateId: string | UniqueId;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): DomainEvent {
  return Object.freeze({
    eventId: randomUUID(),
    eventType: params.eventType,
    occurredAt: new Date(),
    aggregateType: params.aggregateType,
    aggregateId:
      typeof params.aggregateId === "string"
        ? params.aggregateId
        : params.aggregateId.value,
    payload: Object.freeze({ ...params.payload }),
    metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined,
  });
}
