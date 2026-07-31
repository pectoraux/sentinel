/**
 * Sentinel — Structured Logger
 * =============================================================================
 * A minimal, dependency-light structured logger that emits JSON lines in
 * production and pretty output in development.
 *
 * In production, logs are scraped by the observability stack (Loki/CloudWatch/
 * Datadog) and correlated with OpenTelemetry traces via `traceId`/`spanId`.
 *
 * The logger is intentionally NOT coupled to a specific OTel SDK so it can run
 * even when OTel exporters are disabled (dev). When OTel is active, the active
 * span context is injected automatically into log records.
 * =============================================================================
 */

import { config } from "@/config";
import * as otelApi from "@opentelemetry/api";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const activeLevel: LogLevel = config.LOG_LEVEL as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[activeLevel];
}

export interface LogContext {
  [key: string]: unknown;
}

interface LogRecord {
  ts: string;
  level: LogLevel;
  msg: string;
  ctx?: LogContext;
  traceId?: string;
  spanId?: string;
  service: string;
  env: string;
}

function getActiveSpanContext(): { traceId?: string; spanId?: string } {
  try {
    const span = otelApi.trace.getSpan(otelApi.context.active());
    if (!span) return {};
    const ctx = span.spanContext();
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    return {};
  }
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (!shouldLog(level)) return;
  const record: LogRecord = {
    ts: new Date().toISOString(),
    level,
    msg,
    ctx,
    service: config.OTEL_SERVICE_NAME,
    env: config.NODE_ENV,
    ...getActiveSpanContext(),
  };

  const line =
    config.NODE_ENV === "production"
      ? JSON.stringify(record)
      : `[${record.ts}] ${level.toUpperCase().padEnd(5)} ${msg}${
          ctx ? ` ${JSON.stringify(ctx)}` : ""
        }${record.traceId ? ` trace=${record.traceId.slice(0, 8)}` : ""}`;

  // Edge Runtime guard: process.stdout may be undefined in edge contexts
  // (e.g. the instrumentation hook). Fall back to console.
  if (typeof process !== "undefined" && process.stdout && typeof process.stdout.write === "function") {
    process.stdout.write(line + "\n");
  } else {
    console.log(line);
  }
}

export const logger = {
  trace: (msg: string, ctx?: LogContext) => emit("trace", msg, ctx),
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
  fatal: (msg: string, ctx?: LogContext) => emit("fatal", msg, ctx),
  child: (baseCtx: LogContext) => ({
    trace: (msg: string, ctx?: LogContext) => emit("trace", msg, { ...baseCtx, ...ctx }),
    debug: (msg: string, ctx?: LogContext) => emit("debug", msg, { ...baseCtx, ...ctx }),
    info: (msg: string, ctx?: LogContext) => emit("info", msg, { ...baseCtx, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => emit("warn", msg, { ...baseCtx, ...ctx }),
    error: (msg: string, ctx?: LogContext) => emit("error", msg, { ...baseCtx, ...ctx }),
    fatal: (msg: string, ctx?: LogContext) => emit("fatal", msg, { ...baseCtx, ...ctx }),
  }),
};
