"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FlaskConical, ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone } from "@/lib/phone";

const SAMPLE = "New Property\n3 BHK Apartment\nWhitefield\n1800 sqft\n₹1.5 Cr\nSemi Furnished\n2 Parking";

/**
 * Sandbox-only tool that sends a real Meta-format webhook to this app, so brokers and
 * developers can try the WhatsApp → draft flow without WhatsApp Business credentials.
 */
export function WhatsAppSimulator({ senderNumbers, registeredNumber, connectCode }: { senderNumbers: string[]; registeredNumber: string; connectCode?: string }) {
  const router = useRouter();
  const connected = senderNumbers.length > 0;
  const [from, setFrom] = useState(senderNumbers[0] ?? registeredNumber);
  const [text, setText] = useState(connected ? SAMPLE : `CONNECT ${connectCode ?? ""}`.trim());
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = async () => {
    setSending(true);
    try {
      const form = new FormData();
      form.set("from", from);
      form.set("text", text);
      files.forEach((f) => form.append("images", f));
      const res = await fetch("/api/dev/whatsapp/simulate", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't send");
      toast.success(`Sent ${body.messages} WhatsApp ${body.messages === 1 ? "message" : "messages"} to PropFlow`);
      setFiles([]);
      if (!connected) setText(SAMPLE);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  const numbers = [...new Set([...senderNumbers, registeredNumber])];

  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-brand-soft/40 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="size-4 text-brand" /> WhatsApp sandbox
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        No WhatsApp Business credentials are configured, so messages are simulated. They go through the real webhook, queue and AI pipeline.
        {!connected && " Start by sending the connect code to link your number."}
      </p>
      <div className="mt-3 space-y-2.5">
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger aria-label="Send as" className="h-9 w-full bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {numbers.map((n) => (
              <SelectItem key={n} value={n}>
                From {formatPhone(n)} {senderNumbers.includes(n) ? "· connected" : "· not connected"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Message" className="bg-background text-sm" />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2.5 text-xs">
                {f.name.slice(0, 18)}
                <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-muted">
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9 bg-background" onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" /> Photos
          </Button>
          <Button type="button" size="sm" className="h-9 flex-1" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to PropFlow
          </Button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 10)); e.target.value = ""; }} />
      </div>
    </div>
  );
}
