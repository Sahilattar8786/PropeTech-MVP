"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROPERTY_STATUS_LABELS, STATUS_TRANSITIONS, type PropertyStatus } from "@/lib/domain/property";
import { changeStatusAction, deletePropertyAction } from "./actions";

/** Lifecycle control: only valid transitions are offered. */
export function StatusControl({ propertyId, status }: { propertyId: string; status: PropertyStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(status);
  const options = [current, ...STATUS_TRANSITIONS[current]];

  return (
    <div className="flex items-center gap-2">
      <Select
        value={current}
        disabled={pending}
        onValueChange={(next) =>
          start(async () => {
            const result = await changeStatusAction(propertyId, next as PropertyStatus);
            if (!result.ok) return void toast.error(result.error);
            setCurrent(result.data.status);
            toast.success(`Marked as ${PROPERTY_STATUS_LABELS[result.data.status]}`);
            router.refresh();
          })
        }
      >
        <SelectTrigger aria-label="Property status" className="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s} value={s}>
              {PROPERTY_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function DeletePropertyButton({ propertyId, title }: { propertyId: string; title: string }) {
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
          <AlertDialogTitle>Delete this property?</AlertDialogTitle>
          <AlertDialogDescription>“{title}” and its photos will be permanently removed, and its public link will stop working. Consider marking it Delisted instead.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const result = await deletePropertyAction(propertyId);
                if (!result.ok) return void toast.error(result.error);
                toast.success("Property deleted");
                router.replace("/dashboard/properties");
              });
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Delete property
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
