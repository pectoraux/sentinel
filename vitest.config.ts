import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Sentinel - Vitest configuration
 * ============================================================================
 * - Environment: node (foundation tests are pure / unit-level; no jsdom)
 * - Path alias:  "@" -> ./src (mirrors tsconfig.json paths)
 * - Coverage:    v8 provider; excludes build output & deps
 * - Include:     test files matching the "tests" glob
 *
 * Tests MUST NOT require a running database. All tests are pure/unit-level so
 * they run identically in local dev and in CI.
 * ============================================================================
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist", "build"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "src/components/ui/**",
        "src/**/*.d.ts",
        "src/instrumentation.ts",
        "tests/**",
      ],
      thresholds: {
        // Foundation-level safety net. Per-module coverage expands in later
        // milestones as domain logic grows.
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
