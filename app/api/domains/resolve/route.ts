import type { NextRequest } from "next/server";
import { resolveCustomDomain } from "@/server/services/domains/domain.service";

/** Internal lookup used by the proxy to map a verified custom domain to a broker slug. */
export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get("host")?.toLowerCase().replace(/:\d+$/, "");
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return Response.json({ slug: null }, { status: 400 });
  const slug = await resolveCustomDomain(host);
  return Response.json({ slug }, { headers: { "Cache-Control": "public, max-age=60" } });
}
