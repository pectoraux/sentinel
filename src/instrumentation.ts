/**
 * Sentinel — Next.js instrumentation hook.
 * Loaded once per server process before handling requests.
 * Initializes OpenTelemetry here so spans cover the entire request lifecycle.
 *
 * Next.js 16 invokes this in BOTH the Node.js and Edge runtimes. The OTel SDK
 * is Node-only, so we skip initialization in the Edge runtime.
 */

export async function register(): Promise<void> {
  // NEXT_RUNTIME is 'nodejs' or 'edge' (set by Next.js build).
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { initTelemetry } = await import("@/infrastructure/observability/telemetry");
  await initTelemetry();
}
