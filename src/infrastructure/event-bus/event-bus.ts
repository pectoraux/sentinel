/**
 * Sentinel — Event Bus abstraction (Event Driven Architecture)
 * =============================================================================
 * The Event Bus is the backbone of inter-bounded-context communication.
 *
 * Two kinds of events flow through the system:
 *
 * 1. Domain Events — produced inside an aggregate, written to the transactional
 *    outbox in the SAME db transaction as the state change, then relayed to the
 *    bus by a background job (at-least-once delivery). This guarantees no event
 *    is lost even if the bus is temporarily unavailable.
 *
 * 2. Integration Events — published directly to the bus for cross-service
 *    notifications (e.g. notify external partner systems).
 *
 * Implementations:
 *   - InMemoryEventBus (dev/test)
 *   - RedisEventBus (production single-region pub/sub) — interface ready
 *   - NATSEventBus (production multi-region) — interface ready
 *
 * Handlers are idempotent and must tolerate redelivery.
 * =============================================================================
 */

import type { DomainEvent } from "@/core/shared";

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface EventBusSubscription {
  unsubscribe(): void;
}

export interface EventBus {
  /** Publish a single event. */
  publish(event: DomainEvent): Promise<void>;
  /** Publish multiple events atomically (best-effort ordering within batch). */
  publishAll(events: DomainEvent[]): Promise<void>;
  /** Subscribe a handler to an event type (or "*" for all). */
  subscribe(eventType: string, handler: EventHandler): EventBusSubscription;
  /** Subscribe to all events (useful for audit, debug). */
  subscribeAll(handler: EventHandler): EventBusSubscription;
  /** Health-check hook. */
  isHealthy(): Promise<boolean>;
}

export const EVENT_BUS_WILDCARD = "*";
