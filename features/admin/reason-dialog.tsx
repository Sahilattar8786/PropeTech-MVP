"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import type { ActionResult } from "@/server/lib/errors";

/** Confirmation dialog that captures a short reason or note before running an admin action. */
export function ReasonDialog({
  trigger,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel,
  successMessage,
  destructive = false,
  required = true,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  successMessage: string;
  destructive?: boolean;
  required?: boolean;
  onConfirm: (reason: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = reason.trim();
    if (required && value.length < 3) return setError("Add a short reason");
    setError(null);
    start(async () => {
      const result = await onConfirm(value);
      if (!result.ok) return setError(result.fieldErrors?.reason ?? result.error);
      setOpen(false);
      setReason("");
      toast.success(successMessage);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {error && <FormAlert>{error}</FormAlert>}
          <FormField id="admin-reason" label={required ? label : `${label} (optional)`}>
            <Textarea id="admin-reason" rows={3} maxLength={500} placeholder={placeholder} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
