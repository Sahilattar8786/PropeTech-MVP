import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { NewPropertyForm } from "@/features/properties/new-property-form";
import { requireTenantContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  await requireTenantContext();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/properties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Properties
          </Link>
        }
        title="Add Property"
        description="Turn a WhatsApp-style message and photos into a professional listing."
      />
      <NewPropertyForm />
    </>
  );
}
