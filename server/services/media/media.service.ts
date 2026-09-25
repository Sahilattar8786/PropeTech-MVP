import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { AppError } from "@/server/lib/errors";
import { Media, type IMedia } from "@/server/models";
import { storage } from "@/server/services/storage/storage";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_PROPERTY = 20;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);
const MAX_DIMENSION = 2000;

export interface StoredImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

/** Validates by decoding the image (not by trusting the declared MIME type). */
export async function validateImage(buffer: Buffer): Promise<Metadata> {
  if (buffer.byteLength === 0) throw new AppError("BAD_REQUEST", "The file is empty");
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new AppError("BAD_REQUEST", "Images must be 10 MB or smaller");
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new AppError("BAD_REQUEST", "That file isn't a supported image");
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new AppError("BAD_REQUEST", "Upload JPG, PNG or WebP images");
  }
  if ((metadata.width ?? 0) < 200 || (metadata.height ?? 0) < 200) {
    throw new AppError("BAD_REQUEST", "Images must be at least 200×200 pixels");
  }
  return metadata;
}

/** Normalises orientation, strips metadata (incl. GPS), resizes and converts to WebP. */
export async function optimizeImage(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

function imageKey(tenantId: string, ext = "webp") {
  return `tenants/${tenantId}/images/${randomUUID()}.${ext}`;
}

/** Full pipeline for dashboard uploads: validate → optimise → store → record. */
export async function storeUploadedImage(tenantId: string, buffer: Buffer, propertyId?: string): Promise<StoredImage> {
  await validateImage(buffer);
  const optimized = await optimizeImage(buffer);
  const key = imageKey(tenantId);
  const store = await storage();
  await store.put(key, optimized.buffer, "image/webp");
  const media = await Media.create({
    tenantId,
    key,
    url: store.publicUrl(key),
    mimeType: "image/webp",
    size: optimized.buffer.byteLength,
    width: optimized.width,
    height: optimized.height,
    source: "upload",
    propertyId,
    status: "ready",
  });
  return { id: String(media._id), url: media.url, width: media.width, height: media.height };
}

/** Stores an untrusted original (e.g. WhatsApp download) privately for later processing. */
export async function storeOriginal(tenantId: string, buffer: Buffer, mimeType: string, meta: Partial<IMedia>) {
  const key = `private/tenants/${tenantId}/originals/${randomUUID()}.bin`;
  const store = await storage();
  await store.put(key, buffer, mimeType);
  return Media.create({
    tenantId,
    key,
    originalKey: key,
    url: "",
    mimeType,
    size: buffer.byteLength,
    status: "pending",
    source: "whatsapp",
    ...meta,
  });
}

/** Turns a stored original into an optimised public image. */
export async function processStoredOriginal(tenantId: string, mediaId: string): Promise<IMedia> {
  const media = await Media.findOne({ _id: mediaId, tenantId });
  if (!media) throw new AppError("NOT_FOUND", "Media not found");
  if (media.status === "ready") return media;
  const store = await storage();
  const original = await store.get(media.originalKey ?? media.key);
  if (!original) throw new Error("Original media is missing from storage");
  try {
    await validateImage(original.body);
  } catch (error) {
    media.status = "failed";
    media.error = error instanceof Error ? error.message : "Invalid image";
    await media.save();
    throw new AppError("BAD_REQUEST", media.error);
  }
  const optimized = await optimizeImage(original.body);
  const key = imageKey(tenantId);
  await store.put(key, optimized.buffer, "image/webp");
  media.key = key;
  media.url = store.publicUrl(key);
  media.mimeType = "image/webp";
  media.size = optimized.buffer.byteLength;
  media.width = optimized.width;
  media.height = optimized.height;
  media.status = "ready";
  media.error = undefined;
  await media.save();
  return media;
}
