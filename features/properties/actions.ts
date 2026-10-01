"use server";

import { revalidatePath } from "next/cache";
import { PROPERTY_STATUSES, type PropertyDTO, type PropertyStatus } from "@/lib/domain/property";
import { reelDraftSchema, type ReelDraft } from "@/lib/reels/reel-spec";
import { createFromTextSchema, propertyFormSchema, type CreateFromTextInput, type PropertyFormValues } from "@/lib/validation/property";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { AppError, runAction, type ActionResult } from "@/server/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/server/lib/rate-limit";
import {
  changePropertyStatus,
  createDraftFromText,
  createManualDraft,
  deleteProperty,
  publishProperty,
  retryAIProcessing,
  saveReelDraft,
  updateProperty,
} from "@/server/services/properties/property.service";
import { retryFailedMedia } from "@/server/services/whatsapp/whatsapp-media.service";

/** Public broker pages are ISR-cached; refresh the whole broker site after changes. */
function revalidateBrokerSite(brokerSlug?: string) {
  if (brokerSlug) revalidatePath(`/${brokerSlug}`, "layout");
}

export async function createFromTextAction(input: CreateFromTextInput): Promise<ActionResult<{ id: string; failed: boolean }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    enforceRateLimit(`ai:${ctx.tenantId}`, RATE_LIMITS.ai, "You're creating properties very quickly — please wait a moment.");
    const values = createFromTextSchema.parse(input);
    const property = await createDraftFromText(ctx, values);
    revalidatePath("/dashboard", "layout");
    return { id: property.id, failed: property.ingestion?.stage === "failed" };
  });
}

export async function createManualDraftAction(): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const property = await createManualDraft(ctx);
    return { id: property.id };
  });
}

export async function savePropertyAction(id: string, input: PropertyFormValues, opts: { markReviewed?: boolean } = {}): Promise<ActionResult<PropertyDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const values = propertyFormSchema.parse(input);
    const property = await updateProperty(ctx, id, values, opts);
    revalidatePath(`/dashboard/properties/${id}`);
    if (property.status !== "draft") revalidatePath("/[brokerSlug]", "layout");
    return property;
  });
}

export async function publishPropertyAction(id: string, input: PropertyFormValues): Promise<ActionResult<{ publicUrl: string }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const values = propertyFormSchema.parse(input);
    const { publicUrl, brokerSlug } = await publishProperty(ctx, id, values);
    revalidateBrokerSite(brokerSlug);
    revalidatePath("/dashboard", "layout");
    return { publicUrl };
  });
}

export async function changeStatusAction(id: string, status: PropertyStatus): Promise<ActionResult<PropertyDTO>> {
  return runAction(async () => {
    if (!PROPERTY_STATUSES.includes(status)) throw new AppError("BAD_REQUEST", "Unknown status");
    const ctx = await getTenantContextOrThrow();
    const { property, brokerSlug } = await changePropertyStatus(ctx, id, status);
    revalidateBrokerSite(brokerSlug);
    revalidatePath(`/dashboard/properties/${id}`);
    return property;
  });
}

export async function deletePropertyAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const { brokerSlug } = await deleteProperty(ctx, id);
    revalidateBrokerSite(brokerSlug);
    revalidatePath("/dashboard", "layout");
  });
}

export async function retryAIAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    enforceRateLimit(`ai:${ctx.tenantId}`, RATE_LIMITS.ai);
    await retryAIProcessing(ctx, id);
    revalidatePath(`/dashboard/properties/${id}/review`);
  });
}

export async function retryMediaAction(id: string): Promise<ActionResult<{ retried: number }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const retried = await retryFailedMedia(ctx.tenantId, id);
    return { retried };
  });
}

export async function saveReelDraftAction(id: string, input: ReelDraft): Promise<ActionResult<{ savedAt: string }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    await saveReelDraft(ctx, id, reelDraftSchema.parse(input));
    return { savedAt: new Date().toISOString() };
  });
}
