import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/features/auth/misc-forms";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false } };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.tenantId) redirect("/dashboard");
  return <OnboardingForm name={session.user.name ?? ""} />;
}
