"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import type { BrokerDTO } from "@/lib/domain/broker";
import { formatPhone } from "@/lib/phone";
import { brokerDisplayHost } from "@/lib/urls";
import { profileSchema, type ProfileInput } from "@/lib/validation/settings";
import { checkSlugAction, updateProfileAction } from "./actions";

export function ProfileForm({ broker }: { broker: BrokerDTO }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      businessName: broker.businessName,
      contactName: broker.contactName,
      slug: broker.slug,
      tagline: broker.tagline ?? "",
      description: broker.description ?? "",
      phone: broker.phone ? formatPhone(broker.phone) : "",
      whatsappNumber: formatPhone(broker.whatsappNumber),
      email: broker.email ?? "",
      city: broker.city ?? "",
      website: broker.website ?? "",
    },
    mode: "onTouched",
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const slug = useWatch({ control: form.control, name: "slug" });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await updateProfileAction(values);
    if (!result.ok) {
      setServerError(result.error);
      Object.entries(result.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof ProfileInput, { message }));
      return;
    }
    form.reset(values);
    toast.success("Profile saved");
    router.refresh();
  });

  const field = (name: keyof ProfileInput, label: string, props: React.ComponentProps<typeof Input> = {}, description?: string) => (
    <FormField id={name} label={label} error={errors[name]?.message} description={description}>
      <Input id={name} className="h-10" aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-semibold">Business</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("businessName", "Business name")}
          {field("contactName", "Your name", {}, "Customers see “Hi {first name}” in WhatsApp enquiries.")}
        </div>
        <FormField
          id="slug"
          label="Website address"
          error={errors.slug?.message}
          description={!errors.slug && slug ? `Your website: ${brokerDisplayHost({ slug, customDomain: null })}` : undefined}
        >
          <Input
            id="slug"
            className="h-10 font-mono"
            aria-invalid={!!errors.slug}
            {...form.register("slug", {
              onBlur: async (e) => {
                const value = String(e.target.value).toLowerCase();
                if (value === broker.slug || errors.slug) return;
                const result = await checkSlugAction(value);
                if (result.ok && !result.data.available) form.setError("slug", { message: "That address is taken" });
              },
            })}
          />
        </FormField>
        {field("tagline", "Tagline", { placeholder: "Residential & Commercial Properties" })}
        <FormField id="description" label="About" error={errors.description?.message} description="Shown in the About section of your website.">
          <Textarea id="description" rows={4} {...form.register("description")} />
        </FormField>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-semibold">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("whatsappNumber", "WhatsApp number", { type: "tel", inputMode: "tel" }, "Customer enquiries open a chat with this number.")}
          {field("phone", "Phone (optional)", { type: "tel", inputMode: "tel" })}
          {field("email", "Email", { type: "email" })}
          {field("city", "City")}
        </div>
        {field("website", "Existing website (optional)", { placeholder: "https://" })}
      </section>

      <div className="flex justify-end">
        <Button type="submit" className="h-10 px-5" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Save changes
        </Button>
      </div>
    </form>
  );
}
