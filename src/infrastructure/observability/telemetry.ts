/**
 * Sentinel — OpenTelemetry instrumentation
 * =============================================================================
 * Initializes tracing and metrics pipelines for the Sentinel web service.
 *
 * - When OTEL_TRACES_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT is set,
 *   spans are exported via OTLP (to a Collector / Tempo / Jaeger / Honeycomb).
 * - When disabled (default in dev), a no-op provider is used to keep startup
 *   fast and dependency-free.
 *
 * This module MUST be imported before the app starts handling requests so the
 * provider is registered first. It is wired via `instrumentation.ts` (Next.js
 * instrumentation hook) so it loads in both server and edge runtimes.
 * =============================================================================
 */

import { config } from "@/config";
import { logger } from "./logger";
import * as otelApi from "@opentelemetry/api";

export interface TelemetryState {
  enabled: boolean;
  serviceName: string;
  tracesActive: boolean;
  metricsActive: boolean;
}

let state: TelemetryState | null = null;

export async function initTelemetry(): Promise<TelemetryState> {
  if (state) return state;

  const serviceName = config.OTEL_SERVICE_NAME;
  const tracesActive =
    config.OTEL_TRACES_ENABLED && !!config.OTEL_EXPORTER_OTLP_ENDPOINT;
  const metricsActive =
    config.OTEL_METRICS_ENABLED && !!config.OTEL_EXPORTER_OTLP_ENDPOINT;

  state = {
    enabled: tracesActive || metricsActive,
    serviceName,
    tracesActive,
    metricsActive,
  };

  if (tracesActive || metricsActive) {
    try {
      // Dynamically import the OTel SDK so it is only loaded when needed.
      const { NodeSDK } = await import("@opentelemetry/sdk-node").catch(() => ({}));
      if (!NodeSDK) {
        logger.warn("otel.sdk.unavailable", {
          note: "@opentelemetry/sdk-node not installed; traces disabled",
        });
        return state;
      }
      const sdk = new NodeSDK({
        serviceName,
        // Exporter configuration is read from standard OTel env vars.
      });
      sdk.start();
      logger.info("otel.started", { serviceName, tracesActive, metricsActive });
    } catch (error) {
      logger.warn("otel.start.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      state.tracesActive = false;
      state.metricsActive = false;
    }
  } else {
    logger.info("otel.disabled", {
      note: "Set OTEL_TRACES_ENABLED=true + OTEL_EXPORTER_OTLP_ENDPOINT to enable",
    });
  }

  return state;
}

export function getTelemetryState(): TelemetryState {
  if (!state) {
    return {
      enabled: false,
      serviceName: config.OTEL_SERVICE_NAME,
      tracesActive: false,
      metricsActive: false,
    };
  }
  return state;
}

/**
 * Tracer accessor — returns the active tracer or a no-op if OTel is disabled.
 */
export function getTracer(name: string = config.OTEL_SERVICE_NAME) {
  try {
    return otelApi.trace.getTracer(name);
  } catch {
    return noopTracer;
  }
}

const noopSpan: { end(): void; setAttribute(_k: string, _v: unknown): void } = {
  end() {},
  setAttribute() {},
};
const noopTracer = {
  startSpan(_name: string) {
    return noopSpan;
  },
};
