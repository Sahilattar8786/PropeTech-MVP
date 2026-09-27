"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/config/plans";
import { SUBSCRIPTION_STATUS_LABELS, toISTDateInput, type SubscriptionStatus } from "@/lib/domain/billing";
import { ADMIN_SUBSCRIPTION_STATUSES, adminSubscriptionSchema, type AdminSubscriptionInput } from "@/lib/validation/admin";
import { updateSubscriptionAction } from "./actions";

export interface SubscriptionSnapshot {
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  priceOverride?: number;
  adminNotes?: string;
}

/** Direct edit of a workspace's plan, status, dates and negotiated price. */
export function SubscriptionDialog({ tenantId, workspace, current, trigger }: { tenantId: string; workspace: string; current: SubscriptionSnapshot | null; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const defaults: AdminSubscriptionInput = {
    plan: current?.plan ?? "free",
    status: current && current.status !== "canceled" ? current.status : "active",
    trialEndsAt: toISTDateInput(current?.trialEndsAt),
    currentPeriodEnd: toISTDateInput(current?.currentPeriodEnd),
    priceOverride: current?.priceOverride === undefined ? "" : String(current.priceOverride),
    adminNotes: current?.adminNotes ?? "",
  };
  const form = useForm<AdminSubscriptionInput>({ resolver: zodResolver(adminSubscriptionSchema), defaultValues: defaults });
  const { errors, isSubmitting } = form.formState;
  const [plan, status] = useWatch({ control: form.control, name: ["plan", "status"] });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await updateSubscriptionAction(tenantId, values);
    if (!result.ok) {
      setServerError(result.error);
      Object.entries(result.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof AdminSubscriptionInput, { message }));
      return;
    }
    setOpen(false);
    toast.success("Subscription updated");
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults);
        setServerError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Manage subscription</DialogTitle>
            <DialogDescription>{workspace} · changes apply immediately and don&apos;t charge the broker.</DialogDescription>
          </DialogHeader>
          {serverError && <FormAlert>{serverError}</FormAlert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="sub-plan" label="Plan" error={errors.plan?.message}>
              <Controller
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="sub-plan" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_IDS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {PLANS[id].name} · ₹{PLANS[id].priceMonthly.toLocaleString("en-IN")}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {plan !== "free" && (
              <FormField id="sub-status" label="Status" error={errors.status?.message}>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="sub-status" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_SUBSCRIPTION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SUBSCRIPTION_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}
          </div>

          {plan === "free" ? (
            <p className="rounded-lg bg-surface px-3 py-2.5 text-sm text-muted-foreground">Moving to Free clears the trial, paid period and custom price. Existing data is kept; plan limits apply to new items.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {status === "trialing" ? (
                <FormField id="sub-trial" label="Trial ends" error={errors.trialEndsAt?.message}>
                  <Input id="sub-trial" type="date" className="h-10" {...form.register("trialEndsAt")} />
                </FormField>
              ) : (
                <FormField id="sub-period" label="Renews on" error={errors.currentPeriodEnd?.message} description="Next payment due. Empty = no renewal date.">
                  <Input id="sub-period" type="date" className="h-10" {...form.register("currentPeriodEnd")} />
                </FormField>
              )}
              <FormField id="sub-price" label="Custom price (₹/month)" error={errors.priceOverride?.message} description={`Empty = list price (₹${PLANS[plan].priceMonthly.toLocaleString("en-IN")}). 0 = complimentary.`}>
                <Input id="sub-price" inputMode="numeric" placeholder={String(PLANS[plan].priceMonthly)} className="h-10" {...form.register("priceOverride")} />
              </FormField>
            </div>
          )}

          <FormField id="sub-notes" label="Internal notes" error={errors.adminNotes?.message} description="Only visible to PropFlow admins.">
            <Textarea id="sub-notes" rows={3} placeholder="e.g. Annual deal agreed on call, invoiced quarterly" {...form.register("adminNotes")} />
          </FormField>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
