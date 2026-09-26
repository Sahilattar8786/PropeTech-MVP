import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Inbox, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AutoRefresh } from "@/features/whatsapp/auto-refresh";
import { ConversationList, Thread } from "@/features/whatsapp/inbox-views";
import { ScrollToBottom } from "@/features/whatsapp/scroll-to-bottom";
import { WhatsAppSimulator } from "@/features/whatsapp/simulator";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requireTenantContext } from "@/server/auth/session";
import { getWhatsAppSettings } from "@/server/services/whatsapp/connection.service";
import { getConversation, listConversations } from "@/server/services/whatsapp/inbox.service";

export const metadata: Metadata = { title: "WhatsApp Inbox" };

export default async function WhatsAppInboxPage({ searchParams }: PageProps<"/dashboard/whatsapp">) {
  const ctx = await requireTenantContext();
  const { c } = await searchParams;
  const [conversations, settings] = await Promise.all([listConversations(ctx), getWhatsAppSettings(ctx)]);
  const requestedId = typeof c === "string" ? c : undefined;
  const activeId = requestedId ?? conversations[0]?.id;
  const thread = activeId ? await getConversation(ctx, activeId) : null;
  const busy =
    conversations.some((conv) => conv.pendingCount > 0) ||
    Object.values(thread?.submissions ?? {}).some((s) => ["received", "processing", "ai_processing"].includes(s.state)) ||
    (thread?.messages ?? []).some((m) => m.mediaStatus === "pending");
  const sandbox = settings.provider === "sandbox";

  return (
    <>
      <AutoRefresh active={busy} />
      <PageHeader
        title="WhatsApp Inbox"
        description={settings.senderNumbers.length ? `Send properties to ${formatPhone(settings.businessNumber)} — drafts appear here automatically.` : "Connect your WhatsApp number to start sending properties."}
        actions={
          <Button asChild variant="outline" className="h-9">
            <Link href="/dashboard/settings/whatsapp">
              <Settings2 className="size-4" /> WhatsApp settings
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <aside className={cn("space-y-4", requestedId && "hidden lg:block")}>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <p className="border-b px-4 py-3 text-sm font-semibold">Conversations</p>
            {conversations.length ? <ConversationList conversations={conversations} activeId={activeId} /> : <p className="px-4 py-6 text-sm text-muted-foreground">No conversations yet.</p>}
          </div>
          {sandbox && <WhatsAppSimulator senderNumbers={settings.senderNumbers} registeredNumber={settings.registeredNumber} connectCode={settings.connectCode} />}
        </aside>

        <section className={cn("min-w-0", !requestedId && conversations.length > 0 && "hidden lg:block")}>
          {thread ? (
            <div className="overflow-hidden rounded-2xl border shadow-soft">
              <div className="flex items-center gap-2 border-b bg-card px-4 py-3">
                <Link href="/dashboard/whatsapp" className="-ml-1 rounded-md p-1 hover:bg-muted lg:hidden" aria-label="Back to conversations">
                  <ChevronLeft className="size-5" />
                </Link>
                <div>
                  <p className="font-semibold">{thread.conversation.contactName ?? formatPhone(thread.conversation.phoneNumber)}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(thread.conversation.phoneNumber)}</p>
                </div>
              </div>
              <ScrollToBottom
                watch={`${thread.messages.length}:${Object.values(thread.submissions).map((s) => s.state).join(",")}`}
                className="max-h-[70dvh] min-h-[420px] overflow-y-auto bg-whatsapp-chat p-3 sm:p-5"
              >
                <Thread messages={thread.messages} submissions={thread.submissions} />
              </ScrollToBottom>
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No WhatsApp messages yet"
              description={
                settings.senderNumbers.length
                  ? `Send a property's details and photos to ${formatPhone(settings.businessNumber)} and it'll show up here as a draft.`
                  : "Connect your WhatsApp number, then send property details and photos. We'll turn them into drafts for you to review."
              }
              action={
                !settings.senderNumbers.length && (
                  <Button asChild>
                    <Link href="/dashboard/settings/whatsapp">Connect WhatsApp</Link>
                  </Button>
                )
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
