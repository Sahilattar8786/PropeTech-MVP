"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { collectionFormSchema, type CollectionDTO, type CollectionFormValues } from "@/lib/validation/collection";
import { createCollectionAction, updateCollectionAction } from "./actions";

const IDEAS = ["Whitefield Properties", "Luxury Villas", "Commercial Properties", "Plots Under ₹1 Crore", "3 BHK Properties", "Investment Properties"];

/** Create or edit a collection. */
export function CollectionFormDialog({ collection, trigger }: { collection?: CollectionDTO; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: { name: collection?.name ?? "", slug: collection?.slug ?? "", description: collection?.description ?? "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = collection ? await updateCollectionAction(collection.id, values) : await createCollectionAction(values);
    if (!result.ok) {
      setServerError(result.error);
      Object.entries(result.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof CollectionFormValues, { message }));
      return;
    }
    setOpen(false);
    toast.success(collection ? "Collection updated" : "Collection created");
    if (collection) router.refresh();
    else router.push(`/dashboard/collections/${result.data.id}`);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{collection ? "Edit collection" : "New collection"}</DialogTitle>
            <DialogDescription>Group properties and share them with one link.</DialogDescription>
          </DialogHeader>
          {serverError && <FormAlert>{serverError}</FormAlert>}
          <FormField id="name" label="Name" error={errors.name?.message}>
            <Input id="name" className="h-10" placeholder="Whitefield Properties" {...form.register("name")} />
          </FormField>
          {!collection && (
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => form.setValue("name", idea, { shouldValidate: true })} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                  {idea}
                </button>
              ))}
            </div>
          )}
          {collection && (
            <FormField id="slug" label="Link" error={errors.slug?.message} description="Changing this breaks links you've already shared.">
              <Input id="slug" className="h-10 font-mono" {...form.register("slug")} />
            </FormField>
          )}
          <FormField id="description" label="Description (optional)" error={errors.description?.message}>
            <Textarea id="description" rows={3} {...form.register("description")} />
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />} {collection ? "Save" : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
