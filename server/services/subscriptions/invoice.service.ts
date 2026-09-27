import type { PlanId } from "@/lib/config/plans";
import { financialYear, invoiceNumber, type InvoiceProvider, type InvoiceStatus, type PaymentMethod } from "@/lib/domain/billing";
import { Counter, Invoice, type ICounter, type IInvoice } from "@/server/models";

export interface CreateInvoiceInput {
  tenantId: string;
  plan: PlanId;
  amount: number;
  status: InvoiceStatus;
  provider: InvoiceProvider;
  method?: PaymentMethod;
  reference?: string;
  providerPaymentId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  paidAt?: Date;
  notes?: string;
  recordedBy?: string;
}

/** Appends to the payment ledger with the next sequential number for the financial year. */
export async function createInvoice(input: CreateInvoiceInput): Promise<IInvoice> {
  const livemode = input.provider !== "mock";
  const fy = financialYear(input.paidAt ?? new Date());
  const counter = await Counter.findOneAndUpdate({ _id: `invoice:${livemode ? "live" : "test"}:${fy}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }).lean<ICounter>();
  return Invoice.create({ ...input, livemode, currency: "INR", number: invoiceNumber({ livemode, fy, seq: counter!.seq }) });
}
