"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { createFromTextSchema, type CreateFromTextInput } from "@/lib/validation/property";
import { cn } from "@/lib/utils";
import { createFromTextAction, createManualDraftAction } from "./actions";
import { ImageUploader } from "./image-uploader";

const EXAMPLE = "3 BHK flat in Whitefield\n1800 sqft\n₹1.5 Cr\nSemi furnished\n2 parking\nGym, swimming pool, clubhouse";
const STEPS = ["Reading your message", "Extracting property details", "Checking facts against your message", "Writing title & description"];

export function NewPropertyForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [manualPending, startManual] = useTransition();
  const form = useForm<CreateFromTextInput>({ resolver: zodResolver(createFromTextSchema), defaultValues: { text: "", images: [] } });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const working = isSubmitting || (isSubmitSuccessful && !serverError);

  useEffect(() => {
    if (!working) return setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 900);
    return () => clearInterval(timer);
  }, [working]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await createFromTextAction(values);
    if (!result.ok) return setServerError(result.error);
    if (result.data.failed) toast.warning("We couldn't automatically process this property — review it manually.");
    router.push(`/dashboard/properties/${result.data.id}/review`);
  });

  const startManually = () =>
    startManual(async () => {
      const result = await createManualDraftAction();
      if (!result.ok) return void toast.error(result.error);
      router.push(`/dashboard/properties/${result.data.id}/review`);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-brand" /> From a WhatsApp message
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Paste the message you&apos;d normally send a customer. AI organises it into a draft — you review before anything is published.</p>
        </div>

        {serverError && <FormAlert>{serverError}</FormAlert>}

        <FormField id="text" label="Property details" error={errors.text?.message} description="Only what you write is used. Missing details are left blank for you to fill in.">
          <Textarea id="text" rows={7} placeholder={EXAMPLE} className="min-h-40 resize-y text-[15px] leading-relaxed" disabled={working} {...form.register("text")} />
        </FormField>

        <div>
          <p className="mb-2 text-sm font-medium">Photos</p>
          <Controller control={form.control} name="images" render={({ field }) => <ImageUploader value={field.value} onChange={field.onChange} disabled={working} />} />
        </div>

        {working ? (
          <div className="rounded-xl border bg-surface p-4" role="status" aria-live="polite">
            <ul className="space-y-2 text-sm">
              {STEPS.map((label, i) => (
                <li key={label} className={cn("flex items-center gap-2", i > step && "opacity-40")}>
                  {i < step ? <Check className="size-4 text-emerald-600" /> : i === step ? <Loader2 className="size-4 animate-spin text-brand" /> : <span className="size-4" />}
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={startManually} disabled={working || manualPending}>
            {manualPending ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Enter details manually instead
          </Button>
          <Button type="submit" className="h-11 rounded-xl px-5" disabled={working}>
            {working ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {working ? "Creating draft…" : "Create draft with AI"}
          </Button>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <WhatsAppIcon className="size-4 text-whatsapp" /> Even faster on WhatsApp
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Send details and photos to your PropFlow WhatsApp number. Drafts appear in your inbox automatically.</p>
          <Button asChild variant="outline" size="sm" className="mt-4 h-8">
            <Link href="/dashboard/settings/whatsapp">Set up WhatsApp</Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-surface p-5 text-sm">
          <p className="font-semibold">AI never invents facts</p>
          <p className="mt-2 text-muted-foreground">Price, area, location, amenities, parking, floor, RERA, ownership and possession are only filled in when your message says so.</p>
        </div>
      </aside>
    </div>
  );
}
