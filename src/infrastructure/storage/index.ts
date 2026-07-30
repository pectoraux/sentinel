/**
 * Sentinel — Object Storage barrel + factory.
 * =============================================================================
 * The factory lazily imports the S3 implementation ONLY when STORAGE_PROVIDER
 * is s3/minio, so the dev sandbox (local storage) never pulls the optional
 * @aws-sdk/client-s3 dependency into the bundle.
 * =============================================================================
 */

export type {
  ObjectStorage,
  PutObjectParams,
  StoredObjectInfo,
} from "./object-storage";
export { LocalObjectStorage } from "./local-storage";

import { config } from "@/config";
import { LocalObjectStorage } from "./local-storage";
import type { ObjectStorage } from "./object-storage";

let instance: ObjectStorage | null = null;

export async function getObjectStorage(): Promise<ObjectStorage> {
  if (instance) return instance;
  switch (config.STORAGE_PROVIDER) {
    case "s3":
    case "minio": {
      // Lazy import — only resolved when an S3-compatible provider is active.
      // In dev (local storage) this module is never loaded, so the optional
      // @aws-sdk/client-s3 dependency is not required.
      const { S3ObjectStorage } = await import("./s3-storage");
      instance = new S3ObjectStorage();
      break;
    }
    case "local":
    default:
      instance = new LocalObjectStorage();
      break;
  }
  return instance;
}

export function setObjectStorage(storage: ObjectStorage): void {
  instance = storage;
}
