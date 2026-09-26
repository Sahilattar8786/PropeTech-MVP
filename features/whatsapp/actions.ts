"use server";

import { revalidatePath } from "next/cache";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/lib/errors";
import { disconnectSenderNumber } from "@/server/services/whatsapp/connection.service";

export async function disconnectNumberAction(number: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    await disconnectSenderNumber(ctx, number);
    revalidatePath("/dashboard/settings/whatsapp");
  });
}
