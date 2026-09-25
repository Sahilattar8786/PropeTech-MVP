import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config/site";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path d="M8 16.5 16 9.5l8 7" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 15v7.5h11V15" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <path d="M14 22.5v-3.5h4v3.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)} aria-label={`${siteConfig.name} home`}>
      <LogoMark />
      {!compact && <span className="text-[17px]">{siteConfig.name}</span>}
    </Link>
  );
}
