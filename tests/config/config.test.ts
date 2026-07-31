/**
 * Tests — config module
 * Exercises: redact, isSecret, safeConfigSnapshot (secret redaction).
 *
 * The config module validates process.env via Zod on first access (lazy proxy).
 * We set explicit env values in beforeAll and call reloadConfig() so the
 * cached snapshot reflects this test's environment.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  redact,
  isSecret,
  safeConfigSnapshot,
  reloadConfig,
} from "@/config";

const TEST_SECRET = "super-secret-value-0123456789abcdef";
const TEST_DB_URL = "postgresql://sentinel:s3cr3t@postgres:5432/sentinel";
const TEST_S3_KEY = "AKIA-test-key";

describe("config — secret redaction", () => {
  // Computed AFTER beforeAll sets env + reloadConfig (describe bodies run at
  // import time, which is BEFORE beforeAll — so we must defer the snapshot).
  let snapshot: Record<string, unknown>;

  beforeAll(() => {
    // Set env BEFORE reloadConfig so the cached snapshot uses these values.
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.DATABASE_PROVIDER = "sqlite";
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.STORAGE_S3_ACCESS_KEY_ID = TEST_S3_KEY;
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = "s3-secret-value-here";
    process.env.EVENT_BUS_REDIS_URL = "redis://localhost:6379";
    process.env.JOB_QUEUE_REDIS_URL = "redis://localhost:6379";
    process.env.OTEL_SERVICE_NAME = "sentinel-test";
    reloadConfig();
    snapshot = safeConfigSnapshot();
  });

  describe("isSecret", () => {
    it("identifies known secret keys", () => {
      expect(isSecret("NEXTAUTH_SECRET")).toBe(true);
      expect(isSecret("GOOGLE_CLIENT_SECRET")).toBe(true);
      expect(isSecret("GITHUB_CLIENT_SECRET")).toBe(true);
      expect(isSecret("AZURE_AD_CLIENT_SECRET")).toBe(true);
      expect(isSecret("STORAGE_S3_ACCESS_KEY_ID")).toBe(true);
      expect(isSecret("STORAGE_S3_SECRET_ACCESS_KEY")).toBe(true);
      expect(isSecret("EVENT_BUS_REDIS_URL")).toBe(true);
      expect(isSecret("JOB_QUEUE_REDIS_URL")).toBe(true);
    });

    it("does not flag non-secret keys", () => {
      expect(isSecret("DATABASE_URL")).toBe(false);
      expect(isSecret("NODE_ENV")).toBe(false);
      expect(isSecret("OTEL_SERVICE_NAME")).toBe(false);
      expect(isSecret("PORT")).toBe(false);
      expect(isSecret("STORAGE_PROVIDER")).toBe(false);
      expect(isSecret("totally_unknown_key")).toBe(false);
    });
  });

  describe("redact", () => {
    it("replaces a truthy secret value with [REDACTED]", () => {
      expect(redact("NEXTAUTH_SECRET", TEST_SECRET)).toBe("[REDACTED]");
      expect(redact("STORAGE_S3_SECRET_ACCESS_KEY", "anything")).toBe(
        "[REDACTED]",
      );
    });

    it("preserves falsy secret values (empty / null)", () => {
      expect(redact("NEXTAUTH_SECRET", "")).toBe("");
      expect(redact("NEXTAUTH_SECRET", null)).toBeNull();
      expect(redact("NEXTAUTH_SECRET", undefined)).toBeUndefined();
    });

    it("returns non-secret values unchanged", () => {
      expect(redact("DATABASE_URL", TEST_DB_URL)).toBe(TEST_DB_URL);
      expect(redact("OTEL_SERVICE_NAME", "sentinel-test")).toBe(
        "sentinel-test",
      );
      expect(redact("PORT", 3000)).toBe(3000);
    });
  });

  describe("safeConfigSnapshot", () => {
    it("redacts all known secret keys", () => {
      expect(snapshot.NEXTAUTH_SECRET).toBe("[REDACTED]");
      expect(snapshot.STORAGE_S3_ACCESS_KEY_ID).toBe("[REDACTED]");
      expect(snapshot.STORAGE_S3_SECRET_ACCESS_KEY).toBe("[REDACTED]");
      expect(snapshot.EVENT_BUS_REDIS_URL).toBe("[REDACTED]");
      expect(snapshot.JOB_QUEUE_REDIS_URL).toBe("[REDACTED]");
    });

    it("exposes non-secret configuration values", () => {
      // DATABASE_URL is intentionally NOT in the secret set (it is parsed by
      // the application; the password within it is managed at the secrets
      // layer). The snapshot therefore surfaces it as-is.
      expect(snapshot.DATABASE_URL).toBe(TEST_DB_URL);
      expect(snapshot.OTEL_SERVICE_NAME).toBe("sentinel-test");
      expect(snapshot.NODE_ENV).toBe("test");
      expect(snapshot.DATABASE_PROVIDER).toBe("sqlite");
    });

    it("never leaks the raw NEXTAUTH_SECRET value", () => {
      const serialized = JSON.stringify(snapshot);
      expect(serialized).not.toContain(TEST_SECRET);
      expect(serialized).not.toContain(TEST_S3_KEY);
    });
  });
});
