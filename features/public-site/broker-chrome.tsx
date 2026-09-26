import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { LogoMark } from "@/components/shared/logo";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { siteConfig, getAppUrl } from "@/lib/config/site";
import { brokerFirstName, type BrokerDTO } from "@/lib/domain/broker";
import { initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { brokerBaseUrl } from "@/lib/urls";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";

export function BrokerAvatar({ broker, size = 40 }: { broker: BrokerDTO; size?: number }) {
  const src = broker.logoUrl ?? broker.profileImageUrl;
  return src ? (
    <span className="relative shrink-0 overflow-hidden rounded-xl bg-muted" style={{ width: size, height: size }}>
      <Image src={src} alt={`${broker.businessName} logo`} fill sizes={`${size}px`} className="object-cover" />
    </span>
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-xl bg-brand font-semibold text-brand-foreground" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(broker.businessName)}
    </span>
  );
}

export function BrokerHeader({ broker }: { broker: BrokerDTO }) {
  const home = brokerBaseUrl(broker);
  const chat = buildWhatsAppUrl(broker.whatsappNumber, `Hi ${brokerFirstName(broker)}, I found your properties on ${broker.businessName}'s website.`);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href={home} className="flex min-w-0 items-center gap-2.5">
          <BrokerAvatar broker={broker} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold leading-tight">{broker.businessName}</span>
            {broker.city && <span className="block truncate text-xs text-muted-foreground">{broker.city}</span>}
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href={`${home}#properties`} className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
            Properties
          </Link>
          <Link href={`${home}#collections`} className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
            Collections
          </Link>
          <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-whatsapp px-3 text-sm font-semibold text-white">
            <WhatsAppIcon className="size-4" /> <span className="hidden sm:inline">Contact</span><span className="sm:hidden">Chat</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

export function BrokerFooter({ broker }: { broker: BrokerDTO }) {
  return (
    <footer id="contact" className="mt-16 border-t bg-surface">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-2.5">
            <BrokerAvatar broker={broker} size={36} />
            <p className="font-semibold">{broker.businessName}</p>
          </div>
          {broker.tagline && <p className="mt-3 text-sm text-muted-foreground">{broker.tagline}</p>}
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground sm:justify-self-end">
          <li className="flex items-center gap-2">
            <WhatsAppIcon className="size-4" />
            <a href={buildWhatsAppUrl(broker.whatsappNumber)} className="hover:text-foreground">{formatPhone(broker.whatsappNumber)}</a>
          </li>
          {broker.phone && (
            <li className="flex items-center gap-2">
              <Phone className="size-4" /> <a href={`tel:+${broker.phone}`} className="hover:text-foreground">{formatPhone(broker.phone)}</a>
            </li>
          )}
          {broker.email && (
            <li className="flex items-center gap-2">
              <Mail className="size-4" /> <a href={`mailto:${broker.email}`} className="hover:text-foreground">{broker.email}</a>
            </li>
          )}
          {broker.city && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4" /> {broker.city}
            </li>
          )}
        </ul>
      </div>
      <div className="border-t">
        <div className="container-page flex items-center justify-between py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {broker.businessName}</span>
          <a href={getAppUrl()} className="inline-flex items-center gap-1.5 hover:text-foreground">
            <LogoMark className="size-4" /> Powered by {siteConfig.name}
          </a>
        </div>
      </div>
    </footer>
  );
}
