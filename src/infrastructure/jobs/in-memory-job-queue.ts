/**
 * InMemoryJobQueue — dev/test implementation.
 * - Processes jobs on a setInterval poller.
 * - Retries with exponential backoff.
 * - Not durable across process restarts (use Redis impl for production).
 */

import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import { appMetrics } from "@/infrastructure/observability";
import type {
  JobContext,
  JobHandler,
  JobPayload,
  JobQueue,
} from "./job-queue";
import { DEFAULT_QUEUE } from "./job-queue";

interface QueuedJob {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  queue: string;
  attempts: number;
  maxAttempts: number;
  runAt: number;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `job_${Date.now()}_${counter}`;
}

export class InMemoryJobQueue implements JobQueue {
  private handlers = new Map<string, JobHandler>();
  private queue: QueuedJob[] = [];
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = 0;
  private readonly concurrency: number;
  private readonly pollIntervalMs = 500;

  constructor(concurrency?: number) {
    this.concurrency = concurrency ?? config.JOB_QUEUE_CONCURRENCY;
  }

  register(name: string, handler: JobHandler): void {
    if (this.handlers.has(name)) {
      logger.warn("job.duplicate-handler", { name });
    }
    this.handlers.set(name, handler);
  }

  async enqueue(job: JobPayload): Promise<string> {
    const id = nextId();
    this.queue.push({
      id,
      name: job.name,
      payload: job.payload,
      queue: job.queue ?? DEFAULT_QUEUE,
      attempts: 0,
      maxAttempts: job.maxAttempts ?? 3,
      runAt: job.runAt ? job.runAt.getTime() : Date.now(),
    });
    logger.debug("job.enqueue", { id, name: job.name });
    appMetrics.jobQueueDepth.set(this.depth());
    return id;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
    logger.info("jobqueue.started", { concurrency: this.concurrency });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // wait for in-flight jobs (best-effort)
    while (this.processing > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
    logger.info("jobqueue.stopped");
  }

  depth(): number {
    return this.queue.filter((j) => j.runAt <= Date.now()).length;
  }

  async isHealthy(): Promise<boolean> {
    return this.running;
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    while (this.processing < this.concurrency) {
      const now = Date.now();
      const idx = this.queue.findIndex((j) => j.runAt <= now);
      if (idx === -1) break;
      const [job] = this.queue.splice(idx, 1);
      appMetrics.jobQueueDepth.set(this.depth());
      this.processing += 1;
      void this.run(job).finally(() => {
        this.processing -= 1;
      });
    }
  }

  private async run(job: QueuedJob): Promise<void> {
    const handler = this.handlers.get(job.name);
    const ctx: JobContext = {
      jobId: job.id,
      attempts: job.attempts + 1,
      logger: logger.child({ jobId: job.id, jobName: job.name }),
    };
    if (!handler) {
      ctx.logger.error("job.no-handler", { name: job.name });
      return;
    }
    try {
      await handler(job.payload, ctx);
      ctx.logger.info("job.completed");
    } catch (error) {
      job.attempts += 1;
      const msg = error instanceof Error ? error.message : String(error);
      if (job.attempts >= job.maxAttempts) {
        ctx.logger.error("job.dead-lettered", { attempts: job.attempts, error: msg });
      } else {
        const backoffMs = Math.min(1000 * 2 ** job.attempts, 60000);
        job.runAt = Date.now() + backoffMs;
        this.queue.push(job);
        ctx.logger.warn("job.requeued", { attempts: job.attempts, backoffMs });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton (stored on globalThis so it is shared across Next.js module graphs)
// ---------------------------------------------------------------------------

const globalForJobs = globalThis as unknown as { __sentinelJobQueue?: JobQueue };

export function getJobQueue(): JobQueue {
  if (!globalForJobs.__sentinelJobQueue) {
    globalForJobs.__sentinelJobQueue = new InMemoryJobQueue();
  }
  return globalForJobs.__sentinelJobQueue;
}

export function setJobQueue(queue: JobQueue): void {
  globalForJobs.__sentinelJobQueue = queue;
}
