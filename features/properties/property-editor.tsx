"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, MessageSquareText, Rocket, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AIBadge } from "@/components/shared/badges";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { FURNISHING_LABELS, LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, RESIDENTIAL_TYPES, type PropertyDTO } from "@/lib/domain/property";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { propertyFormSchema, propertyToFormValues, publishBlockers, formToPatch, type PropertyFormValues } from "@/lib/validation/property";
import { publishPropertyAction, savePropertyAction } from "./actions";
import { ChipsInput } from "./chips-input";
import { ImageUploader } from "./image-uploader";

const AMENITY_SUGGESTIONS = ["Lift", "Power Backup", "24x7 Security", "Gym", "Swimming Pool", "Clubhouse", "Children's Play Area", "Garden", "CCTV", "Visitor Parking", "Modular Kitchen", "Balcony"];
const NOT_PROVIDED = "Not provided";

/** Which form inputs belong to each AI field (for "AI Generated" badges). */
const AI_FIELD_INPUTS: Record<string, FieldPath<PropertyFormValues>[]> = {
  title: ["title"],
  propertyType: ["propertyType"],
  listingType: ["listingType"],
  bedrooms: ["bedrooms"],
  bathrooms: ["bathrooms"],
  area: ["areaValue", "areaUnit"],
  price: ["priceValue", "priceUnit"],
  location: ["locality", "city", "state", "address", "pincode"],
  furnishing: ["furnishing"],
  parking: ["parking"],
  amenities: ["amenities"],
  description: ["description"],
  highlights: ["highlights"],
};

