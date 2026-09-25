"use client";

import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-link";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Share a public link: copy, forward on WhatsApp, open, or native share sheet on phones. */
export function ShareMenu({ url, title, size = "sm", variant = "outline", label = "Share" }: { url: string; title: string; size?: "sm" | "default"; variant?: "outline" | "default" | "ghost"; label?: string }) {
  const [copied, setCopied] = useState(false);
  const shareText = `${title}\n${url}`;

  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } else toast.error("Couldn't copy — long-press the link to copy it");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={size === "sm" ? "h-8" : "h-9"}>
          <Share2 className="size-3.5" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={copy}>
          {copied ? <Check /> : <Copy />} Copy link
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={buildWhatsAppShareUrl(shareText)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-4" /> Share on WhatsApp
          </a>
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <DropdownMenuItem onSelect={() => void navigator.share({ title, url }).catch(() => undefined)}>
            <Share2 /> More options…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink /> Open public page
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
