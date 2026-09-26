"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { DEFAULT_BRAND_COLOR, type BrokerDTO } from "@/lib/domain/broker";
import { initials } from "@/lib/format";
import { prepareImageForUpload } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { updateBrandingAction } from "./actions";

const SWATCHES = ["#0f766e", "#1d4ed8", "#7c3aed", "#b45309", "#be123c", "#15803d", "#0f172a", "#9333ea"];

function ImageSlot({ label, value, onChange, round }: { label: string; value?: string; onChange: (url?: string) => void; round?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", await prepareImageForUpload(file));
      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
      onChange(body.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex items-center gap-4">
      <div className={cn("relative flex size-20 items-center justify-center overflow-hidden border bg-muted", round ? "rounded-full" : "rounded-2xl")}>
        {value ? <Image src={value} alt={label} fill sizes="80px" className="object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
        {uploading && <span className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="size-5 animate-spin" /></span>}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)} aria-label={`Remove ${label}`}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
    </div>
  );
}

export function BrandingForm({ broker, allowed }: { broker: BrokerDTO; allowed: boolean }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(broker.logoUrl);
  const [profileImageUrl, setProfileImageUrl] = useState(broker.profileImageUrl);
  const [brandColor, setBrandColor] = useState(broker.brandColor ?? DEFAULT_BRAND_COLOR);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await updateBrandingAction({ logoUrl: logoUrl ?? "", profileImageUrl: profileImageUrl ?? "", brandColor });
    setSaving(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Branding saved");
    router.refresh();
  };

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <ImageSlot label="Logo" value={logoUrl} onChange={setLogoUrl} />
        <ImageSlot label="Profile photo" value={profileImageUrl} onChange={setProfileImageUrl} round />
        <div>
          <p className="text-sm font-medium">Brand colour</p>
          {!allowed && <p className="mt-1 text-xs text-muted-foreground">Custom brand colours are included in Pro and Business.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button key={c} type="button" disabled={!allowed} aria-label={`Use ${c}`} onClick={() => setBrandColor(c)} className="flex size-9 items-center justify-center rounded-full ring-offset-2 disabled:opacity-40 data-[active=true]:ring-2 data-[active=true]:ring-foreground" data-active={brandColor === c} style={{ background: c }}>
                {brandColor === c && <Check className="size-4 text-white" />}
              </button>
            ))}
            <label className="ml-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="color" value={brandColor} disabled={!allowed} onChange={(e) => setBrandColor(e.target.value)} className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5 disabled:opacity-40" aria-label="Custom colour" />
              <span className="font-mono">{brandColor}</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save branding
          </Button>
        </div>
      </section>
      <aside>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Preview</p>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <span className="relative size-8 overflow-hidden rounded-lg"><Image src={logoUrl} alt="" fill sizes="32px" className="object-cover" /></span>
              ) : (
                <span className="flex size-8 items-center justify-center rounded-lg text-xs font-semibold text-white" style={{ background: brandColor }}>{initials(broker.businessName)}</span>
              )}
              <span className="text-sm font-semibold">{broker.businessName}</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-whatsapp px-2 py-1 text-[11px] font-semibold text-white"><WhatsAppIcon className="size-3" /> Contact</span>
          </div>
          <div className="p-4" style={{ background: `linear-gradient(180deg, color-mix(in oklch, ${brandColor} 12%, white), white)` }}>
            <p className="text-lg font-semibold">{broker.businessName}</p>
            <p className="text-xs text-muted-foreground">{broker.tagline ?? "Residential & Commercial Properties"}</p>
            <span className="mt-3 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: brandColor }}>Search</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
