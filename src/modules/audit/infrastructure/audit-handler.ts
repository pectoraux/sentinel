/**
 * Sentinel — Audit event handler.
 * Subscribes to ALL domain events on the bus and records an audit entry for
 * each. This keeps audit logging centralized and automatic.
 */

import type { DomainEvent } from "@/core/shared";
import { getEventBus } from "@/infrastructure/event-bus";
import { getAuditService } from "../application/services/audit.service";

export function registerAuditHandler(): void {
  const audit = getAuditService();
  const bus = getEventBus();
  bus.subscribeAll(async (event: DomainEvent) => {
    await audit.record({
      actorId: (event.metadata?.userId as string) ?? undefined,
      actorType: (event.metadata?.actorType as string) ?? "system",
      action: event.eventType,
      resource: event.aggregateType,
      resourceId: event.aggregateId,
      outcome: "success",
      requestId: (event.metadata?.traceId as string) ?? undefined,
      metadata: {
        payload: event.payload,
        occurredAt: event.occurredAt,
      },
    });
  });
}
