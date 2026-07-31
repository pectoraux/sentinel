/**
 * Sentinel — Job handler registry.
 * Registers all known background jobs with the queue.
 * New milestones register their jobs here.
 */

import { getJobQueue } from "../in-memory-job-queue";
import { runOutboxRelay } from "./outbox-relay";
import { logger } from "@/infrastructure/observability/logger";

export function registerAllJobHandlers(): void {
  const queue = getJobQueue();
  queue.register("outbox.relay", runOutboxRelay);
  logger.info("jobs.handlers.registered", { handlers: ["outbox.relay"] });
}
