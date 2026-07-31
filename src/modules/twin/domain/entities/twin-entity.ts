/**
 * Sentinel — Digital Twin: TwinEntity aggregate root
 * =============================================================================
 * The core Digital Twin entity. Every environmental object (river, road, mine,
 * forest, community, inspection, event, concession, protected area, equipment,
 * historical imagery) is a TwinEntity.
 *
 * Capabilities:
 *   - Versioning: every state change creates a new immutable version snapshot.
 *     The currentVersion pointer advances; old versions remain queryable.
 *   - Relationships: entities form a graph (near, contains, affects, monitors…).
 *   - History: a timeline of TwinEvents records what happened and when.
 *   - Metadata: flexible JSON attributes — type-specific schema enforced by the
 *     EntityTypeMeta catalogue.
 *
 * Invariants:
 *   - Version numbers are monotonically increasing (no gaps, no decreases).
 *   - Restoring to a past version creates a NEW version (doesn't overwrite).
 *   - Status transitions follow the allowed lifecycle per type.
 * =============================================================================
 */

import { AggregateRoot, type Result, ok, err, type UniqueId } from "@/core/shared";
import { TwinEvents } from "../events/twin-events";
import type { EntityType } from "../entity-types";

export type EntityStatus =
  | "active"
  | "monitored"
  | "closed"
  | "degraded"
  | "historical"
  | "planned";

export interface TwinEntitySnapshot {
  key: string;
  type: EntityType;
  name: string;
  description: string | null;
  status: EntityStatus;
  geojson: string | null;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown> | null;
  organizationId: string | null;
  country: string | null;
  region: string | null;
  version: number;
}

export class TwinEntity extends AggregateRoot<UniqueId> {
  private _key: string;
  private _type: EntityType;
  private _name: string;
  private _description: string | null;
  private _status: EntityStatus;
  private _geojson: string | null;
  private _lat: number | null;
  private _lng: number | null;
  private _metadata: Record<string, unknown> | null;
  private _currentVersion: number;
  private _organizationId: string | null;
  private _country: string | null;
  private _region: string | null;

  constructor(params: {
    id: UniqueId;
    key: string;
    type: EntityType;
    name: string;
    description?: string | null;
    status?: EntityStatus;
    geojson?: string | null;
    lat?: number | null;
    lng?: number | null;
    metadata?: Record<string, unknown> | null;
    currentVersion?: number;
    organizationId?: string | null;
    country?: string | null;
    region?: string | null;
  }) {
    super(params.id);
    this._key = params.key;
    this._type = params.type;
    this._name = params.name;
    this._description = params.description ?? null;
    this._status = params.status ?? "active";
    this._geojson = params.geojson ?? null;
    this._lat = params.lat ?? null;
    this._lng = params.lng ?? null;
    this._metadata = params.metadata ?? null;
    this._currentVersion = params.currentVersion ?? 1;
    this._organizationId = params.organizationId ?? null;
    this._country = params.country ?? null;
    this._region = params.region ?? null;
  }

  // --- Getters ---
  get key(): string {
    return this._key;
  }
  get type(): EntityType {
    return this._type;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | null {
    return this._description;
  }
  get status(): EntityStatus {
    return this._status;
  }
  get geojson(): string | null {
    return this._geojson;
  }
  get lat(): number | null {
    return this._lat;
  }
  get lng(): number | null {
    return this._lng;
  }
  get metadata(): Record<string, unknown> | null {
    return this._metadata;
  }
  get currentVersion(): number {
    return this._currentVersion;
  }
  get organizationId(): string | null {
    return this._organizationId;
  }
  get country(): string | null {
    return this._country;
  }
  get region(): string | null {
    return this._region;
  }

  // --- Mutations (produce domain events + version increments) ---

  /**
   * Update the entity's mutable fields. Produces a versioned snapshot.
   */
  update(params: {
    name?: string;
    description?: string | null;
    status?: EntityStatus;
    geojson?: string | null;
    lat?: number | null;
    lng?: number | null;
    metadata?: Record<string, unknown> | null;
    region?: string | null;
    changedBy?: string;
  }): Result<{ fromVersion: number; toVersion: number; diff: Record<string, unknown> }> {
    const fromVersion = this._currentVersion;
    const diff: Record<string, unknown> = {};

    if (params.name !== undefined && params.name !== this._name) {
      diff.name = { from: this._name, to: params.name };
      this._name = params.name;
    }
    if (params.description !== undefined && params.description !== this._description) {
      diff.description = { from: this._description, to: params.description };
      this._description = params.description;
    }
    if (params.status !== undefined && params.status !== this._status) {
      diff.status = { from: this._status, to: params.status };
      this._status = params.status;
    }
    if (params.geojson !== undefined && params.geojson !== this._geojson) {
      diff.geojson = "changed";
      this._geojson = params.geojson;
    }
    if (params.lat !== undefined && params.lat !== this._lat) {
      diff.lat = { from: this._lat, to: params.lat };
      this._lat = params.lat;
    }
    if (params.lng !== undefined && params.lng !== this._lng) {
      diff.lng = { from: this._lng, to: params.lng };
      this._lng = params.lng;
    }
    if (params.metadata !== undefined) {
      diff.metadata = "changed";
      this._metadata = params.metadata;
    }
    if (params.region !== undefined && params.region !== this._region) {
      diff.region = { from: this._region, to: params.region };
      this._region = params.region;
    }

    if (Object.keys(diff).length === 0) {
      return err("no_changes");
    }

    this._currentVersion += 1;
    const toVersion = this._currentVersion;
    this.addDomainEvent(
      TwinEvents.EntityUpdated(this.id.value, this._type, fromVersion, toVersion, params.changedBy),
    );
    return ok({ fromVersion, toVersion, diff });
  }

  /**
   * Restore the entity to a past version. Creates a NEW version (does not
   * overwrite history). The snapshot from the target version becomes the
   * current state.
   */
  restoreToVersion(targetVersion: number, snapshot: TwinEntitySnapshot, restoredBy?: string): Result<number> {
    if (targetVersion < 1 || targetVersion > this._currentVersion) {
      return err("invalid_version");
    }
    this._name = snapshot.name;
    this._description = snapshot.description;
    this._status = snapshot.status;
    this._geojson = snapshot.geojson;
    this._lat = snapshot.lat;
    this._lng = snapshot.lng;
    this._metadata = snapshot.metadata;
    this._currentVersion += 1;
    this.addDomainEvent(
      TwinEvents.EntityRestored(this.id.value, this._type, targetVersion, restoredBy),
    );
    return ok(this._currentVersion);
  }

  /**
   * Produce a serializable snapshot of the current state (for version storage).
   */
  toSnapshot(): TwinEntitySnapshot {
    return {
      key: this._key,
      type: this._type,
      name: this._name,
      description: this._description,
      status: this._status,
      geojson: this._geojson,
      lat: this._lat,
      lng: this._lng,
      metadata: this._metadata,
      organizationId: this._organizationId,
      country: this._country,
      region: this._region,
      version: this._currentVersion,
    };
  }

  static create(params: {
    id: UniqueId;
    key: string;
    type: EntityType;
    name: string;
    description?: string;
    geojson?: string;
    lat?: number;
    lng?: number;
    metadata?: Record<string, unknown>;
    organizationId?: string;
    country?: string;
    region?: string;
    createdBy?: string;
  }): TwinEntity {
    const entity = new TwinEntity({ ...params, status: "active", currentVersion: 1 });
    entity.addDomainEvent(
      TwinEvents.EntityCreated(params.id.value, params.type, params.key, params.createdBy),
    );
    return entity;
  }
}
