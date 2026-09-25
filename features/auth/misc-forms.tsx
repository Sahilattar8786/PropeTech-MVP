"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField, PasswordInput } from "@/components/shared/form-field";
import { onboardingSchema, passwordRule, type OnboardingInput } from "@/lib/validation/auth";
import { forgotPasswordAction, onboardingAction, resetPasswordAction } from "./actions";

export function OnboardingForm({ name }: { name: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<OnboardingInput>({ resolver: zodResolver(onboardingSchema), defaultValues: { businessName: "", whatsappNumber: "", city: "" }, mode: "onTouched" });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await onboardingAction(values);
    if (!result.ok) return setServerError(result.error);
    router.replace(result.data.redirectTo);
    router.refresh();
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome{name ? `, ${name.split(" ")[0]}` : ""}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Tell us about your business to set up your broker workspace.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <FormField id="businessName" label="Business Name" error={errors.businessName?.message}>
          <Input id="businessName" className="h-11" placeholder="Rehan Properties" {...form.register("businessName")} />
        </FormField>
        <FormField id="whatsappNumber" label="WhatsApp Number" error={errors.whatsappNumber?.message}>
          <Input id="whatsappNumber" type="tel" inputMode="tel" className="h-11" placeholder="+91 98765 43210" {...form.register("whatsappNumber")} />
        </FormField>
        <FormField id="city" label="City" error={errors.city?.message}>
          <Input id="city" className="h-11" placeholder="Bangalore" {...form.register("city")} />
        </FormField>
        <Button type="submit" className="h-11 w-full rounded-xl text-[15px]" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Create My Broker Account
        </Button>
      </form>
    </div>
  );
}

const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await forgotPasswordAction(values);
    if (!result.ok) return setServerError(result.error);
    setSent(true);
  });

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-10 text-brand" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">If an account exists for that address, we&apos;ve sent a link to reset your password.</p>
        <Button asChild variant="outline" className="mt-8 h-11 w-full rounded-xl">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" className="h-11" {...form.register("email")} />
        </FormField>
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Send reset link
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

const resetSchema = z
  .object({ password: passwordRule, confirmPassword: z.string().min(1, "Please confirm your password") })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirmPassword: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await resetPasswordAction({ token, ...values });
    if (!result.ok) return setServerError(result.error);
    router.replace("/login?reset=1");
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <FormField id="password" label="New password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" className="h-11" {...form.register("password")} />
        </FormField>
        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" className="h-11" {...form.register("confirmPassword")} />
        </FormField>
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Update password
        </Button>
      </form>
    </div>
  );
}
