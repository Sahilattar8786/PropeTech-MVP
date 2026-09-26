import { notFound } from "next/navigation";
import { BrokerFooter, BrokerHeader } from "@/features/public-site/broker-chrome";
import { DEFAULT_BRAND_COLOR } from "@/lib/domain/broker";
import { getPublicBrokerBySlug } from "@/server/services/tenants/broker.service";

/** Public broker website chrome. The broker's brand colour replaces the product accent. */
export default async function BrokerSiteLayout({ children, params }: LayoutProps<"/[brokerSlug]">) {
  const { brokerSlug } = await params;
  const broker = await getPublicBrokerBySlug(brokerSlug);
  if (!broker) notFound();
  const brand = broker.brandColor ?? DEFAULT_BRAND_COLOR;
  return (
    <div className="flex min-h-dvh flex-col" style={{ "--brand": brand, "--ring": brand, "--brand-soft": `color-mix(in oklch, ${brand} 12%, white)` } as React.CSSProperties}>
      <BrokerHeader broker={broker} />
      <div className="flex-1">{children}</div>
      <BrokerFooter broker={broker} />
    </div>
  );
}
