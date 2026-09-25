import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, googleAuthEnabled } from "@/auth";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That Google account can't be linked. Sign in with email instead.",
  AccessDenied: "Google sign-in was cancelled or your email isn't verified.",
  Configuration: "Sign-in is temporarily unavailable. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const session = await auth();
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;
  if (session?.user?.id) redirect(session.user.tenantId ? (callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard") : "/onboarding");
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "Sign-in failed. Please try again." : undefined;
  const notice = params.reset ? "Password updated — sign in with your new password." : error;
  return <LoginForm googleEnabled={googleAuthEnabled} callbackUrl={callbackUrl} notice={notice} />;
}
