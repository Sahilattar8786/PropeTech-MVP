"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, CreditCard, Globe, IndianRupee, LayoutDashboard, LogOut, Menu, ScrollText } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/revenue", label: "Revenue", icon: IndianRupee },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, badge: "renewals" },
  { href: "/admin/domains", label: "Domain requests", icon: Globe, badge: "domains" },
  { href: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
] as const;

export interface AdminShellProps {
  admin: { name: string; email: string };
  counts: { domains: number; renewals: number };
  hasWorkspace: boolean;
  children: React.ReactNode;
}

function NavLinks({ counts, onNavigate }: { counts: AdminShellProps["counts"]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin">
      {NAV.map((n) => {
        const active = "exact" in n ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`);
        const badge = "badge" in n ? counts[n.badge] : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <n.icon className={cn("size-4", active && "text-brand")} />
            <span className="flex-1">{n.label}</span>
            {badge > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 tabular-nums" aria-label={`${badge} need attention`}>
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ admin, hasWorkspace }: Pick<AdminShellProps, "admin" | "hasWorkspace">) {
  return (
    <div className="space-y-1 border-t border-sidebar-border pt-3">
      <p className="truncate px-3 text-xs text-muted-foreground" title={admin.email}>
        {admin.email}
      </p>
      {hasWorkspace && (
        <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground">
          <ArrowLeft className="size-4" /> My dashboard
        </Link>
      )}
      <button type="button" onClick={() => void signOutAction()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}

export function AdminShell({ admin, counts, hasWorkspace, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="flex items-center gap-2 px-2 pb-5">
          <Logo href="/admin" />
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">Admin</span>
        </div>
        <NavLinks counts={counts} />
        <SidebarFooter admin={admin} hasWorkspace={hasWorkspace} />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-lg" className="-ml-2" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-3">
                <SheetHeader className="px-2">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <Logo href="/admin" />
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">Admin</span>
                  </SheetTitle>
                </SheetHeader>
                <NavLinks counts={counts} onNavigate={() => setMenuOpen(false)} />
                <SidebarFooter admin={admin} hasWorkspace={hasWorkspace} />
              </SheetContent>
            </Sheet>
            <Logo href="/admin" compact />
            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">Admin</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
