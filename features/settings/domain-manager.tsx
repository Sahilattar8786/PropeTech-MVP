"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock, Globe, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { domainSchema, type DomainInput } from "@/lib/validation/settings";
import type { DomainDTO } from "@/server/services/domains/domain.service";
import { addDomainAction, removeDomainAction, verifyDomainAction } from "./actions";

const STATUS = {
  pending: { icon: Clock, label: "Awaiting DNS", className: "text-amber-700" },
  verified: { icon: CheckCircle2, label: "Verified", className: "text-emerald-600" },
  failed: { icon: XCircle, label: "Not verified yet", className: "text-red-600" },
};

export function DomainManager({ domains }: { domains: DomainDTO[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const form = useForm<DomainInput>({ resolver: zodResolver(domainSchema), defaultValues: { hostname: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await addDomainAction(values);
    if (!result.ok) {
      form.setError("hostname", { message: result.fieldErrors?.hostname ?? result.error });
      return;
    }
    form.reset();
    toast.success("Domain added — now add the DNS records");
    router.refresh();
  });

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusyId(id);
    start(async () => {
      const result = await fn();
      setBusyId(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <FormField id="hostname" label="Your domain" error={form.formState.errors.hostname?.message} description="Use a subdomain like www — root domains need an ALIAS/ANAME record.">
          <div className="flex gap-2">
            <Input id="hostname" placeholder="www.rehanproperties.com" className="h-10 font-mono" {...form.register("hostname")} />
            <Button type="submit" className="h-10" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />} Add
            </Button>
          </div>
        </FormField>
      </form>

      {domains.map((d) => {
        const status = STATUS[d.status];
        return (
          <section key={d.id} className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-mono font-medium">
                <Globe className="size-4 text-muted-foreground" /> {d.hostname}
              </p>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${status.className}`}>
                <status.icon className="size-4" /> {status.label}
              </span>
            </div>
            {d.status !== "verified" && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {[d.verificationRecord, d.routingRecord].map((r) => (
                      <tr key={r.type} className="border-t">
                        <td className="py-2.5 pr-4">{r.type}</td>
                        <td className="py-2.5 pr-4 break-all">{r.name}</td>
                        <td className="py-2.5 break-all">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {d.status !== "verified" && (
                <Button size="sm" onClick={() => run(d.id, () => verifyDomainAction(d.id), "Checked DNS records")} disabled={pending && busyId === d.id}>
                  {pending && busyId === d.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Verify
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => run(d.id, () => removeDomainAction(d.id), "Domain removed")} disabled={pending && busyId === d.id}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
