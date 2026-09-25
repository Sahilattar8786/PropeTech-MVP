"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, ExternalLink, LogOut, Menu, Plus, Search, Settings, Sparkles, Users, AlertTriangle, Home, LayoutGrid, Inbox } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOutAction } from "@/features/auth/actions";
import { formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/server/services/notifications/inbox-notifications.service";
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav";

export interface ShellProps {
  user: { name: string; email: string; image?: string | null };
  broker: { businessName: string; slug: string; logoUrl?: string; publicUrl: string; displayHost: string };
  plan: { name: string; trialDaysLeft: number | null };
  notifications: AppNotification[];
  children: React.ReactNode;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const item = (n: { href: string; label: string; icon: typeof Home; exact?: boolean }) => {
    const active = isActive(pathname, n.href, n.exact);
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
        {n.label}
      </Link>
    );
  };
  return (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Dashboard">
      {PRIMARY_NAV.map(item)}
      <div className="my-3 h-px bg-sidebar-border" />
      {SECONDARY_NAV.map(item)}
    </nav>
  );
}

function PlanCard({ plan }: { plan: ShellProps["plan"] }) {
  return (
    <div className="rounded-xl border bg-background p-3 text-xs">
      <p className="font-semibold">{plan.name} plan</p>
      <p className="mt-0.5 text-muted-foreground">{plan.trialDaysLeft !== null ? `Trial · ${plan.trialDaysLeft} days left` : "Active"}</p>
      <Link href="/dashboard/settings/billing" className="mt-2 inline-block font-medium text-brand hover:underline">
        Manage plan
      </Link>
    </div>
  );
}

function Notifications({ items }: { items: AppNotification[] }) {
  const icon = { draft_ready: Sparkles, processing_failed: AlertTriangle, lead: Users };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="relative" aria-label={`Notifications${items.length ? ` (${items.length})` : ""}`}>
          <Bell className="size-[18px]" />
          {items.length > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-background" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {items.map((n) => {
              const Icon = icon[n.kind];
              return (
                <li key={n.id}>
                  <Link href={n.href} className="flex gap-3 px-4 py-2.5 hover:bg-muted">
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", n.kind === "lead" ? "bg-whatsapp/10 text-whatsapp" : n.kind === "processing_failed" ? "bg-red-50 text-red-600" : "bg-brand-soft text-brand")}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">{n.title}</span>
                      <span className="block truncate text-muted-foreground">{n.body}</span>
                      <span className="text-xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ user, broker }: Pick<ShellProps, "user" | "broker">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <Avatar className="size-8">
            {broker.logoUrl || user.image ? <AvatarImage src={broker.logoUrl ?? user.image ?? undefined} alt="" /> : null}
            <AvatarFallback className="bg-brand text-xs font-semibold text-white">{initials(user.name || broker.businessName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={broker.publicUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> View my website
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim();
        router.push(q ? `/dashboard/properties?q=${encodeURIComponent(q)}` : "/dashboard/properties");
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input name="q" placeholder="Search properties, localities, IDs…" aria-label="Search properties" className="h-9 rounded-lg bg-surface pl-9" />
    </form>
  );
}

export function DashboardShell({ user, broker, plan, notifications, children }: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="px-2 pb-5">
          <Logo href="/dashboard" />
        </div>
        <NavLinks />
        <PlanCard plan={plan} />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-lg" className="-ml-2 lg:hidden" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-3">
                <SheetHeader className="px-2">
                  <SheetTitle className="text-left">
                    <Logo href="/dashboard" />
                  </SheetTitle>
                </SheetHeader>
                <NavLinks onNavigate={() => setMenuOpen(false)} />
                <PlanCard plan={plan} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <Logo href="/dashboard" compact />
            </div>
            <SearchBox className="hidden max-w-md flex-1 sm:block" />
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="icon-lg" className="sm:hidden" aria-label="Search">
                <Link href="/dashboard/properties?focus=search">
                  <Search className="size-[18px]" />
                </Link>
              </Button>
              <a href={broker.publicUrl} target="_blank" rel="noreferrer" className="mr-2 hidden items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex">
                <ExternalLink className="size-3.5" /> {broker.displayHost}
              </a>
              <Notifications items={notifications} />
              <UserMenu user={user} broker={broker} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:pb-12">{children}</main>
      </div>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Quick navigation">
        <div className="grid h-16 grid-cols-5 items-center">
          {[
            { href: "/dashboard", label: "Home", icon: Home, exact: true },
            { href: "/dashboard/properties", label: "Properties", icon: LayoutGrid },
            null,
            { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Inbox },
            { href: "/dashboard/leads", label: "Leads", icon: Users },
          ].map((item) =>
            item === null ? (
              <Link key="add" href="/dashboard/properties/new" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lifted" aria-label="Add property">
                <Plus className="size-5" />
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex flex-col items-center gap-1 text-[11px] font-medium", isActive(pathname, item.href, item.exact) ? "text-foreground" : "text-muted-foreground")}
              >
                <item.icon className={cn("size-5", isActive(pathname, item.href, item.exact) && "text-brand")} />
                {item.label}
              </Link>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
