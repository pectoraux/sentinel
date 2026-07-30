/**
 * Sentinel — Object Storage abstraction
 * =============================================================================
 * Provider-agnostic interface for storing binary objects (evidence media,
 * satellite imagery, documents, model artifacts).
 *
 * Implementations:
 *   - LocalObjectStorage (dev): filesystem
 *   - S3ObjectStorage (prod): AWS S3 / MinIO / any S3-compatible store
 *
 * All uploads record metadata in the StoredObject table (owner, checksum,
 * content-type) so the domain never depends on a specific storage provider.
 * Future milestones (AI, Digital Twin) read/write large artifacts through
 * this same port — e.g. model weights, inference outputs, NDVI rasters.
 * =============================================================================
 */

export interface PutObjectParams {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
  ownerType?: string;
  ownerId?: string;
}

export interface StoredObjectInfo {
  key: string;
  bucket: string;
  provider: string;
  contentType?: string;
  size: number;
  checksum?: string;
  url: string; // signed URL or local file URL
  metadata?: Record<string, string>;
}

export interface ObjectStorage {
  put(params: PutObjectParams): Promise<StoredObjectInfo>;
  get(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSec?: number): Promise<string>;
  delete(key: string): Promise<void>;
  stat(key: string): Promise<StoredObjectInfo | null>;
  isHealthy(): Promise<boolean>;
  readonly provider: string;
  readonly bucket: string;
}
