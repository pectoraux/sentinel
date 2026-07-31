/**
 * Sentinel — Background Job system
 * =============================================================================
 * Provider-agnostic job queue abstraction.
 *
 * - Jobs are durable: a JobRecord is persisted before enqueue so the system
 *   survives process restarts (the relay picks up `queued` jobs on boot).
 * - Handlers are registered by name and discovered via a registry.
 * - In-memory implementation runs jobs in-process (dev). Redis/BullMQ
 *   implementation is the production target (multi-worker, retries, backoff).
 *
 * Future milestones plug domain jobs (e.g. "ingest.satellite-tile",
 * "run.detector.cnn", "twin.simulate") into this same system.
 * =============================================================================
 */

export interface JobPayload {
  name: string;
  payload: Record<string, unknown>;
  queue?: string;
  maxAttempts?: number;
  runAt?: Date;
}

export interface JobContext {
  jobId: string;
  attempts: number;
  logger: { info: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void };
}

export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<void>;

export interface JobQueue {
  /** Register a handler for a job name. */
  register(name: string, handler: JobHandler): void;
  /** Enqueue a job for processing. */
  enqueue(job: JobPayload): Promise<string>;
  /** Start processing the queue. */
  start(): Promise<void>;
  /** Stop processing (graceful drain). */
  stop(): Promise<void>;
  /** Number of queued jobs awaiting processing. */
  depth(): number;
  /** Health check. */
  isHealthy(): Promise<boolean>;
}

export const DEFAULT_QUEUE = "default";
