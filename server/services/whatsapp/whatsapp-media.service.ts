import { connectDB } from "@/server/db/connect";
import { AppError } from "@/server/lib/errors";
import { Media, Property, WhatsAppMessage, type IMedia } from "@/server/models";
import type { JobMeta } from "@/server/services/queue/jobs";
import { enqueue } from "@/server/services/queue/queue";
import { processStoredOriginal, storeOriginal } from "@/server/services/media/media.service";
import { storage } from "@/server/services/storage/storage";
import { getWhatsAppProvider, MAX_MEDIA_BYTES } from "./provider";

/**
 * WhatsApp media ID → WhatsApp API → download → validate → store privately
 * → hand off to image processing. Property images never reference WhatsApp URLs.
 */
export async function processWhatsAppMedia(
  { tenantId, messageId, propertyId }: { tenantId: string; messageId: string; propertyId: string },
  meta: JobMeta,
) {
  await connectDB();
  const message = await WhatsAppMessage.findOne({ tenantId, messageId });
  if (!message?.mediaId || message.mediaStatus === "stored") return;

  try {
    const provider = await getWhatsAppProvider();
    const { buffer, mimeType } = await provider.downloadMedia(message.mediaId);
    if (!mimeType.startsWith("image/")) throw new AppError("BAD_REQUEST", "Only images are supported for listings right now");
    if (buffer.byteLength > MAX_MEDIA_BYTES) throw new AppError("BAD_REQUEST", "Media file is too large");

    const position = await WhatsAppMessage.countDocuments({ conversationId: message.conversationId, propertyId, type: "image", timestamp: { $lt: message.timestamp } });
    const media = await storeOriginal(tenantId, buffer, mimeType, { whatsappMediaId: message.mediaId, propertyId: message.propertyId, position });
    message.mediaStatus = "stored";
    message.error = undefined;
    await message.save();
    await enqueue("property-image-processing", { tenantId, mediaId: String(media._id), propertyId });
  } catch (error) {
    const permanent = error instanceof AppError && error.code === "BAD_REQUEST";
    if (permanent || meta.attempt >= meta.maxAttempts) {
      message.mediaStatus = "failed";
      message.error = error instanceof AppError ? error.message : "Media processing failed";
      await message.save();
      return;
    }
    throw error;
  }
}

/** Optimises a stored original and attaches it to the property in the order it was sent. */
export async function processPropertyImage({ tenantId, mediaId, propertyId }: { tenantId: string; mediaId: string; propertyId: string }, meta: JobMeta) {
  await connectDB();
  try {
    const media = await processStoredOriginal(tenantId, mediaId);
    if (media.originalKey && media.originalKey !== media.key) {
      await (await storage()).delete(media.originalKey).catch(() => undefined);
    }
    await attachWhatsAppImages(tenantId, propertyId);
  } catch (error) {
    const permanent = error instanceof AppError && ["BAD_REQUEST", "NOT_FOUND"].includes(error.code);
    if (permanent || meta.attempt >= meta.maxAttempts) {
      await Media.updateOne({ _id: mediaId, tenantId }, { $set: { status: "failed", error: error instanceof Error ? error.message : "Image processing failed" } });
      await WhatsAppMessage.updateOne(
        { tenantId, mediaId: (await Media.findById(mediaId).select("whatsappMediaId").lean<Pick<IMedia, "whatsappMediaId">>())?.whatsappMediaId },
        { $set: { mediaStatus: "failed", error: "Media processing failed" } },
      );
      return;
    }
    throw error;
  }
}

async function attachWhatsAppImages(tenantId: string, propertyId: string) {
  const ready = await Media.find({ tenantId, propertyId, source: "whatsapp", status: "ready" }).sort({ position: 1, createdAt: 1 }).lean<IMedia[]>();
  const property = await Property.findOne({ _id: propertyId, tenantId }).select("images");
  if (!property) return;
  const whatsappUrls = ready.map((m) => m.url);
  const others = property.images.filter((url) => !whatsappUrls.includes(url));
  property.images = [...whatsappUrls, ...others].slice(0, 20);
  await property.save();
}

/** Re-queues failed media downloads for a property ("Media processing failed → Retry"). */
export async function retryFailedMedia(tenantId: string, propertyId: string): Promise<number> {
  await connectDB();
  const failed = await WhatsAppMessage.find({ tenantId, propertyId, type: "image", mediaStatus: "failed" });
  for (const message of failed) {
    message.mediaStatus = "pending";
    message.error = undefined;
    await message.save();
    await Media.deleteMany({ tenantId, whatsappMediaId: message.mediaId, status: "failed" });
    await enqueue("whatsapp-media-processing", { tenantId, messageId: message.messageId, propertyId });
  }
  return failed.length;
}
