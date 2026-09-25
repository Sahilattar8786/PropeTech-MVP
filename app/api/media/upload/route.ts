import type { NextRequest } from "next/server";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AppError, errorResponse } from "@/server/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/server/lib/rate-limit";
import { MAX_IMAGE_BYTES, storeUploadedImage } from "@/server/services/media/media.service";

/** Authenticated image upload: validate → optimise (WebP) → object storage. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContextOrThrow();
    assertCan(ctx, "property:write");
    enforceRateLimit(`upload:${ctx.userId}`, RATE_LIMITS.upload, "Too many uploads. Please wait a few minutes.");

    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_IMAGE_BYTES + 64 * 1024) throw new AppError("BAD_REQUEST", "Images must be 10 MB or smaller");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "No file received");
    if (file.size > MAX_IMAGE_BYTES) throw new AppError("BAD_REQUEST", "Images must be 10 MB or smaller");

    await connectDB();
    const image = await storeUploadedImage(ctx.tenantId, Buffer.from(await file.arrayBuffer()));
    return Response.json(image, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
