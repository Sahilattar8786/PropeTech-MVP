"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldSeparator } from "@/components/ui/field";
import { FormAlert, FormField, PasswordInput } from "@/components/shared/form-field";
import { track } from "@/lib/analytics-client";
import { brokerSlugFromName } from "@/lib/slug";
import { brokerDisplayHost } from "@/lib/urls";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { registerAction } from "./actions";
import { GoogleButton } from "./google-button";

const FIELDS: { name: keyof RegisterInput; label: string; type?: string; autoComplete?: string; placeholder?: string; inputMode?: "tel" | "email" }[] = [
  { name: "name", label: "Full Name", autoComplete: "name", placeholder: "Rehan Khan" },
  { name: "businessName", label: "Business Name", autoComplete: "organization", placeholder: "Rehan Properties" },
  { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@business.com", inputMode: "email" },
  { name: "whatsappNumber", label: "WhatsApp Number", type: "tel", autoComplete: "tel", placeholder: "+91 98765 43210", inputMode: "tel" },
  { name: "city", label: "City", autoComplete: "address-level2", placeholder: "Bangalore" },
];

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const started = useRef(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", businessName: "", email: "", whatsappNumber: "", password: "", confirmPassword: "", city: "" },
    mode: "onTouched",
  });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const businessName = useWatch({ control: form.control, name: "businessName" });
  const previewHost = businessName.trim().length >= 2 ? brokerDisplayHost({ slug: brokerSlugFromName(businessName) }) : null;

  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    track("signup_started");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await registerAction(values);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof RegisterInput, { message });
      }
      return;
    }
    router.replace(result.data.redirectTo);
    router.refresh();
  });

  const busy = isSubmitting || (isSubmitSuccessful && !serverError);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your broker account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Your workspace, broker website and WhatsApp inbox — ready in a minute.</p>

      <form onSubmit={onSubmit} onFocus={markStarted} noValidate className="mt-8 space-y-4">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        {FIELDS.map((f) => (
          <FormField
            key={f.name}
            id={f.name}
            label={f.label}
            error={errors[f.name]?.message}
            description={
              f.name === "businessName" && previewHost ? (
                <span className="inline-flex items-center gap-1">
                  <Globe className="size-3" /> Your website: <span className="font-medium text-foreground">{previewHost}</span>
                </span>
              ) : f.name === "whatsappNumber" ? (
                "Customers will contact you on this number."
              ) : undefined
            }
          >
            <Input id={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} inputMode={f.inputMode} placeholder={f.placeholder} className="h-11" aria-invalid={!!errors[f.name]} {...form.register(f.name)} />
          </FormField>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="password" label="Password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="new-password" className="h-11" aria-invalid={!!errors.password} {...form.register("password")} />
          </FormField>
          <FormField id="confirmPassword" label="Confirm Password" error={errors.confirmPassword?.message}>
            <PasswordInput id="confirmPassword" autoComplete="new-password" className="h-11" aria-invalid={!!errors.confirmPassword} {...form.register("confirmPassword")} />
          </FormField>
        </div>
        <Button type="submit" className="h-11 w-full rounded-xl text-[15px]" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Setting up your workspace…" : "Create My Broker Account"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Includes a 14-day Pro trial. No credit card required. By signing up you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </form>

      <FieldSeparator className="my-6">OR</FieldSeparator>
      <GoogleButton enabled={googleEnabled} callbackUrl="/onboarding" />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
