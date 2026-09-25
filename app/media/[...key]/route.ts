import type { NextRequest } from "next/server";
import { env } from "@/server/lib/env";
import { isPrivateKey, storage, verifyLocalMediaSignature } from "@/server/services/storage/storage";

/**
 * Serves objects from the local storage driver (development / single-node).
 * Private keys require a valid signed URL. With S3, images are served by the bucket/CDN.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/media/[...key]">) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Not found", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (key.includes("..")) return new Response("Bad request", { status: 400 });

  if (isPrivateKey(key)) {
    const { searchParams } = request.nextUrl;
    if (!verifyLocalMediaSignature(key, searchParams.get("exp"), searchParams.get("sig"))) {
      return new Response("Forbidden", { status: 403 });
    }
  }
  const file = await (await storage()).get(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": isPrivateKey(key) ? "private, no-store" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
