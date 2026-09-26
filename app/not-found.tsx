import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <Compass className="size-5 text-muted-foreground" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">This page doesn&apos;t exist or the listing is no longer available.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
