"use server";

import { z } from "zod";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/lib/errors";
import { LEAD_STATUSES } from "@/server/models/lead";
import { updateLeadStatus } from "@/server/services/leads/lead.service";

const schema = z.object({ leadId: z.string().regex(/^[a-f0-9]{24}$/i), status: z.enum(LEAD_STATUSES) });

export async function updateLeadStatusAction(leadId: string, status: (typeof LEAD_STATUSES)[number]): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const input = schema.parse({ leadId, status });
    await updateLeadStatus(ctx, input.leadId, input.status);
  });
}
