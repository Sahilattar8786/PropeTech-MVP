"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Ban, CheckCircle2, Loader2, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Trash2, Undo2, Unlink } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import type { DomainSetupStatus, InvoiceStatus } from "@/lib/domain/billing";
import { changeInvoiceStatusAction, disconnectDomainAction, domainAction, rejectDomainAction, setWorkspaceSuspendedAction } from "./actions";
import { ReasonDialog } from "./reason-dialog";

/* ─────────────────────────── Invoices ─────────────────────────── */

export function InvoiceActions({ id, number, status }: { id: string; number: string; status: InvoiceStatus }) {
  const canRefund = status === "paid";
  const canVoid = status === "paid" || status === "pending";
  if (!canRefund && !canVoid) return null;
  return (
    <div className="flex justify-end gap-1">
      {canRefund && (
        <ReasonDialog
          trigger={
            <Button variant="ghost" size="xs" aria-label={`Refund ${number}`}>
              <Undo2 /> Refund
            </Button>
          }
          title={`Refund ${number}?`}
          description="Records that the money was returned. It stops counting as revenue. The subscription isn't changed — edit it separately if needed."
          label="Note"
          placeholder="e.g. Refunded via UPI, ref 4821…"
          required={false}
          confirmLabel="Mark refunded"
          successMessage={`${number} marked refunded`}
          onConfirm={(note) => changeInvoiceStatusAction(id, { status: "refunded", note })}
        />
      )}
      {canVoid && (
        <ReasonDialog
          trigger={
            <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" aria-label={`Void ${number}`}>
              <Ban /> Void
            </Button>
          }
          title={`Void ${number}?`}
          description="For a payment recorded by mistake. It stops counting as revenue; the number stays used so the sequence has no gaps."
          label="Note"
          placeholder="e.g. Duplicate entry"
          destructive
          confirmLabel="Void invoice"
          successMessage={`${number} voided`}
          onConfirm={(note) => changeInvoiceStatusAction(id, { status: "void", note })}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── Domain requests ─────────────────────────── */

function useDomainOp(id: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (op: Parameters<typeof domainAction>[1], success: string | ((verified?: boolean) => string)) =>
    start(async () => {
      const result = await domainAction(id, op);
      if (!result.ok) return void toast.error(result.error);
      toast.success(typeof success === "string" ? success : success(result.data.verified));
      router.refresh();
    });
  return { pending, run };
}

export function DomainActions({ id, hostname, setupStatus, dnsVerified }: { id: string; hostname: string; setupStatus: DomainSetupStatus; dnsVerified: boolean }) {
  const { pending, run } = useDomainOp(id);
  const spinner = pending ? <Loader2 className="animate-spin" /> : null;
  const recheck = (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => run("recheck", (ok) => (ok ? "DNS verified" : "TXT record not found yet"))}>
      {spinner ?? <RefreshCw />} Check DNS
    </Button>
  );

  switch (setupStatus) {
    case "requested":
      return (
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={pending}>
                {spinner ?? <CheckCircle2 />} Mark added to hosting
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Is {hostname} added to hosting?</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirm you&apos;ve added <span className="font-mono">{hostname}</span> in the hosting project (Vercel → Settings → Domains).
                  {dnsVerified ? " DNS is already verified, so the broker's links switch to this domain now." : " It goes live once the broker's DNS is verified."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("configure", `${hostname} marked as on hosting`)}>Yes, it&apos;s added</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {recheck}
          <ReasonDialog
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}>
                <Ban /> Reject
              </Button>
            }
            title={`Reject ${hostname}?`}
            description="The broker sees this reason in Settings → Domain and can remove the request."
            placeholder="e.g. This domain belongs to another business"
            destructive
            confirmLabel="Reject request"
            successMessage="Request rejected"
            onConfirm={(reason) => rejectDomainAction(id, { reason })}
          />
        </div>
      );
    case "configured":
      return (
        <div className="flex flex-wrap gap-2">
          {recheck}
          <ReasonDialog
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}>
                <Unlink /> Disconnect
              </Button>
            }
            title={`Disconnect ${hostname}?`}
            description="The broker's links switch back to their PropFlow address immediately. The domain then moves to “Needs removal” so it can be removed from hosting."
            placeholder="e.g. Downgraded from Business plan"
            destructive
            confirmLabel="Disconnect"
            successMessage={`${hostname} disconnected`}
            onConfirm={(reason) => disconnectDomainAction(id, { reason })}
          />
        </div>
      );
    case "rejected":
      return (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("reopen", "Request reopened")}>
          {spinner ?? <RotateCcw />} Reopen
        </Button>
      );
    case "removal_requested":
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              {spinner ?? <Trash2 />} Mark removed from hosting
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Removed {hostname} from hosting?</AlertDialogTitle>
              <AlertDialogDescription>Confirm the domain is deleted from the hosting project. This clears the request; the hostname can then be connected again by any workspace.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run("complete_removal", `${hostname} cleared`)}>Yes, it&apos;s removed</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
  }
}

/* ─────────────────────────── Workspaces ─────────────────────────── */

export function WorkspaceStatusButton({ tenantId, name, suspended }: { tenantId: string; name: string; suspended: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (suspended) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />} Reactivate
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate {name}?</AlertDialogTitle>
            <AlertDialogDescription>The team regains dashboard access, the public website comes back online and WhatsApp messages are processed again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                start(async () => {
                  const result = await setWorkspaceSuspendedAction(tenantId, false);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(`${name} reactivated`);
                  router.refresh();
                })
              }
            >
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <ReasonDialog
      trigger={
        <Button variant="destructive">
          <PauseCircle /> Suspend
        </Button>
      }
      title={`Suspend ${name}?`}
      description="Blocks dashboard access, takes the public website and listings offline, and ignores their WhatsApp messages. No data is deleted — you can reactivate any time."
      label="Internal reason"
      placeholder="e.g. Chargeback / abusive listings reported"
      destructive
      confirmLabel="Suspend workspace"
      successMessage={`${name} suspended`}
      onConfirm={(reason) => setWorkspaceSuspendedAction(tenantId, true, { reason })}
    />
  );
}
