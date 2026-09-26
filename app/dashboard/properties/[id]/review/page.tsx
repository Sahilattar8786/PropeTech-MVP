import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PipelineBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { PropertyEditor } from "@/features/properties/property-editor";
import { MediaFailed, ProcessingFailed, ProcessingWatcher } from "@/features/properties/processing-state";
import { pipelineStateOf } from "@/lib/domain/property";
import { requireTenantContext } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { connectDB } from "@/server/db/connect";
import { WhatsAppMessage } from "@/server/models";
import { getProperty } from "@/server/services/properties/property.service";

export const metadata: Metadata = { title: "Review property" };

async function load(id: string) {
  const ctx = await requireTenantContext();
  try {
    return { ctx, property: await getProperty(ctx, id) };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export default async function ReviewPropertyPage({ params }: PageProps<"/dashboard/properties/[id]/review">) {
  const { id } = await params;
  const { ctx, property } = await load(id);
  if (property.status !== "draft") redirect(`/dashboard/properties/${id}`);

  await connectDB();
  const [failedMedia, pendingMedia] = await Promise.all([
    WhatsAppMessage.countDocuments({ tenantId: ctx.tenantId, propertyId: id, mediaStatus: "failed" }),
    WhatsAppMessage.countDocuments({ tenantId: ctx.tenantId, propertyId: id, mediaStatus: "pending" }),
  ]);
  const state = pipelineStateOf(property);
  const processing = state === "processing" || state === "ai_processing" || state === "received";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/properties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Properties
          </Link>
        }
        title={processing ? "Processing property" : "Review property"}
        description={property.source?.type === "whatsapp" ? "Received on WhatsApp. Check every detail, then publish." : "Check every detail, then publish."}
        actions={<PipelineBadge state={state} className="text-sm" />}
      />
      {processing ? (
        <ProcessingWatcher label={state === "ai_processing" ? "AI is organising your property…" : "Processing your WhatsApp message…"} />
      ) : (
        <>
          {state === "failed" && <ProcessingFailed propertyId={property.id} message={property.ingestion?.error} />}
          {failedMedia > 0 && <MediaFailed propertyId={property.id} count={failedMedia} />}
          {pendingMedia > 0 && <p className="mb-4 text-sm text-muted-foreground">{pendingMedia} more {pendingMedia === 1 ? "photo is" : "photos are"} still processing — refresh in a moment.</p>}
          <PropertyEditor key={property.updatedAt} property={property} mode="review" />
        </>
      )}
    </>
  );
}
