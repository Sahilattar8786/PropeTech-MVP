"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { collectionFormSchema, type CollectionDTO, type CollectionFormValues } from "@/lib/validation/collection";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/lib/errors";
import {
  addPropertiesToCollection,
  createCollection,
  deleteCollection,
  getBrokerSlugForTenant,
  removePropertyFromCollection,
  reorderCollection,
  updateCollection,
} from "@/server/services/collections/collection.service";

const ids = z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(500);

async function refresh(tenantId: string, collectionId?: string) {
  const broker = await getBrokerSlugForTenant(tenantId);
  if (broker) revalidatePath(`/${broker.slug}`, "layout");
  revalidatePath("/dashboard/collections");
  if (collectionId) revalidatePath(`/dashboard/collections/${collectionId}`);
}

export async function createCollectionAction(input: CollectionFormValues): Promise<ActionResult<CollectionDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const collection = await createCollection(ctx, collectionFormSchema.parse(input));
    await refresh(ctx.tenantId);
    return collection;
  });
}

export async function updateCollectionAction(id: string, input: CollectionFormValues): Promise<ActionResult<CollectionDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const collection = await updateCollection(ctx, id, collectionFormSchema.parse(input));
    await refresh(ctx.tenantId, id);
    return collection;
  });
}

export async function deleteCollectionAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    await deleteCollection(ctx, id);
    await refresh(ctx.tenantId);
  });
}

export async function addPropertiesAction(id: string, propertyIds: string[]): Promise<ActionResult<CollectionDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const collection = await addPropertiesToCollection(ctx, id, ids.parse(propertyIds));
    await refresh(ctx.tenantId, id);
    return collection;
  });
}

export async function removePropertyAction(id: string, propertyId: string): Promise<ActionResult<CollectionDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const collection = await removePropertyFromCollection(ctx, id, propertyId);
    await refresh(ctx.tenantId, id);
    return collection;
  });
}

export async function reorderCollectionAction(id: string, orderedIds: string[]): Promise<ActionResult<CollectionDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const collection = await reorderCollection(ctx, id, ids.parse(orderedIds));
    await refresh(ctx.tenantId, id);
    return collection;
  });
}
