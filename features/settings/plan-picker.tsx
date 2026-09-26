"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PLANS, PLAN_IDS, type PlanId } from "@/lib/config/plans";
import { cn } from "@/lib/utils";
import { changePlanAction } from "./actions";

export function PlanPicker({ current, trialing, canManage }: { current: PlanId; trialing: boolean; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<PlanId | null>(null);

  const choose = (plan: PlanId) => {
    setTarget(plan);
    start(async () => {
      const result = await changePlanAction(plan);
      setTarget(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`You're on ${PLANS[plan].name}`);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id];
        const isCurrent = id === current;
        return (
          <div key={id} className={cn("flex flex-col rounded-2xl border bg-card p-5 shadow-soft", isCurrent && "border-primary ring-1 ring-primary")}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{plan.name}</h3>
              {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{trialing ? "Trial" : "Current"}</span>}
            </div>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight">₹{plan.priceMonthly.toLocaleString("en-IN")}</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" /> {f}
                </li>
              ))}
            </ul>
            <Button className="mt-5" variant={isCurrent ? "outline" : "default"} disabled={!canManage || pending || (isCurrent && !trialing)} onClick={() => choose(id)}>
              {pending && target === id && <Loader2 className="size-4 animate-spin" />}
              {isCurrent ? (trialing ? `Keep ${plan.name}` : "Current plan") : id === "free" ? "Downgrade to Free" : `Switch to ${plan.name}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
