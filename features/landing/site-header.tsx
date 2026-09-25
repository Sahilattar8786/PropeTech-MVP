"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#whatsapp", label: "WhatsApp" },
  { href: "#website", label: "Broker website" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md transition-colors", scrolled && "border-border")}>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Main">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild className="h-9 rounded-lg px-4">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="h-9 px-3">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="h-9 rounded-lg px-4">
                <Link href="/register">Start Free</Link>
              </Button>
            </>
          )}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[82%] max-w-sm">
            <SheetHeader>
              <SheetTitle className="text-left">
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 p-4">
              {signedIn ? (
                <Button asChild className="h-11 rounded-xl">
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild className="h-11 rounded-xl">
                    <Link href="/register">Start Free</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl">
                    <Link href="/login">Log in</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
