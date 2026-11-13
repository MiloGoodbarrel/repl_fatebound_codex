import { Storage, type Bucket } from "@google-cloud/storage";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

export interface ModuleObjects {
  check?(): Promise<void>;
  upload(key: string, filename: string, signal: AbortSignal): Promise<void>;
  read(key: string, start: number, end: number): Promise<Readable>;
  delete(key: string): Promise<void>;
}

// Same external-account credentials as the official @replit/object-storage SDK.
// Use the supported GCS client for true upstream ranges and cancellable streams;
// never expose a bucket, object URL, or signed URL to the browser.
export class PrivateModuleObjects implements ModuleObjects {
  async check() { await this.bucket(); }
  private async bucket(): Promise<Bucket> {
    const response = await fetch("http://127.0.0.1:1106/object-storage/default-bucket", {
      signal: AbortSignal.timeout(10_000),
    });
    const value = await response.json() as { bucketId?: string };
    if (!response.ok || !value.bucketId) throw new Error("App Storage needs a default private bucket.");
    const storage = new Storage({
      projectId: "",
      credentials: {
        type: "external_account", audience: "replit", subject_token_type: "access_token",
        token_url: "http://127.0.0.1:1106/token",
        credential_source: {
          url: "http://127.0.0.1:1106/credential",
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
    });
    return storage.bucket(value.bucketId);
  }
  async upload(key: string, filename: string, signal: AbortSignal) {
    const bucket = await this.bucket();
    await pipeline(createReadStream(filename), bucket.file(key).createWriteStream({
      resumable: false, gzip: false, validation: "crc32c",
      metadata: { contentType: "application/pdf", cacheControl: "private, no-store" },
      preconditionOpts: { ifGenerationMatch: 0 },
    }), { signal });
  }
  async read(key: string, start: number, end: number) {
    return (await this.bucket()).file(key).createReadStream({ start, end, decompress: false });
  }
  async delete(key: string) {
    await (await this.bucket()).file(key).delete({ ignoreNotFound: true });
  }
}
