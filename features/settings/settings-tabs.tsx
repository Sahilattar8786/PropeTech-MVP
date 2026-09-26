"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/whatsapp", label: "WhatsApp" },
  { href: "/dashboard/settings/branding", label: "Branding" },
  { href: "/dashboard/settings/domain", label: "Domain" },
  { href: "/dashboard/settings/billing", label: "Billing" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" aria-label="Settings">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
