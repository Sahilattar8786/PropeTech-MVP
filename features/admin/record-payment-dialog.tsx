"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { PLANS } from "@/lib/config/plans";
import { monthlyPrice, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, paymentPeriod, startOfISTDay, toISTDateInput } from "@/lib/domain/billing";
import { formatDateIST } from "@/lib/format";
import { PAYMENT_MONTH_OPTIONS, recordPaymentSchema, type RecordPaymentInput } from "@/lib/validation/admin";
import { recordPaymentAction } from "./actions";
import type { SubscriptionSnapshot } from "./subscription-dialog";

const PAID_PLANS = ["pro", "business"] as const;

/** Records a payment received outside the gateway (UPI, bank transfer…) and activates the plan for the period it covers. */
export function RecordPaymentDialog({ tenantId, workspace, current, trigger }: { tenantId: string; workspace: string; current: SubscriptionSnapshot | null; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const defaults = (): RecordPaymentInput => {
    const plan = current?.plan === "business" ? "business" : "pro";
    return {
      plan,
      months: "1",
      amount: String(priceFor(plan)),
      method: "upi",
      reference: "",
      paidAt: toISTDateInput(new Date()),
      notes: "",
    };
  };
  // The negotiated price applies when renewing the plan it was agreed for.
  const priceFor = (plan: RecordPaymentInput["plan"]) => monthlyPrice({ plan, priceOverride: current?.plan === plan ? current.priceOverride : undefined });

  const form = useForm<RecordPaymentInput>({ resolver: zodResolver(recordPaymentSchema), defaultValues: defaults() });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const [plan, months, paidAt] = useWatch({ control: form.control, name: ["plan", "months", "paidAt"] });

  // Keep the suggested amount in step with plan × months until the admin types their own.
  useEffect(() => {
    if (!dirtyFields.amount) form.setValue("amount", String(priceFor(plan) * Number(months)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, months]);

  const period = /^\d{4}-\d{2}-\d{2}$/.test(paidAt)
    ? paymentPeriod(current ? { ...current, currentPeriodEnd: current.currentPeriodEnd ? new Date(current.currentPeriodEnd) : null } : null, {
        plan,
        months: Number(months),
        paidAt: startOfISTDay(paidAt),
      })
    : null;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await recordPaymentAction(tenantId, values);
    if (!result.ok) {
      setServerError(result.error);
      Object.entries(result.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof RecordPaymentInput, { message }));
      return;
    }
    setOpen(false);
    toast.success(`Payment ${result.data.number} recorded — ${PLANS[values.plan].name} renews ${formatDateIST(result.data.periodEnd)}`);
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults());
        setServerError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>{workspace} · for money already received by UPI, bank transfer, cash or cheque.</DialogDescription>
          </DialogHeader>
          {serverError && <FormAlert>{serverError}</FormAlert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pay-plan" label="Plan" error={errors.plan?.message}>
              <Controller
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pay-plan" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAID_PLANS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {PLANS[id].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="pay-months" label="Covers" error={errors.months?.message}>
              <Controller
                control={form.control}
                name="months"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pay-months" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MONTH_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m === "12" ? "12 months (1 year)" : `${m} month${m === "1" ? "" : "s"}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="pay-amount" label="Amount received (₹)" error={errors.amount?.message}>
              <Input id="pay-amount" inputMode="numeric" className="h-10 tabular-nums" {...form.register("amount")} />
            </FormField>
            <FormField id="pay-date" label="Payment date" error={errors.paidAt?.message}>
              <Input id="pay-date" type="date" max={toISTDateInput(new Date())} className="h-10" {...form.register("paidAt")} />
            </FormField>
            <FormField id="pay-method" label="Method" error={errors.method?.message}>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pay-method" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="pay-ref" label="Reference (optional)" error={errors.reference?.message}>
              <Input id="pay-ref" placeholder="UTR / transaction ID" className="h-10 font-mono" {...form.register("reference")} />
            </FormField>
          </div>

          <FormField id="pay-notes" label="Notes (optional)" error={errors.notes?.message}>
            <Textarea id="pay-notes" rows={2} {...form.register("notes")} />
          </FormField>

          {period && (
            <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-foreground">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              <span>
                {PLANS[plan].name} becomes active, next renewal <strong className="font-semibold">{formatDateIST(period.end)}</strong>
                {period.start.getTime() !== startOfISTDay(paidAt).getTime() && <> — extends the current period, which ends {formatDateIST(period.start)}</>}.
              </span>
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />} Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
