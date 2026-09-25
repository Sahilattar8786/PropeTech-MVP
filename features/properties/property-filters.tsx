"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LISTING_TYPE_LABELS, PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/domain/property";
import { cn } from "@/lib/utils";

const ANY = "__any";
const PRICE_OPTIONS = [
  { value: "2500000", label: "₹25 L" },
  { value: "5000000", label: "₹50 L" },
  { value: "10000000", label: "₹1 Cr" },
  { value: "15000000", label: "₹1.5 Cr" },
  { value: "20000000", label: "₹2 Cr" },
  { value: "50000000", label: "₹5 Cr" },
];

type FilterKey = "status" | "type" | "listing" | "bhk" | "locality" | "minPrice" | "maxPrice";

export function PropertyFilters({ localities }: { localities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("focus") === "search") searchRef.current?.focus();
  }, [params]);

  const update = (changes: Partial<Record<FilterKey | "q", string | null>>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === ANY) next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    next.delete("focus");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const activeCount = (["status", "type", "listing", "bhk", "locality", "minPrice", "maxPrice"] as FilterKey[]).filter((k) => params.get(k)).length;

  const selects = (
    <>
      <FilterSelect label="Status" value={params.get("status")} onChange={(v) => update({ status: v })} options={Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
      <FilterSelect label="Type" value={params.get("type")} onChange={(v) => update({ type: v })} options={Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      <FilterSelect label="Sale/Rent" value={params.get("listing")} onChange={(v) => update({ listing: v })} options={Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      <FilterSelect label="BHK" value={params.get("bhk")} onChange={(v) => update({ bhk: v })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} BHK` }))} />
      <FilterSelect label="Location" value={params.get("locality")} onChange={(v) => update({ locality: v })} options={localities.map((l) => ({ value: l, label: l }))} />
      <FilterSelect label="Min price" value={params.get("minPrice")} onChange={(v) => update({ minPrice: v })} options={PRICE_OPTIONS} />
      <FilterSelect label="Max price" value={params.get("maxPrice")} onChange={(v) => update({ maxPrice: v })} options={PRICE_OPTIONS} />
    </>
  );

  return (
    <div className="mb-5 space-y-3">
      <div className="flex gap-2">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search properties…" aria-label="Search properties" className="h-10 rounded-xl bg-background pr-9 pl-9" />
          {pending ? (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : q ? (
            <button type="button" aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" onClick={() => { setQ(""); update({ q: null }); }}>
              <X className="size-4" />
            </button>
          ) : null}
        </form>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-10 rounded-xl lg:hidden">
              <SlidersHorizontal className="size-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 overflow-y-auto px-4">{selects}</div>
            <SheetFooter>
              <Button variant="outline" onClick={() => startTransition(() => router.replace(pathname))}>
                Clear all
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {selects}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname))}>
            <X className="size-3.5" /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string | null; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value ?? ANY} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("h-9 w-full rounded-lg bg-background lg:w-auto lg:min-w-[128px]", value && "border-foreground/30 font-medium")}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{`Any ${label.toLowerCase()}`}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
