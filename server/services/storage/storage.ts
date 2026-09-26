import { createHmac, timingSafeEqual } from "node:crypto";
import { env, signingSecret } from "@/server/lib/env";

/**
 * Object storage abstraction. Property images live in our own storage and never
 * depend on WhatsApp media URLs. Keys under `private/` are never served publicly
 * and require a signed URL.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

let driver: Promise<StorageDriver> | undefined;

export function storage(): Promise<StorageDriver> {
  driver ??= (async () => {
    if (env().STORAGE_DRIVER === "s3") {
      const { S3Driver } = await import("./s3.driver");
      return new S3Driver();
    }
    const { LocalDriver } = await import("./local.driver");
    return new LocalDriver();
  })();
  return driver;
}

export const isPrivateKey = (key: string) => key.startsWith("private/");

/* Signed URLs for the local driver (S3 uses native presigned URLs). */

function signature(key: string, expires: number) {
  return createHmac("sha256", signingSecret()).update(`${key}:${expires}`).digest("hex");
}

export function signLocalMediaPath(key: string, expiresInSeconds: number): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `/media/${key}?exp=${expires}&sig=${signature(key, expires)}`;
}

export function verifyLocalMediaSignature(key: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(key, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
