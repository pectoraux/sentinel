import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import type { ObjectStorage, PutObjectParams, StoredObjectInfo } from "./object-storage";

export class LocalObjectStorage implements ObjectStorage {
  readonly provider = "local";
  readonly bucket: string;
  private readonly baseDir: string;
  constructor(bucket = "default", baseDir?: string) {
    this.bucket = bucket;
    this.baseDir = resolve(baseDir ?? config.STORAGE_LOCAL_BASE_DIR, bucket);
  }
  async put(params: PutObjectParams): Promise<StoredObjectInfo> {
    const { key, body, contentType, metadata } = params;
    const fullPath = join(this.baseDir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    await writeFile(fullPath, buf);
    const checksum = createHash("sha256").update(buf).digest("hex");
    return { key, bucket: this.bucket, provider: this.provider, contentType, size: buf.length, checksum, url: `/storage/${this.bucket}/${key}`, metadata };
  }
  async get(key: string): Promise<Buffer> { return readFile(join(this.baseDir, key)); }
  async getSignedUrl(key: string): Promise<string> { return `/storage/${this.bucket}/${key}`; }
  async delete(key: string): Promise<void> { try { await unlink(join(this.baseDir, key)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } }
  async stat(key: string): Promise<StoredObjectInfo | null> {
    try { const s = await stat(join(this.baseDir, key)); return { key, bucket: this.bucket, provider: this.provider, size: s.size, url: `/storage/${this.bucket}/${key}` }; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
  }
  async isHealthy(): Promise<boolean> { try { await mkdir(this.baseDir, { recursive: true }); return true; } catch { return false; } }
}
