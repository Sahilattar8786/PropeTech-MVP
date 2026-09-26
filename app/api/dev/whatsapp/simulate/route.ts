import type { NextRequest } from "next/server";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { AppError, errorResponse } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { MAX_IMAGE_BYTES } from "@/server/services/media/media.service";
import { simulateInboundMessage } from "@/server/services/whatsapp/sandbox-simulator.service";

/** Sandbox-only: simulate a broker sending a WhatsApp message (text + photos). */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContextOrThrow();
    enforceRateLimit(`simulate:${ctx.tenantId}`, { limit: 30, windowMs: 10 * 60_000 });
    const form = await request.formData();
    const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
    if (files.some((f) => f.size > MAX_IMAGE_BYTES)) throw new AppError("BAD_REQUEST", "Images must be 10 MB or smaller");
    const images = await Promise.all(files.map(async (f) => ({ buffer: Buffer.from(await f.arrayBuffer()), mimeType: f.type || "image/jpeg" })));
    const result = await simulateInboundMessage(ctx, { from: String(form.get("from") ?? ""), text: String(form.get("text") ?? ""), images });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
