import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/lib/env";
import { signLocalMediaPath, type StorageDriver } from "./storage";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".bin": "application/octet-stream",
};

/** Filesystem driver for local development. Files are served by app/media/[...key]/route.ts. */
export class LocalDriver implements StorageDriver {
  // Runtime-configured directory: excluded from build-time file tracing.
  private root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().STORAGE_LOCAL_DIR);

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async get(key: string) {
    try {
      const body = await readFile(this.resolve(key));
      return { body, contentType: CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  publicUrl(key: string) {
    return `/media/${key}`;
  }

  async signedUrl(key: string, expiresInSeconds: number) {
    return signLocalMediaPath(key, expiresInSeconds);
  }
}
