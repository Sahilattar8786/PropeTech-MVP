"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-background px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">We couldn&apos;t load this page. Please try again — if it keeps happening, contact support{error.digest ? ` (ref ${error.digest})` : ""}.</p>
      <Button onClick={() => retry()} variant="outline" className="mt-6">
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
