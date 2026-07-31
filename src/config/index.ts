/**
 * Sentinel — Configuration System
 * =============================================================================
 * Centralized, validated, type-safe configuration.
 *
 * Design:
 * - All environment variables are validated at startup via Zod schemas.
 * - Invalid configuration fails fast (no silent undefined behavior in prod).
 * - Secrets are tagged so observability never leaks them.
 * - Configuration is frozen after first read (immutable single source of truth).
 *
 * Secrets management strategy (production):
 * - `.env` is for local development ONLY.
 * - In production, secrets are injected at runtime from a secrets manager
 *   (HashiCorp Vault / AWS Secrets Manager / GCP Secret Manager) via the
 *   container runtime environment. No secret is ever written to the image.
 * - The `secret()` accessor marks a value as sensitive for redaction in logs.
 * =============================================================================
 */

import { z } from "zod";

const booleanString = z
  .string()
  .transform((v) => v === "true" || v === "1")
  .or(z.boolean());

const numString = z.coerce.number();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const schema = z.object({
  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Sentinel"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("0.0.0"),
  NEXT_PUBLIC_API_VERSION: z.string().default("v1"),
  PORT: numString.default(3000),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  DATABASE_POOL_MAX: numString.default(10),
  DATABASE_POOL_TIMEOUT_MS: numString.default(30000),

  // Auth
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 chars"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  AUTH_PROVIDERS: z
    .string()
    .default("credentials")
    .transform((v) => v.split(",").map((p) => p.trim()).filter(Boolean)),
  AUTH_SESSION_STRATEGY: z.enum(["jwt", "database"]).default("jwt"),
  AUTH_SESSION_MAX_AGE_SECONDS: numString.default(86400),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),

  // Object Storage
  STORAGE_PROVIDER: z.enum(["local", "s3", "minio"]).default("local"),
  STORAGE_LOCAL_BASE_DIR: z.string().default("./storage"),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_REGION: z.string().default("us-east-1"),
  STORAGE_S3_BUCKET: z.string().default("sentinel-media"),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: booleanString.default(true),

  // Event Bus
  EVENT_BUS_PROVIDER: z.enum(["memory", "redis", "nats"]).default("memory"),
  EVENT_BUS_REDIS_URL: z.string().optional(),
  EVENT_BUS_NATS_URL: z.string().optional(),

  // Jobs
  JOB_QUEUE_PROVIDER: z.enum(["memory", "redis"]).default("memory"),
  JOB_QUEUE_REDIS_URL: z.string().optional(),
  JOB_QUEUE_CONCURRENCY: numString.default(4),

  // Observability
  OTEL_SERVICE_NAME: z.string().default("sentinel-web"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_PROTOCOL: z
    .enum(["http/protobuf", "grpc"])
    .default("http/protobuf"),
  OTEL_TRACES_ENABLED: booleanString.default(false),
  OTEL_METRICS_ENABLED: booleanString.default(false),
  OTEL_LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // Feature Flags
  FEATURE_FLAG_PROVIDER: z.enum(["database", "memory"]).default("database"),

  // Security
  PASSWORD_MIN_LENGTH: numString.default(12),
  PASSWORD_REQUIRE_SPECIAL: booleanString.default(true),
  RATE_LIMIT_WINDOW_MS: numString.default(60000),
  RATE_LIMIT_MAX: numString.default(100),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),

  // Health
  HEALTH_CHECK_TIMEOUT_MS: numString.default(5000),
});

export type AppConfig = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Loader (fail-fast)
// ---------------------------------------------------------------------------

let cached: AppConfig | null = null;

function load(): AppConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(
      `[sentinel] Invalid configuration:\n${issues}\n\n` +
        `See .env.example for required variables.`,
    );
    throw new Error("Invalid configuration — see logs above.");
  }
  return Object.freeze(parsed.data);
}

export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_t, prop: string) {
    if (!cached) cached = load();
    return cached[prop as keyof AppConfig];
  },
});

/**
 * Reload configuration (mainly for tests). Re-runs validation.
 */
export function reloadConfig(): AppConfig {
  cached = load();
  return cached;
}

// ---------------------------------------------------------------------------
// Secret accessor — marks values for redaction in logs/telemetry.
// ---------------------------------------------------------------------------

const SECRET_KEYS = new Set<string>([
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  "AZURE_AD_CLIENT_SECRET",
  "STORAGE_S3_SECRET_ACCESS_KEY",
  "STORAGE_S3_ACCESS_KEY_ID",
  "EVENT_BUS_REDIS_URL",
  "JOB_QUEUE_REDIS_URL",
]);

export function isSecret(key: string): boolean {
  return SECRET_KEYS.has(key);
}

export function redact(key: string, value: unknown): unknown {
  if (isSecret(key)) return value ? "[REDACTED]" : value;
  return value;
}

/**
 * Safe snapshot of config for logging — secrets redacted.
 */
export function safeConfigSnapshot(): Record<string, unknown> {
  if (!cached) cached = load();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cached)) {
    out[k] = isSecret(k) ? "[REDACTED]" : v;
  }
  return out;
}
