/**
 * Sentinel — Developer Platform Service
 * =============================================================================
 * Manages webhook endpoints, API keys, SDK releases, and third-party
 * integrations. Provides the REST API directory and GraphQL schema.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  generateApiKey,
  generateWebhookSecret,
  generateWebhookKey,
  maskApiKey,
  REST_API_DIRECTORY,
  GRAPHQL_SCHEMA_SDL,
  type WebhookEventType,
  type ApiScope,
} from "../../domain/developer-types";

export class DeveloperService {
  // ===========================================================================
  // WEBHOOKS
  // ===========================================================================

  async createWebhook(params: {
    name: string;
    description?: string;
    url: string;
    events: string[];
    userId?: string;
    organizationId?: string;
    maxRetries?: number;
    retryDelaySec?: number;
    timeoutSec?: number;
  }): Promise<{ webhookId: string; key: string; secret: string }> {
    const key = generateWebhookKey(params.name);
    const secret = generateWebhookSecret();

    const webhook = await db.webhookEndpoint.create({
      data: {
        key,
        name: params.name,
        description: params.description,
        url: params.url,
        events: JSON.stringify(params.events),
        secret,
        userId: params.userId,
        organizationId: params.organizationId,
        maxRetries: params.maxRetries ?? 3,
        retryDelaySec: params.retryDelaySec ?? 60,
        timeoutSec: params.timeoutSec ?? 30,
        isActive: true,
      },
    });

    logger.info("dev.webhook_created", { webhookId: webhook.id, url: params.url, events: params.events.length });
    return { webhookId: webhook.id, key, secret };
  }

  async listWebhooks(params?: { userId?: string; isActive?: boolean; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const webhooks = await db.webhookEndpoint.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveries: true } } },
    });

    return {
      webhooks: webhooks.map((w) => ({
        ...w,
        events: w.events ? JSON.parse(w.events) : [],
        secret: w.secret ? maskApiKey(w.secret) : null,
        deliveryCount: w._count.deliveries,
      })),
    };
  }

  async getWebhook(id: string) {
    const webhook = await db.webhookEndpoint.findUnique({
      where: { id },
      include: {
        deliveries: { take: 20, orderBy: { createdAt: "desc" } },
        _count: { select: { deliveries: true } },
      },
    });
    if (!webhook) return null;
    return {
      ...webhook,
      events: webhook.events ? JSON.parse(webhook.events) : [],
      secret: webhook.secret ? maskApiKey(webhook.secret) : null,
      deliveries: webhook.deliveries.map((d) => ({
        ...d,
        payload: d.payload ? JSON.parse(d.payload) : null,
      })),
    };
  }

  async listDeliveries(params?: { endpointId?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.endpointId) where.endpointId = filters.endpointId;
    if (filters.status) where.status = filters.status;

    const deliveries = await db.webhookDelivery.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { endpoint: { select: { name: true, url: true } } },
    });

    return {
      deliveries: deliveries.map((d) => ({
        ...d,
        payload: d.payload ? JSON.parse(d.payload) : null,
      })),
    };
  }

  /**
   * Trigger webhooks for a given event type. Called by domain event handlers
   * when something happens in the platform (evidence created, alert detected, etc.)
   */
  async triggerWebhooks(eventType: WebhookEventType, payload: Record<string, unknown>): Promise<{ triggered: number }> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const payloadStr = JSON.stringify({ event: eventType, eventId, data: payload, timestamp: new Date().toISOString() });

    // Find all active webhooks subscribed to this event
    const allWebhooks = await db.webhookEndpoint.findMany({
      where: { isActive: true },
    });

    const matchingWebhooks = allWebhooks.filter((w) => {
      try {
        const events: string[] = JSON.parse(w.events);
        return events.includes(eventType) || events.includes("*");
      } catch {
        return false;
      }
    });

    let triggered = 0;
    for (const webhook of matchingWebhooks) {
      await db.webhookDelivery.create({
        data: {
          endpointId: webhook.id,
          eventType,
          eventId,
          payload: payloadStr,
          status: "pending",
          scheduledAt: new Date(),
        },
      });
      triggered++;

      // Update stats
      await db.webhookEndpoint.update({
        where: { id: webhook.id },
        data: {
          deliveryCount: { increment: 1 },
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: "pending",
        },
      });
    }

    logger.info("dev.webhooks_triggered", { eventType, eventId, triggered });
    return { triggered };
  }

  // ===========================================================================
  // API KEYS
  // ===========================================================================

  async createApiKey(params: {
    name: string;
    description?: string;
    scopes: string[];
    userId?: string;
    organizationId?: string;
    rateLimitPerMin?: number;
    rateLimitPerDay?: number;
    expiresAt?: Date;
  }): Promise<{ apiKeyId: string; key: string; keyPrefix: string }> {
    const { key, keyPrefix } = generateApiKey("live");

    const apiKey = await db.apiKey.create({
      data: {
        key,
        keyPrefix,
        name: params.name,
        description: params.description,
        scopes: JSON.stringify(params.scopes),
        userId: params.userId,
        organizationId: params.organizationId,
        rateLimitPerMin: params.rateLimitPerMin ?? 100,
        rateLimitPerDay: params.rateLimitPerDay ?? 10000,
        expiresAt: params.expiresAt,
        status: "active",
      },
    });

    logger.info("dev.api_key_created", { apiKeyId: apiKey.id, name: params.name, scopes: params.scopes });
    return { apiKeyId: apiKey.id, key, keyPrefix };
  }

  async listApiKeys(params?: { userId?: string; status?: string; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;

    const apiKeys = await db.apiKey.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return {
      apiKeys: apiKeys.map((k) => ({
        ...k,
        key: maskApiKey(k.key),
        scopes: k.scopes ? JSON.parse(k.scopes) : [],
      })),
    };
  }

  async revokeApiKey(id: string): Promise<{ apiKeyId: string }> {
    await db.apiKey.update({
      where: { id },
      data: { status: "revoked" },
    });
    return { apiKeyId: id };
  }

  // ===========================================================================
  // SDK
  // ===========================================================================

  async listSdkReleases(params?: { language?: string; limit?: number }) {
    const { limit = 50, language } = params ?? {};
    const where: Record<string, unknown> = {};
    if (language) where.language = language;

    const releases = await db.sdkRelease.findMany({
      where,
      take: limit,
      orderBy: { publishedAt: "desc" },
    });

    return { releases };
  }

  async getLatestSdks() {
    const releases = await db.sdkRelease.findMany({
      where: { isLatest: true, deprecated: false },
      orderBy: { publishedAt: "desc" },
    });
    return { releases };
  }

  // ===========================================================================
  // INTEGRATIONS
  // ===========================================================================

  async listIntegrations(params?: { category?: string; isActive?: boolean; limit?: number }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const integrations = await db.apiIntegration.findMany({
      where,
      take: limit,
      orderBy: { installCount: "desc" },
    });

    return { integrations };
  }

  // ===========================================================================
  // API DIRECTORY & DOCS
  // ===========================================================================

  getApiDirectory() {
    return {
      endpoints: REST_API_DIRECTORY,
      total: REST_API_DIRECTORY.length,
      byCategory: REST_API_DIRECTORY.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      version: "v1",
      baseUrl: "/api/v1",
    };
  }

  getGraphqlSchema() {
    return {
      sdl: GRAPHQL_SCHEMA_SDL,
      endpoint: "/api/v1/dev/graphql",
      version: "1.0",
    };
  }

  getDocs() {
    return {
      title: "Sentinel Developer Platform",
      version: "1.0.0",
      description: "Sentinel is an AI-native Community Intelligence & Digital Twin platform for detecting, verifying, and predicting illegal mining and environmental crimes across Africa.",
      sections: [
        {
          title: "Getting Started",
          content: "1. Create an API key at /api/v1/dev/api-keys\n2. Install the SDK: npm install @sentinel/sdk\n3. Initialize: const sentinel = new Sentinel({ apiKey: 'sk_live_...' })\n4. Start querying: const evidence = await sentinel.evidence.list()",
        },
        {
          title: "Authentication",
          content: "All API requests require an API key passed in the Authorization header: Authorization: Bearer sk_live_... API keys can be created at /api/v1/dev/api-keys with specific scopes (read:evidence, write:webhooks, etc.).",
        },
        {
          title: "Rate Limiting",
          content: "Default rate limits: 100 requests/minute, 10,000 requests/day. Rate limits can be customized per API key. Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.",
        },
        {
          title: "Webhooks",
          content: "Subscribe to 19 event types (evidence.created, alert.detected, investigation.opened, etc.). Webhooks are signed with HMAC-SHA256. Verify the signature using your webhook secret. Retries: up to 3 attempts with exponential backoff.",
        },
        {
          title: "GraphQL",
          content: "Query the Digital Twin flexibly with GraphQL at /api/v1/dev/graphql. Supports queries for twin entities, evidence, events, trust, hotspots, predictions, investigations, cases, missions, rewards, fraud alerts, and analytics. Mutations for creating evidence, events, accepting missions, running simulations, and managing webhooks/API keys.",
        },
        {
          title: "SDK",
          content: "Official SDKs available for JavaScript/TypeScript (npm), Python (PyPI), Go (Go modules), Java (Maven), PHP (Packagist), Ruby (RubyGems). Each SDK provides typed access to all REST API endpoints with automatic retries and rate limit handling.",
        },
        {
          title: "Integrations",
          content: "Official integrations: Slack (alerts), Microsoft Teams (alerts), ArcGIS (GIS data), Grafana (monitoring), Power BI (analytics), Zapier (automation). Each integration has a setup guide and config schema.",
        },
      ],
      codeExamples: {
        javascript: `import { Sentinel } from '@sentinel/sdk';

const sentinel = new Sentinel({ apiKey: 'sk_live_...' });

// List evidence
const evidence = await sentinel.evidence.list({ type: 'image', limit: 10 });

// Create intelligence event
const event = await sentinel.events.create({
  title: 'Illegal mining at Pra River',
  type: 'illegal_mining',
  severity: 'high',
  lat: 5.43, lng: -2.14,
});

// Subscribe to webhooks
const webhook = await sentinel.webhooks.create({
  name: 'My Alert Bot',
  url: 'https://myapp.com/webhook',
  events: ['alert.detected', 'evidence.created'],
});`,
        python: `from sentinel import Sentinel

sentinel = Sentinel(api_key='sk_live_...')

# List evidence
evidence = sentinel.evidence.list(type='image', limit=10)

# Create intelligence event
event = sentinel.events.create(
    title='Illegal mining at Pra River',
    type='illegal_mining',
    severity='high',
    lat=5.43, lng=-2.14,
)

# Subscribe to webhooks
webhook = sentinel.webhooks.create(
    name='My Alert Bot',
    url='https://myapp.com/webhook',
    events=['alert.detected', 'evidence.created'],
)`,
        go: `package main

import (
    "github.com/sentinel-africa/sdk-go"
)

func main() {
    client := sentinel.New("sk_live_...")

    // List evidence
    evidence, _ := client.Evidence.List(&sentinel.ListParams{
        Type: "image", Limit: 10,
    })

    // Create intelligence event
    event, _ := client.Events.Create(&sentinel.Event{
        Title: "Illegal mining at Pra River",
        Type: "illegal_mining",
        Severity: "high",
        Lat: 5.43, Lng: -2.14,
    })
}`,
      },
    };
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  async summary() {
    const [
      totalWebhooks,
      activeWebhooks,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      totalApiKeys,
      activeApiKeys,
      totalSdkReleases,
      totalIntegrations,
      officialIntegrations,
      recentWebhooks,
      recentDeliveries,
      recentApiKeys,
    ] = await Promise.all([
      db.webhookEndpoint.count(),
      db.webhookEndpoint.count({ where: { isActive: true } }),
      db.webhookDelivery.count(),
      db.webhookDelivery.count({ where: { status: "success" } }),
      db.webhookDelivery.count({ where: { status: "failed" } }),
      db.apiKey.count(),
      db.apiKey.count({ where: { status: "active" } }),
      db.sdkRelease.count(),
      db.apiIntegration.count(),
      db.apiIntegration.count({ where: { isOfficial: true } }),
      db.webhookEndpoint.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { _count: { select: { deliveries: true } } } }),
      db.webhookDelivery.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { endpoint: { select: { name: true } } } }),
      db.apiKey.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, keyPrefix: true, name: true, scopes: true, status: true, totalRequests: true, lastUsedAt: true, createdAt: true } }),
    ]);

    const apiDirectory = this.getApiDirectory();
    const deliverySuccessRate = totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 0;

    return {
      // REST API
      apiEndpoints: apiDirectory.total,
      apiCategories: Object.keys(apiDirectory.byCategory).length,
      apiVersion: "v1",
      // GraphQL
      graphqlEnabled: true,
      graphqlTypes: 20, // approx types in schema
      graphqlQueries: 15,
      graphqlMutations: 6,
      // Webhooks
      totalWebhooks,
      activeWebhooks,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      deliverySuccessRate,
      webhookEventTypes: 19,
      // API Keys
      totalApiKeys,
      activeApiKeys,
      // SDK
      totalSdkReleases,
      sdkLanguages: 6,
      // Integrations
      totalIntegrations,
      officialIntegrations,
      integrationCategories: 6,
      // Recent items
      recentWebhooks: recentWebhooks.map((w) => ({
        id: w.id, key: w.key, name: w.name, url: w.url,
        isActive: w.isActive, deliveryCount: w._count.deliveries,
        successCount: w.successCount, failureCount: w.failureCount,
        lastDeliveryStatus: w.lastDeliveryStatus, lastDeliveryAt: w.lastDeliveryAt,
        createdAt: w.createdAt,
      })),
      recentDeliveries: recentDeliveries.map((d) => ({
        id: d.id, eventType: d.eventType, status: d.status, statusCode: d.statusCode,
        endpointName: d.endpoint.name, attempt: d.attempt,
        deliveredAt: d.deliveredAt, createdAt: d.createdAt,
      })),
      recentApiKeys: recentApiKeys.map((k) => ({
        id: k.id, keyPrefix: k.keyPrefix, name: k.name,
        scopes: k.scopes ? JSON.parse(k.scopes) : [],
        status: k.status, totalRequests: k.totalRequests,
        lastUsedAt: k.lastUsedAt, createdAt: k.createdAt,
      })),
    };
  }
}

let _svc: DeveloperService | null = null;
export function getDeveloperService(): DeveloperService {
  if (!_svc) _svc = new DeveloperService();
  return _svc;
}
