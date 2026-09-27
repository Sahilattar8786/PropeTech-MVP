"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  adminSubscriptionSchema,
  invoiceStatusChangeSchema,
  objectIdSchema,
  reasonSchema,
  recordPaymentSchema,
  type AdminSubscriptionInput,
  type InvoiceStatusChangeInput,
  type ReasonInput,
  type RecordPaymentInput,
} from "@/lib/validation/admin";
import { getPlatformAdminOrThrow } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/lib/errors";
import { setWorkspaceSuspended } from "@/server/services/admin/admin.service";
import { changeInvoiceStatus, recordPayment, updateSubscription } from "@/server/services/admin/billing-admin.service";
import {
  completeDomainRemoval,
  disconnectDomain,
  markDomainConfigured,
  recheckDomainDns,
  rejectDomain,
  reopenDomain,
} from "@/server/services/admin/domain-admin.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

/** Admin changes show up across the console, the broker's dashboard (plan, domain) and their public site. */
async function revalidateTenant(tenantId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  const broker = await getBrokerForTenant(tenantId).catch(() => null);
  if (broker) revalidatePath(`/${broker.slug}`, "layout");
}

export async function updateSubscriptionAction(tenantId: string, input: AdminSubscriptionInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    await updateSubscription(admin, objectIdSchema.parse(tenantId), adminSubscriptionSchema.parse(input));
    await revalidateTenant(tenantId);
  });
}

export async function recordPaymentAction(tenantId: string, input: RecordPaymentInput): Promise<ActionResult<{ number: string; periodEnd: string }>> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    const result = await recordPayment(admin, objectIdSchema.parse(tenantId), recordPaymentSchema.parse(input));
    await revalidateTenant(tenantId);
    return result;
  });
}

export async function changeInvoiceStatusAction(invoiceId: string, input: InvoiceStatusChangeInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    await changeInvoiceStatus(admin, objectIdSchema.parse(invoiceId), invoiceStatusChangeSchema.parse(input));
    revalidatePath("/admin", "layout");
  });
}

export async function setWorkspaceSuspendedAction(tenantId: string, suspended: boolean, input?: ReasonInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    const reason = suspended ? reasonSchema.parse(input).reason : undefined;
    await setWorkspaceSuspended(admin, objectIdSchema.parse(tenantId), suspended, reason);
    await revalidateTenant(tenantId);
  });
}

/* Domain setup requests */

const domainOpSchema = z.enum(["configure", "reopen", "recheck", "complete_removal"]);

export async function domainAction(domainId: string, op: z.infer<typeof domainOpSchema>): Promise<ActionResult<{ verified?: boolean }>> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    const id = objectIdSchema.parse(domainId);
    let result: { tenantId: string; verified?: boolean };
    switch (domainOpSchema.parse(op)) {
      case "configure":
        result = await markDomainConfigured(admin, id);
        break;
      case "reopen":
        result = await reopenDomain(admin, id);
        break;
      case "recheck":
        result = await recheckDomainDns(id);
        break;
      case "complete_removal":
        result = await completeDomainRemoval(admin, id);
        break;
    }
    await revalidateTenant(result.tenantId);
    return { verified: result.verified };
  });
}

export async function rejectDomainAction(domainId: string, input: ReasonInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    const { tenantId } = await rejectDomain(admin, objectIdSchema.parse(domainId), reasonSchema.parse(input).reason);
    await revalidateTenant(tenantId);
  });
}

export async function disconnectDomainAction(domainId: string, input: ReasonInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await getPlatformAdminOrThrow();
    const { tenantId } = await disconnectDomain(admin, objectIdSchema.parse(domainId), reasonSchema.parse(input).reason);
    await revalidateTenant(tenantId);
  });
}
