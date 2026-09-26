import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/lib/config/site";

/** Shared layout for /privacy and /terms. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Home
          </Link>
        </div>
      </header>
      <main className="container-page max-w-3xl py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {siteConfig.legal.lastUpdated}</p>
        <div className="mt-8 space-y-8 leading-relaxed text-foreground/90 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
        <p className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          {siteConfig.legal.entityName}
          {siteConfig.legal.address ? ` · ${siteConfig.legal.address}` : ""} ·{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="underline underline-offset-4">
            {siteConfig.supportEmail}
          </a>
        </p>
      </main>
    </div>
  );
}
