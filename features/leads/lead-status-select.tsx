"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STATUS_LABELS, type LeadStatusValue } from "@/lib/domain/lead";
import { cn } from "@/lib/utils";
import { updateLeadStatusAction } from "./actions";

type LeadStatus = LeadStatusValue;

const TONE: Record<LeadStatus, string> = {
  new: "bg-sky-50 text-sky-800 border-sky-200",
  contacted: "bg-amber-50 text-amber-800 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(next) => {
        const previous = value;
        setValue(next as LeadStatus);
        start(async () => {
          const result = await updateLeadStatusAction(leadId, next as LeadStatus);
          if (!result.ok) {
            setValue(previous);
            toast.error(result.error);
          }
        });
      }}
    >
      <SelectTrigger aria-label="Lead status" size="sm" className={cn("h-8 w-32 rounded-full border text-xs font-medium", TONE[value])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
