import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, googleAuthEnabled } from "@/auth";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Create your broker account", description: "Start free — turn WhatsApp property messages into professional listings." };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) redirect(session.user.tenantId ? "/dashboard" : "/onboarding");
  return <RegisterForm googleEnabled={googleAuthEnabled} />;
}
