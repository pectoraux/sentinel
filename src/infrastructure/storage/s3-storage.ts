/**
 * S3ObjectStorage — production S3-compatible implementation.
 *
 * Uses the AWS SDK S3 client. Compatible with AWS S3, MinIO, Cloudflare R2,
 * DigitalOcean Spaces, and any S3-compatible provider via endpoint override.
 *
 * The AWS SDK is loaded via a non-statically-analyzable dynamic import
 * (module path stored in a variable) so the dev sandbox — which uses local
 * storage — does not require @aws-sdk/client-s3 to be installed. In
 * production where STORAGE_PROVIDER=s3, the SDK must be installed.
 */

import { createHash } from "node:crypto";
import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import type {
  ObjectStorage,
  PutObjectParams,
  StoredObjectInfo,
} from "./object-storage";

// Variable indirection defeats static bundler analysis — the SDK is only
// resolved at runtime when this provider is actually used.
const SDK_S3 = "@aws-sdk/client-s3";
const SDK_PRESIGN = "@aws-sdk/s3-request-presigner";

 
type AnyS3Client = any;

export class S3ObjectStorage implements ObjectStorage {
  readonly provider: string;
  readonly bucket: string;
  private client: AnyS3Client | null = null;

  constructor(bucket?: string) {
    this.provider = config.STORAGE_PROVIDER === "minio" ? "minio" : "s3";
    this.bucket = bucket ?? config.STORAGE_S3_BUCKET;
  }

  private async getClient(): Promise<AnyS3Client> {
    if (this.client) return this.client;
    const mod = await import(SDK_S3).catch(() => null);
    if (!mod?.S3Client) {
      throw new Error(
        "@aws-sdk/client-s3 is not installed. Install it to use S3 storage: bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner",
      );
    }
    this.client = new mod.S3Client({
      region: config.STORAGE_S3_REGION,
      endpoint: config.STORAGE_S3_ENDPOINT,
      forcePathStyle: config.STORAGE_S3_FORCE_PATH_STYLE,
      credentials: config.STORAGE_S3_ACCESS_KEY_ID
        ? {
            accessKeyId: config.STORAGE_S3_ACCESS_KEY_ID,
            secretAccessKey: config.STORAGE_S3_SECRET_ACCESS_KEY ?? "",
          }
        : undefined,
    });
    return this.client;
  }

  private async loadCommand(name: string): Promise<unknown> {
    const mod = await import(SDK_S3).catch(() => null);
    return mod?.[name];
  }

  async put(params: PutObjectParams): Promise<StoredObjectInfo> {
    const client = await this.getClient();
    const PutObjectCommand = (await this.loadCommand("PutObjectCommand")) as
      | (new (args: unknown) => unknown)
      | undefined;
    if (!PutObjectCommand) throw new Error("PutObjectCommand unavailable");
    const buf = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body);
    const checksum = createHash("sha256").update(buf).digest("hex");
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: buf,
        ContentType: params.contentType,
        Metadata: params.metadata,
      }),
    );
    logger.debug("storage.s3.put", { key: params.key, size: buf.length, bucket: this.bucket });
    return {
      key: params.key,
      bucket: this.bucket,
      provider: this.provider,
      contentType: params.contentType,
      size: buf.length,
      checksum,
      url: `/${this.bucket}/${params.key}`,
      metadata: params.metadata,
    };
  }

  async get(key: string): Promise<Buffer> {
    const client = await this.getClient();
    const GetObjectCommand = (await this.loadCommand("GetObjectCommand")) as
      | (new (args: unknown) => unknown)
      | undefined;
    const out = await client.send(new GetObjectCommand!({ Bucket: this.bucket, Key: key }));
    const bytes = await (out.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  async getSignedUrl(key: string, expiresInSec = 900): Promise<string> {
    const client = await this.getClient();
    const presignMod = await import(SDK_PRESIGN).catch(() => null);
    const GetObjectCommand = (await this.loadCommand("GetObjectCommand")) as
      | (new (args: unknown) => unknown)
      | undefined;
    return presignMod.getSignedUrl(
      client,
      new GetObjectCommand!({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    const DeleteObjectCommand = (await this.loadCommand("DeleteObjectCommand")) as
      | (new (args: unknown) => unknown)
      | undefined;
    await client.send(new DeleteObjectCommand!({ Bucket: this.bucket, Key: key }));
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    const client = await this.getClient();
    const HeadObjectCommand = (await this.loadCommand("HeadObjectCommand")) as
      | (new (args: unknown) => unknown)
      | undefined;
    try {
      const out = await client.send(new HeadObjectCommand!({ Bucket: this.bucket, Key: key }));
      return {
        key,
        bucket: this.bucket,
        provider: this.provider,
        contentType: out.ContentType,
        size: out.ContentLength ?? 0,
        url: `/${this.bucket}/${key}`,
        metadata: out.Metadata,
      };
    } catch {
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const HeadBucketCommand = (await this.loadCommand("HeadBucketCommand")) as
        | (new (args: unknown) => unknown)
        | undefined;
      await client.send(new HeadBucketCommand!({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
