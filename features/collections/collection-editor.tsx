"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/shared/badges";
import { PropertyImage } from "@/components/shared/property-image";
import type { PropertyDTO } from "@/lib/domain/property";
import { locationLabel, priceLabel } from "@/lib/format";
import { addPropertiesAction, deleteCollectionAction, removePropertyAction, reorderCollectionAction } from "./actions";

type Item = Pick<PropertyDTO, "id" | "title" | "images" | "status" | "price" | "listingType" | "location" | "propertyType" | "bedrooms" | "furnishing">;

export function CollectionEditor({ collectionId, items, inventory }: { collectionId: string; items: Item[]; inventory: Item[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [pending, start] = useTransition();

  const move = (index: number, delta: number) => {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setOrder(next);
    start(async () => {
      const result = await reorderCollectionAction(collectionId, next.map((p) => p.id));
      if (!result.ok) {
        setOrder(order);
        toast.error(result.error);
      }
    });
  };

  const remove = (propertyId: string) => {
    const previous = order;
    setOrder(order.filter((p) => p.id !== propertyId));
    start(async () => {
      const result = await removePropertyAction(collectionId, propertyId);
      if (!result.ok) {
        setOrder(previous);
        toast.error(result.error);
      } else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {order.length} {order.length === 1 ? "property" : "properties"} · Drafts and delisted properties are hidden from the public page.
        </p>
        <AddPropertiesDialog collectionId={collectionId} inventory={inventory.filter((p) => !order.some((o) => o.id === p.id))} />
      </div>
      {order.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface px-6 py-12 text-center text-sm text-muted-foreground">Add properties to this collection to share them together.</div>
      ) : (
        <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
          {order.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 p-3 sm:p-4">
              <span className="w-5 text-center text-sm text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                <PropertyImage src={p.images[0]} alt={p.title} type={p.propertyType} sizes="56px" seed={i} />
              </span>
              <Link href={`/dashboard/properties/${p.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium hover:underline">{p.title}</span>
                <span className="block truncate text-sm text-muted-foreground">{[priceLabel(p), locationLabel(p.location, { short: true })].filter(Boolean).join(" · ")}</span>
              </Link>
              <StatusBadge status={p.status} className="hidden sm:inline-flex" />
              <div className="flex shrink-0 items-center">
                <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={pending || i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={pending || i === order.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Remove from collection" disabled={pending} onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AddPropertiesDialog({ collectionId, inventory }: { collectionId: string; inventory: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? inventory.filter((p) => `${p.title} ${p.location?.locality ?? ""} ${p.location?.city ?? ""}`.toLowerCase().includes(q)) : inventory;
  }, [inventory, query]);

  const add = () =>
    start(async () => {
      const result = await addPropertiesAction(collectionId, selected);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Added ${selected.length} ${selected.length === 1 ? "property" : "properties"}`);
      setSelected([]);
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9">
          <Plus className="size-4" /> Add properties
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add properties</DialogTitle>
          <DialogDescription>Select properties from your inventory.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your properties" className="h-10 pl-9" aria-label="Search properties" />
        </div>
        <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 && <li className="px-2 py-8 text-center text-sm text-muted-foreground">No properties to add.</li>}
          {filtered.map((p, i) => {
            const checked = selected.includes(p.id);
            return (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                  <Checkbox checked={checked} onCheckedChange={(v) => setSelected(v ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-md">
                    <PropertyImage src={p.images[0]} alt="" type={p.propertyType} sizes="40px" seed={i} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{priceLabel(p)}</span>
                  </span>
                  <StatusBadge status={p.status} />
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button onClick={add} disabled={selected.length === 0 || pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Add {selected.length || ""} {selected.length === 1 ? "property" : "properties"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCollectionButton({ collectionId, name }: { collectionId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="h-9 text-destructive hover:bg-red-50 hover:text-destructive">
          <Trash2 className="size-4" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>The collection and its public link will be removed. Properties themselves are not deleted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const result = await deleteCollectionAction(collectionId);
                if (!result.ok) return void toast.error(result.error);
                toast.success("Collection deleted");
                router.replace("/dashboard/collections");
              });
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Delete collection
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
