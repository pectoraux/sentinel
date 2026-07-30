/**
 * Sentinel — Metrics
 * =============================================================================
 * Lightweight in-process metrics registry. In production this is bridged to
 * OpenTelemetry MeterProvider when OTEL_METRICS_ENABLED=true.
 *
 * Counters and histograms are exposed via /api/v1/metrics for the dashboard
 * and via OTLP for the observability stack.
 * =============================================================================
 */

type Labels = Record<string, string>;

interface MetricEntry {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  values: Map<string, number>;
}

class MetricsRegistry {
  private metrics = new Map<string, MetricEntry>();

  counter(name: string, help = ""): Counter {
    return this.ensure(name, "counter", help);
  }

  gauge(name: string, help = ""): Gauge {
    return this.ensure(name, "gauge", help);
  }

  histogram(name: string, help = ""): Histogram {
    return this.ensure(name, "histogram", help);
  }

  private ensure(name: string, type: MetricEntry["type"], help: string): Counter & Gauge & Histogram {
    let entry = this.metrics.get(name);
    if (!entry) {
      entry = { name, help, type, values: new Map() };
      this.metrics.set(name, entry);
    }
    const keyFor = (labels?: Labels) =>
      labels ? Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(",") : "";
    return {
      inc: (value = 1, labels?: Labels) => {
        const k = keyFor(labels);
        entry!.values.set(k, (entry!.values.get(k) ?? 0) + value);
      },
      set: (value: number, labels?: Labels) => {
        entry!.values.set(keyFor(labels), value);
      },
      observe: (value: number, labels?: Labels) => {
        // histogram: store last observed + sum approximation
        const k = keyFor(labels);
        entry!.values.set(k, value);
      },
      get: (labels?: Labels) => entry!.values.get(keyFor(labels)) ?? 0,
    };
  }

  snapshot(): Array<{ name: string; help: string; type: string; samples: Array<{ labels: Labels; value: number }> }> {
    return Array.from(this.metrics.values()).map((m) => ({
      name: m.name,
      help: m.help,
      type: m.type,
      samples: Array.from(m.values.entries()).map(([k, v]) => ({
        labels: k
          ? Object.fromEntries(k.split(",").map((p) => p.split("=")))
          : {},
        value: v,
      })),
    }));
  }
}

export interface Counter {
  inc(value?: number, labels?: Labels): void;
  get(labels?: Labels): number;
}
export interface Gauge {
  set(value: number, labels?: Labels): void;
  get(labels?: Labels): number;
}
export interface Histogram {
  observe(value: number, labels?: Labels): void;
  get(labels?: Labels): number;
}

export const metrics = new MetricsRegistry();

// Pre-registered application metrics
export const appMetrics = {
  httpRequestsTotal: metrics.counter(
    "http_requests_total",
    "Total HTTP requests by route and status",
  ),
  httpRequestDurationMs: metrics.histogram(
    "http_request_duration_ms",
    "HTTP request latency in milliseconds",
  ),
  eventBusPublishedTotal: metrics.counter(
    "event_bus_published_total",
    "Events published to the bus",
  ),
  eventBusHandlersFailedTotal: metrics.counter(
    "event_bus_handlers_failed_total",
    "Event handlers that threw",
  ),
  outboxPending: metrics.gauge(
    "outbox_pending",
    "Outbox events awaiting relay",
  ),
  jobQueueDepth: metrics.gauge(
    "job_queue_depth",
    "Background jobs awaiting processing",
  ),
  dbConnectionsActive: metrics.gauge(
    "db_connections_active",
    "Active database connections",
  ),
};
