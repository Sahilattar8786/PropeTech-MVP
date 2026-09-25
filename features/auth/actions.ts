"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut, updateSession, auth } from "@/auth";
import { loginSchema, onboardingSchema, registerSchema, type LoginInput, type OnboardingInput, type RegisterInput } from "@/lib/validation/auth";
import { AppError, runAction, type ActionResult } from "@/server/lib/errors";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/server/lib/rate-limit";
import { completeOnboarding, registerBroker } from "@/server/services/tenants/registration.service";
import { requestPasswordReset, resetPassword } from "@/server/services/tenants/password-reset.service";

async function ip() {
  return clientIp(await headers());
}

function safeCallback(url: string | undefined) {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
}

export async function loginAction(input: LoginInput, callbackUrl?: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const values = loginSchema.parse(input);
    enforceRateLimit(`login-ip:${await ip()}`, RATE_LIMITS.auth, "Too many sign-in attempts. Please wait a few minutes.");
    try {
      await signIn("credentials", { email: values.email, password: values.password, redirect: false });
    } catch (error) {
      if (error instanceof AuthError) throw new AppError("UNAUTHORIZED", "Incorrect email or password");
      throw error;
    }
    return { redirectTo: safeCallback(callbackUrl) };
  });
}

export async function registerAction(input: RegisterInput): Promise<ActionResult<{ redirectTo: string; slug: string }>> {
  return runAction(async () => {
    const values = registerSchema.parse(input);
    enforceRateLimit(`register:${await ip()}`, RATE_LIMITS.register, "Too many sign-ups from this network. Please try again later.");
    const { slug } = await registerBroker(values);
    await signIn("credentials", { email: values.email, password: values.password, redirect: false });
    return { redirectTo: "/dashboard?welcome=1", slug };
  });
}

export async function googleSignInAction(callbackUrl?: string) {
  await signIn("google", { redirectTo: safeCallback(callbackUrl) });
}

export async function onboardingAction(input: OnboardingInput): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("UNAUTHORIZED", "Please sign in again");
    const values = onboardingSchema.parse(input);
    await completeOnboarding(session.user.id, values);
    await updateSession({});
    return { redirectTo: "/dashboard?welcome=1" };
  });
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}

const emailSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });

export async function forgotPasswordAction(input: { email: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { email } = emailSchema.parse(input);
    enforceRateLimit(`forgot:${await ip()}`, RATE_LIMITS.auth);
    await requestPasswordReset(email);
  });
}

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: registerSchema.innerType().shape.password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export async function resetPasswordAction(input: z.infer<typeof resetSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const values = resetSchema.parse(input);
    enforceRateLimit(`reset:${await ip()}`, RATE_LIMITS.auth);
    await resetPassword(values.token, values.password);
  });
}
