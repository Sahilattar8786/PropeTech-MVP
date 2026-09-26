import Image from "next/image";
import Link from "next/link";
import { CheckCheck, ExternalLink, ImageIcon, ImageOff, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineBadge } from "@/components/shared/badges";
import { formatArea, formatDateTime, formatRelative, initials, priceLabel, configurationLabel, locationLabel } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { ConversationDTO, InboxMessageDTO, InboxSubmissionDTO } from "@/server/services/whatsapp/inbox.service";

export function ConversationList({ conversations, activeId }: { conversations: ConversationDTO[]; activeId?: string }) {
  return (
    <ul className="divide-y">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            href={`/dashboard/whatsapp?c=${c.id}`}
            className={cn("flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60", c.id === activeId && "bg-muted")}
            aria-current={c.id === activeId ? "true" : undefined}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-zinc-600">{initials(c.contactName ?? "WA")}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{c.contactName ?? formatPhone(c.phoneNumber)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.lastMessageAt)}</span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-muted-foreground">{c.lastMessagePreview}</span>
                {c.pendingCount > 0 && <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" aria-label="Processing" />}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Bubble({ message }: { message: InboxMessageDTO }) {
  const mine = message.direction === "inbound"; // the broker's own messages, as on their phone
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-xl px-2.5 pt-1.5 pb-1 text-[14px] leading-snug shadow-sm sm:max-w-[70%]", mine ? "rounded-tr-sm bg-whatsapp-bubble" : "rounded-tl-sm bg-white")}>
        {message.type === "image" && (
          <div className="relative mb-1 aspect-[4/3] w-56 max-w-full overflow-hidden rounded-lg bg-black/5">
            {message.imageUrl ? (
              <Image src={message.imageUrl} alt="Property photo" fill sizes="224px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                {message.mediaStatus === "failed" ? (
                  <>
                    <ImageOff className="size-5" /> Media processing failed
                  </>
                ) : message.mediaStatus === "pending" ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Processing photo…
                  </>
                ) : (
                  <ImageIcon className="size-5" />
                )}
              </span>
            )}
          </div>
        )}
        {message.type === "location" && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-3.5" /> Location shared
          </p>
        )}
        {message.text && <p className="whitespace-pre-wrap">{message.text.replace(/\*(.+?)\*/g, "$1").replace(/_(.+?)_/g, "$1")}</p>}
        {message.interactive && (
          <a href={message.interactive.url} className="mt-1.5 -mx-2.5 flex items-center justify-center gap-1.5 border-t px-2.5 pt-1.5 text-sm font-medium text-sky-600">
            <ExternalLink className="size-3.5" /> {message.interactive.buttonText}
          </a>
        )}
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-zinc-500">
          {formatDateTime(message.timestamp)}
          {mine && <CheckCheck className="size-3 text-sky-500" />}
        </p>
      </div>
    </div>
  );
}

export function SubmissionCard({ submission }: { submission: InboxSubmissionDTO }) {
  const { property, state } = submission;
  const busy = state === "received" || state === "processing" || state === "ai_processing";
  const reviewHref = property.status === "draft" ? `/dashboard/properties/${property.id}/review` : `/dashboard/properties/${property.id}`;
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{state === "published" ? "Published listing" : "Property draft"}</p>
        <PipelineBadge state={state} />
      </div>
      {busy ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {state === "ai_processing" ? "AI is organising the details…" : "Processing message and photos…"}
        </p>
      ) : state === "failed" ? (
        <>
          <p className="mt-3 text-sm">{property.ingestion?.error ?? "We couldn't automatically process this property."}</p>
          <Button asChild size="sm" className="mt-3 w-full">
            <Link href={reviewHref}>Review Manually</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="mt-3 flex gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{configurationLabel(property)}</p>
              {locationLabel(property.location, { short: true }) && <p className="text-muted-foreground">{locationLabel(property.location, { short: true })}</p>}
              {property.area && <p className="text-muted-foreground">{formatArea(property.area)}</p>}
              {property.price && <p className="mt-1 font-semibold">{priceLabel(property)}</p>}
            </div>
            {property.aiMetadata?.confidenceScore !== undefined && (
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">AI Confidence</p>
                <p className="text-lg font-semibold tabular-nums">{Math.round(property.aiMetadata.confidenceScore * 100)}%</p>
              </div>
            )}
          </div>
          {submission.failedMedia > 0 && <p className="mt-2 text-xs text-amber-700">{submission.failedMedia} photo(s) failed to process — retry from the review screen.</p>}
          <Button asChild size="sm" variant={state === "published" ? "outline" : "default"} className="mt-3 w-full">
            <Link href={reviewHref}>{state === "published" ? "View property" : "Review Property"}</Link>
          </Button>
        </>
      )}
    </div>
  );
}

/** Messages in order; each property's card appears right after the last message that produced it. */
export function Thread({ messages, submissions }: { messages: InboxMessageDTO[]; submissions: Record<string, InboxSubmissionDTO> }) {
  const lastIndexForProperty = new Map<string, number>();
  messages.forEach((m, i) => m.propertyId && m.direction === "inbound" && lastIndexForProperty.set(m.propertyId, i));
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div key={m.id} className="space-y-3">
          <Bubble message={m} />
          {m.propertyId && lastIndexForProperty.get(m.propertyId) === i && submissions[m.propertyId] && (
            <div className="py-2">
              <SubmissionCard submission={submissions[m.propertyId]!} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
