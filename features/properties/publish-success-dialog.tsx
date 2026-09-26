"use client";

import { Check, Copy, ExternalLink, PartyPopper } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-link";
import { copyText } from "./share-menu";

export function PublishSuccessDialog({ open, onOpenChange, url, title }: { open: boolean; onOpenChange: (open: boolean) => void; url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <PartyPopper className="size-5" />
          </span>
          <DialogTitle>Your listing is live</DialogTitle>
          <DialogDescription>Share this link with customers. Enquiries come straight to your WhatsApp with the property details.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-xl border bg-surface p-2 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{url.replace(/^https?:\/\//, "")}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (await copyText(url)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="outline">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> View listing
            </a>
          </Button>
          <Button asChild className="bg-whatsapp text-white hover:bg-whatsapp/90">
            <a href={buildWhatsAppShareUrl(`${title}\n${url}`)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-4" /> Share on WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shown once after publishing (driven by ?published=1 so it survives server re-renders). */
export function PublishedNotice({ url, title }: { url: string; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  return (
    <PublishSuccessDialog
      open={open}
      url={url}
      title={title}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.replace(pathname, { scroll: false });
      }}
    />
  );
}
