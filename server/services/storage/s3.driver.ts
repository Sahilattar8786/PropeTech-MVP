import { AwsClient } from "aws4fetch";
import { env } from "@/server/lib/env";
import type { StorageDriver } from "./storage";

/** Surfaces the provider's <Code>/<Message> (e.g. SignatureDoesNotMatch, AccessDenied) without echoing credentials. */
async function s3Error(action: string, res: Response): Promise<Error> {
  const body = await res.text().catch(() => "");
  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
  const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
  const detail = [code, message].filter(Boolean).join(": ");
  return new Error(`S3 ${action} failed (${res.status})${detail ? ` — ${detail}` : ""}`);
}

/** S3-compatible driver (AWS S3, Cloudflare R2, MinIO) using SigV4-signed fetch requests. */
export class S3Driver implements StorageDriver {
  private client: AwsClient;
  private endpoint: string;
  private bucket: string;
  private publicBase: string;

  constructor() {
    const e = env();
    if (!e.S3_ENDPOINT || !e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY || !e.S3_PUBLIC_URL) {
      throw new Error("S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL");
    }
    this.client = new AwsClient({
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      region: e.S3_REGION,
      service: "s3",
    });
    this.endpoint = e.S3_ENDPOINT.replace(/\/+$/, "");
    this.bucket = e.S3_BUCKET;
    this.publicBase = e.S3_PUBLIC_URL.replace(/\/+$/, "");
  }

  private objectUrl(key: string) {
    return `${this.endpoint}/${this.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async put(key: string, body: Buffer, contentType: string) {
    const bytes = new Uint8Array(body);
    const headers = { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" };
    // Sign, then send the bytes directly. Passing aws4fetch's signed Request object to
    // Next.js's patched fetch streams the body without Content-Length, which R2 rejects (411).
    const signed = await this.client.sign(this.objectUrl(key), { method: "PUT", body: bytes, headers });
    const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: bytes, cache: "no-store" });
    if (!res.ok) throw await s3Error("upload", res);
  }

  async get(key: string) {
    const res = await this.client.fetch(this.objectUrl(key));
    if (res.status === 404) return null;
    if (!res.ok) throw await s3Error("download", res);
    return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }

  async delete(key: string) {
    const res = await this.client.fetch(this.objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw await s3Error("delete", res);
  }

  publicUrl(key: string) {
    return `${this.publicBase}/${key}`;
  }

  async signedUrl(key: string, expiresInSeconds: number) {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await this.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  }
}
