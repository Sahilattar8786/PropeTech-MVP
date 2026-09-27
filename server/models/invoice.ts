import { Schema } from "mongoose";
import { PLAN_IDS, type PlanId } from "@/lib/config/plans";
import { INVOICE_PROVIDERS, INVOICE_STATUSES, PAYMENT_METHODS, type InvoiceProvider, type InvoiceStatus, type PaymentMethod } from "@/lib/domain/billing";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

/* ─────────────────────────── Invoice ─────────────────────────── */

/** Payment ledger — the source of truth for collected revenue. Amounts are whole rupees. */
export interface IInvoice {
  _id: ObjectId;
  tenantId: ObjectId;
  /** Sequential per financial year, e.g. PF/2026-27/0042 (TEST/… in test mode). */
  number: string;
  plan: PlanId;
  amount: number;
  currency: "INR";
  status: InvoiceStatus;
  provider: InvoiceProvider;
  /** false for test-mode (mock) payments, which never count as revenue. */
  livemode: boolean;
  method?: PaymentMethod;
  /** UPI/UTR/cheque number or gateway payment ID. */
  reference?: string;
  /** Unique gateway payment ID, so provider webhooks can be replayed safely. */
  providerPaymentId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  paidAt?: Date;
  refundedAt?: Date;
  notes?: string;
  recordedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    number: { type: String, required: true, unique: true },
    plan: { type: String, enum: PLAN_IDS, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    status: { type: String, enum: INVOICE_STATUSES, required: true },
    provider: { type: String, enum: INVOICE_PROVIDERS, required: true },
    livemode: { type: Boolean, required: true },
    method: { type: String, enum: PAYMENT_METHODS },
    reference: { type: String, trim: true, maxlength: 120 },
    providerPaymentId: { type: String, index: { unique: true, sparse: true } },
    periodStart: Date,
    periodEnd: Date,
    paidAt: Date,
    refundedAt: Date,
    notes: { type: String, trim: true, maxlength: 1000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
tenantScoped(invoiceSchema);
invoiceSchema.index({ tenantId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, livemode: 1, paidAt: -1 });
export const Invoice = defineModel<IInvoice>("Invoice", invoiceSchema);

/* ─────────────────────────── Counter ─────────────────────────── */

/** Platform-wide atomic sequences (not tenant data), e.g. invoice numbers per financial year. */
export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = defineModel<ICounter>("Counter", counterSchema);
