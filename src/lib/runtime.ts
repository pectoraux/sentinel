/**
 * Sentinel — Runtime bootstrap
 * =============================================================================
 * Idempotently initializes all server-side subsystems on first import:
 *   - Registers job handlers and starts the background job queue
 *   - Registers the audit event handler on the event bus
 *   - Schedules the outbox relay as a recurring background job
 *
 * Called from the root layout (server component) so it runs once per server.
 * =============================================================================
 */

import { getJobQueue, registerAllJobHandlers } from "@/infrastructure/jobs";
import { getEventBus } from "@/infrastructure/event-bus";
import { registerAuditHandler } from "@/modules/audit";
import { logger } from "@/infrastructure/observability/logger";
import { config } from "@/config";

const globalForRuntime = globalThis as unknown as { __sentinelBootstrapped?: boolean };

export async function bootstrapRuntime(): Promise<void> {
  if (globalForRuntime.__sentinelBootstrapped) return;
  globalForRuntime.__sentinelBootstrapped = true;

  try {
    // 1. Register all known job handlers
    registerAllJobHandlers();

    // 2. Start the background job queue
    await getJobQueue().start();

    // 3. Register the audit handler (subscribes to all domain events)
    registerAuditHandler();

    // 4. Schedule the outbox relay to run every 5 seconds
    scheduleOutboxRelay();

    logger.info("runtime.bootstrapped", {
      env: config.NODE_ENV,
      eventBus: config.EVENT_BUS_PROVIDER,
      jobQueue: config.JOB_QUEUE_PROVIDER,
      storage: config.STORAGE_PROVIDER,
    });
  } catch (error) {
    logger.error("runtime.bootstrap.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't rethrow: the app should still serve requests even if background
    // subsystems fail to start (they'll be reported as unhealthy by probes).
  }
}

function scheduleOutboxRelay(): void {
  const queue = getJobQueue();
  const run = async () => {
    try {
      await queue.enqueue({ name: "outbox.relay", payload: {} });
    } catch {
      // swallow — will retry next tick
    }
  };
  // Fire once immediately, then every 5 seconds.
  void run();
  setInterval(() => void run(), 5_000);
}
