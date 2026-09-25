"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldSeparator } from "@/components/ui/field";
import { FormAlert, FormField, PasswordInput } from "@/components/shared/form-field";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginAction } from "./actions";
import { GoogleButton } from "./google-button";

export function LoginForm({ googleEnabled, callbackUrl, notice }: { googleEnabled: boolean; callbackUrl?: string; notice?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" }, mode: "onTouched" });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await loginAction(values, callbackUrl);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSuccess(true);
    router.replace(result.data.redirectTo);
    router.refresh();
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Manage your property inventory</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {notice && !serverError && !success && <FormAlert tone="info">{notice}</FormAlert>}
        {serverError && <FormAlert>{serverError}</FormAlert>}
        {success && (
          <FormAlert tone="success">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Signed in — taking you to your dashboard…
            </span>
          </FormAlert>
        )}
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@business.com" className="h-11" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...form.register("email")} />
        </FormField>
        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          labelAddon={
            <Link href="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••" className="h-11" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...form.register("password")} />
        </FormField>
        <Button type="submit" className="h-11 w-full rounded-xl text-[15px]" disabled={isSubmitting || success}>
          {isSubmitting || success ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSubmitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <FieldSeparator className="my-6">OR</FieldSeparator>
      <GoogleButton enabled={googleEnabled} callbackUrl={callbackUrl} />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
