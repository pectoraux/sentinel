/**
 * Outbox Relay — reads pending OutboxEvents and publishes them to the EventBus.
 *
 * Implements the transactional outbox pattern: domain events are first written
 * to the `OutboxEvent` table in the same transaction as the state change, then
 * this relay drains them to the event bus with at-least-once semantics.
 *
 * Registered as a recurring background job ("outbox.relay").
 */

import { db } from "@/lib/db";
import { getEventBus } from "@/infrastructure/event-bus";
import { logger } from "@/infrastructure/observability/logger";
import { appMetrics } from "@/infrastructure/observability";
import type { JobContext } from "@/infrastructure/jobs/job-queue";

const BATCH_SIZE = 50;

export async function runOutboxRelay(_payload: Record<string, unknown>, ctx: JobContext): Promise<void> {
  const pending = await db.outboxEvent.findMany({
    where: { status: "pending" },
    orderBy: { occurredAt: "asc" },
    take: BATCH_SIZE,
  });

  appMetrics.outboxPending.set(await db.outboxEvent.count({ where: { status: "pending" } }));

  if (pending.length === 0) return;
  ctx.logger.info("outbox.relay.batch", { count: pending.length });

  const bus = getEventBus();
  for (const evt of pending) {
    try {
      const domainEvent = {
        eventId: evt.id,
        eventType: evt.eventType,
        occurredAt: evt.occurredAt,
        aggregateType: evt.aggregateType,
        aggregateId: evt.aggregateId,
        payload: safeParse(evt.payload, {}),
        metadata: safeParse(evt.metadata, undefined),
      };
      await bus.publish(domainEvent);
      await db.outboxEvent.update({
        where: { id: evt.id },
        data: {
          status: "published",
          attempts: { increment: 1 },
          publishedAt: new Date(),
        },
      });
      appMetrics.eventBusPublishedTotal.inc(1, { type: evt.eventType });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const attempts = evt.attempts + 1;
      await db.outboxEvent.update({
        where: { id: evt.id },
        data: {
          status: attempts >= 5 ? "dead_letter" : "pending",
          attempts,
          lastError: msg,
        },
      });
      logger.error("outbox.relay.failed", { id: evt.id, attempts, error: msg });
    }
  }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