export function PropertyEditor({ property, mode }: { property: PropertyDTO; mode: "review" | "edit" }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const form = useForm<PropertyFormValues>({ resolver: zodResolver(propertyFormSchema), defaultValues: propertyToFormValues(property), mode: "onTouched" });
  const { errors, dirtyFields } = form.formState;
  const values = useWatch({ control: form.control });
  const isDraft = property.status === "draft";

  const aiBadge = (field: string, compact = false) => {
    const source = property.fieldSources[field];
    if (source?.source !== "ai") return null;
    const inputs = AI_FIELD_INPUTS[field] ?? [];
    const touched = inputs.some((name) => Boolean((dirtyFields as Record<string, unknown>)[name]));
    return touched ? null : <AIBadge confidence={source.confidence} compact={compact} />;
  };

  const submit = (intent: "save" | "publish") =>
    form.handleSubmit(async (data) => {
      setServerError(null);
      setBusy(intent);
      try {
        if (intent === "publish") {
          const result = await publishPropertyAction(property.id, data);
          if (!result.ok) return setServerError(result.error);
          form.reset(data);
          router.replace(`/dashboard/properties/${property.id}?published=1`);
        } else {
          const result = await savePropertyAction(property.id, data, { markReviewed: isDraft });
          if (!result.ok) return setServerError(result.error);
          form.reset(data);
          toast.success(isDraft ? "Draft saved" : "Changes saved");
          router.refresh();
        }
      } finally {
        setBusy(null);
      }
    })();

  const blockers = publishBlockers(formToPatch({ ...propertyToFormValues(property), ...(values as PropertyFormValues) }));
  const pricePreview = values.priceValue && Number(values.priceValue) > 0 ? formatPrice(Number(values.priceValue) * (values.priceUnit === "crore" ? 1e7 : values.priceUnit === "lakh" ? 1e5 : 1), { perMonth: values.listingType === "rent" }) : null;
  const residential = RESIDENTIAL_TYPES.includes(values.propertyType ?? "apartment");
  const warnings = property.aiMetadata?.warnings ?? [];

  const actions = (
    <>
      <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl lg:flex-none" disabled={busy !== null} onClick={() => submit("save")}>
        {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {isDraft ? "Save Draft" : "Save changes"}
      </Button>
      {isDraft && (
        <Button type="button" className="h-11 flex-1 rounded-xl lg:flex-none" disabled={busy !== null} onClick={() => submit("publish")}>
          {busy === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          Publish Property
        </Button>
      )}
    </>
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="grid grid-cols-1 gap-6 pb-20 lg:grid-cols-[1fr_320px] lg:pb-0">
      <div className="min-w-0 space-y-6">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        {mode === "review" && warnings.length > 0 && (
          <FormAlert tone="info">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4" /> Please check these details
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </FormAlert>
        )}

        <Section title="Property Images">
          <Controller control={form.control} name="images" render={({ field }) => <ImageUploader value={field.value} onChange={field.onChange} disabled={busy !== null} />} />
          {errors.images && <p className="mt-2 text-xs text-destructive">{errors.images.message}</p>}
        </Section>

        <Section title="Basics">
          <FormField id="title" label="Title" error={errors.title?.message} labelAddon={aiBadge("title")}>
            <Input id="title" className="h-11 text-[15px] font-medium" {...form.register("title")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="propertyType" label="Property Type" labelAddon={aiBadge("propertyType")}>
              <Controller
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="propertyType" className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="listingType" label="Listing Type" labelAddon={aiBadge("listingType")} error={!values.listingType && isDraft ? undefined : errors.listingType?.message}>
              <Controller
                control={form.control}
                name="listingType"
                render={({ field }) => (
                  <div id="listingType" role="radiogroup" className="grid h-11 grid-cols-2 gap-1 rounded-lg border bg-surface p-1">
                    {Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === value}
                        onClick={() => field.onChange(value)}
                        className={cn("rounded-md text-sm font-medium transition-colors", field.value === value ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </FormField>
          </div>
        </Section>

        <Section title="Price & Size">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="priceValue" label={values.listingType === "rent" ? "Rent per month" : "Price"} error={errors.priceValue?.message} labelAddon={aiBadge("price")} description={pricePreview ?? undefined}>
              <div className="flex gap-2">
                <Input id="priceValue" inputMode="decimal" placeholder={NOT_PROVIDED} className="h-11" {...form.register("priceValue")} />
                <Controller
                  control={form.control}
                  name="priceUnit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Price unit" className="h-11 w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crore">Crore</SelectItem>
                        <SelectItem value="lakh">Lakh</SelectItem>
                        <SelectItem value="rupees">₹</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </FormField>
            <FormField id="areaValue" label="Area" error={errors.areaValue?.message} labelAddon={aiBadge("area")}>
              <div className="flex gap-2">
                <Input id="areaValue" inputMode="decimal" placeholder={NOT_PROVIDED} className="h-11" {...form.register("areaValue")} />
                <Controller
                  control={form.control}
                  name="areaUnit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Area unit" className="h-11 w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sqft">sq.ft.</SelectItem>
                        <SelectItem value="sqm">sq.m.</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {residential && (
              <FormField id="bedrooms" label="BHK" error={errors.bedrooms?.message} labelAddon={aiBadge("bedrooms", true)}>
                <Input id="bedrooms" inputMode="decimal" placeholder="—" className="h-11" {...form.register("bedrooms")} />
              </FormField>
            )}
            <FormField id="bathrooms" label="Bathrooms" error={errors.bathrooms?.message} labelAddon={aiBadge("bathrooms", true)}>
              <Input id="bathrooms" inputMode="numeric" placeholder="—" className="h-11" {...form.register("bathrooms")} />
            </FormField>
            <FormField id="parking" label="Parking" error={errors.parking?.message} labelAddon={aiBadge("parking", true)}>
              <Input id="parking" inputMode="numeric" placeholder="—" className="h-11" {...form.register("parking")} />
            </FormField>
            <FormField id="furnishing" label="Furnishing" labelAddon={aiBadge("furnishing", true)} className={residential ? undefined : "col-span-2 sm:col-span-1"}>
              <Controller
                control={form.control}
                name="furnishing"
                render={({ field }) => (
                  <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                    <SelectTrigger id="furnishing" className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{NOT_PROVIDED}</SelectItem>
                      {Object.entries(FURNISHING_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
        </Section>

        <Section title="Location" addon={aiBadge("location")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="locality" label="Locality" error={errors.locality?.message}>
              <Input id="locality" placeholder={NOT_PROVIDED} className="h-11" {...form.register("locality")} />
            </FormField>
            <FormField id="city" label="City" error={errors.city?.message}>
              <Input id="city" placeholder={NOT_PROVIDED} className="h-11" {...form.register("city")} />
            </FormField>
            <FormField id="state" label="State" error={errors.state?.message}>
              <Input id="state" placeholder={NOT_PROVIDED} className="h-11" {...form.register("state")} />
            </FormField>
            <FormField id="pincode" label="Pincode" error={errors.pincode?.message}>
              <Input id="pincode" inputMode="numeric" placeholder={NOT_PROVIDED} className="h-11" {...form.register("pincode")} />
            </FormField>
          </div>
          <FormField id="address" label="Address" description="Optional. Shown on the listing — leave blank to share only the locality." error={errors.address?.message}>
            <Input id="address" placeholder={NOT_PROVIDED} className="h-11" {...form.register("address")} />
          </FormField>
        </Section>

        <Section title="Description & Features">
          <FormField id="description" label="Description" error={errors.description?.message} labelAddon={aiBadge("description")}>
            <Textarea id="description" rows={6} placeholder={NOT_PROVIDED} className="min-h-36 text-[15px] leading-relaxed" {...form.register("description")} />
          </FormField>
          <FormField id="amenities" label="Amenities" labelAddon={aiBadge("amenities")} description="Only add amenities the property actually has.">
            <Controller control={form.control} name="amenities" render={({ field }) => <ChipsInput id="amenities" value={field.value} onChange={field.onChange} placeholder="Type an amenity and press Enter" suggestions={AMENITY_SUGGESTIONS} />} />
          </FormField>
          <FormField id="highlights" label="Highlights" labelAddon={aiBadge("highlights")} description="Short chips shown at the top of the listing.">
            <Controller control={form.control} name="highlights" render={({ field }) => <ChipsInput id="highlights" value={field.value} onChange={field.onChange} placeholder="e.g. Corner unit" max={10} />} />
          </FormField>
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {mode === "review" && property.aiMetadata?.confidenceScore !== undefined && (
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-brand" /> AI Generated Property
            </p>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-sm text-muted-foreground">AI confidence</span>
              <span className="text-2xl font-semibold tabular-nums">{Math.round(property.aiMetadata.confidenceScore * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(property.aiMetadata.confidenceScore * 100)}%` }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Fields marked <span className="font-medium text-brand">AI Generated</span> came from your message. Anything not in the message is left blank.</p>
          </div>
        )}
        {property.ingestion?.rawText && (
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="size-4 text-muted-foreground" /> Original message
            </p>
            <p className="mt-3 rounded-xl bg-whatsapp-bubble/60 p-3 text-sm leading-relaxed whitespace-pre-wrap">{property.ingestion.rawText}</p>
          </div>
        )}
        {isDraft && blockers.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Before publishing, add:</p>
            <ul className="mt-1 list-disc pl-5">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="hidden gap-2 rounded-2xl border bg-card p-4 shadow-soft lg:flex lg:flex-col">{actions}</div>
      </aside>

      {/* Mobile action bar sits above the dashboard tab bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 flex gap-2 border-t bg-background/95 p-3 backdrop-blur-md lg:hidden">{actions}</div>

    </form>
  );
}

function Section({ title, addon, children }: { title: string; addon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {addon}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
