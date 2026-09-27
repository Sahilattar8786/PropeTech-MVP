import { z } from "zod";
import { PLAN_IDS } from "@/lib/config/plans";
import { PAYMENT_METHODS, toISTDateInput } from "@/lib/domain/billing";

/**
 * Platform-admin forms. As with the property editor, inputs stay strings so one schema drives
 * React Hook Form and the Server Action; services convert them.
 */

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const dateInput = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date");
const today = () => toISTDateInput(new Date());

/** "canceled" is reserved for payment-provider cancellations; admins downgrade by choosing Free. */
export const ADMIN_SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due"] as const;

export const adminSubscriptionSchema = z
  .object({
    plan: z.enum(PLAN_IDS),
    status: z.enum(ADMIN_SUBSCRIPTION_STATUSES),
    trialEndsAt: dateInput,
    currentPeriodEnd: dateInput,
    /** Whole rupees per month; "" = the plan's list price, "0" = complimentary. */
    priceOverride: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{1,7}$/.test(v), "Enter whole rupees, e.g. 1299"),
    adminNotes: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.plan === "free") return;
    if (v.status === "trialing") {
      if (!v.trialEndsAt) ctx.addIssue({ code: "custom", path: ["trialEndsAt"], message: "Pick when the trial ends" });
      else if (v.trialEndsAt < today()) ctx.addIssue({ code: "custom", path: ["trialEndsAt"], message: "The trial end must be today or later" });
    }
  });
export type AdminSubscriptionInput = z.infer<typeof adminSubscriptionSchema>;

export const PAYMENT_MONTH_OPTIONS = ["1", "3", "6", "12"] as const;

export const recordPaymentSchema = z.object({
  plan: z.enum(["pro", "business"]),
  amount: z
    .string()
    .trim()
    .refine((v) => /^\d{1,7}$/.test(v) && Number(v) > 0, "Enter the amount received in whole rupees"),
  months: z.enum(PAYMENT_MONTH_OPTIONS),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120),
  paidAt: z
    .string()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick the payment date")
    .refine((v) => v <= today(), "The payment date can't be in the future"),
  notes: z.string().trim().max(1000),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const invoiceStatusChangeSchema = z.object({
  status: z.enum(["refunded", "void"]),
  note: z.string().trim().max(1000),
});
export type InvoiceStatusChangeInput = z.infer<typeof invoiceStatusChangeSchema>;

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Add a short reason").max(500),
});
export type ReasonInput = z.infer<typeof reasonSchema>;
