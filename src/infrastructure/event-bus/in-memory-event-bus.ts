/**
 * InMemoryEventBus — dev/test implementation.
 *
 * - Synchronous dispatch (handlers run sequentially per event).
 * - Errors in one handler do not block subsequent handlers (logged).
 * - Not suitable for multi-process production — use Redis/NATS impl.
 */

import type { EventBus, EventBusSubscription, EventHandler } from "./event-bus";
import { EVENT_BUS_WILDCARD } from "./event-bus";
import type { DomainEvent } from "@/core/shared";
import { logger } from "@/infrastructure/observability/logger";

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private globalHandlers = new Set<EventHandler>();
  private healthy = true;

  async publish(event: DomainEvent): Promise<void> {
    logger.debug("event.publish", { eventType: event.eventType, aggregateId: event.aggregateId });
    await this.dispatch(event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe(eventType: string, handler: EventHandler): EventBusSubscription {
    if (eventType === EVENT_BUS_WILDCARD) return this.subscribeAll(handler);
    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler);
    return { unsubscribe: () => set!.delete(handler) };
  }

  subscribeAll(handler: EventHandler): EventBusSubscription {
    this.globalHandlers.add(handler);
    return { unsubscribe: () => this.globalHandlers.delete(handler) };
  }

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    const targeted = this.handlers.get(event.eventType) ?? new Set();
    const all = [...targeted, ...this.globalHandlers];
    for (const handler of all) {
      try {
        await handler(event);
      } catch (error) {
        // At-least-once delivery: log and continue. Dead-letter handling is
        // the responsibility of the outbox relay for domain events.
        logger.error("event.handler.error", {
          eventType: event.eventType,
          eventId: event.eventId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor (stored on globalThis for cross-module-graph sharing)
// ---------------------------------------------------------------------------

const globalForBus = globalThis as unknown as { __sentinelEventBus?: EventBus };

export function getEventBus(): EventBus {
  if (!globalForBus.__sentinelEventBus) {
    // Provider switching is wired here. Redis/NATS implementations would be
    // constructed from config when EVENT_BUS_PROVIDER is set accordingly.
    globalForBus.__sentinelEventBus = new InMemoryEventBus();
  }
  return globalForBus.__sentinelEventBus;
}

export function setEventBus(bus: EventBus): void {
  globalForBus.__sentinelEventBus = bus;
}
