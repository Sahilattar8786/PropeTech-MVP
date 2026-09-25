import {
  FURNISHING_LABELS,
  PROPERTY_TYPE_LABELS,
  RESIDENTIAL_TYPES,
  type PropertyDTO,
} from "@/lib/domain/property";

const inr = new Intl.NumberFormat("en-IN");

/** Formats a rupee amount the way Indian brokers write it: ₹1.50 Cr, ₹85 L, ₹45,000. */
export function formatPrice(amount: number | undefined | null, opts: { perMonth?: boolean } = {}): string {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return "Price on request";
  let value: string;
  if (amount >= 1_00_00_000) value = `₹${trimZeros((amount / 1_00_00_000).toFixed(2))} Cr`;
  else if (amount >= 1_00_000) value = `₹${trimZeros((amount / 1_00_000).toFixed(2))} L`;
  else value = `₹${inr.format(amount)}`;
  return opts.perMonth ? `${value}/month` : value;
}

/** Keeps two decimals for crores (₹1.50 Cr) but drops noise such as ₹2.00 Cr → ₹2 Cr. */
function trimZeros(value: string): string {
  return value.endsWith(".00") ? value.slice(0, -3) : value;
}

export function formatArea(area?: { value: number; unit: string } | null): string | null {
  if (!area) return null;
  return `${inr.format(area.value)} ${area.unit === "sqm" ? "sq.m." : "sq.ft."}`;
}

export function formatNumber(value: number): string {
  if (value >= 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return inr.format(value);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelative(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

type Summary = Pick<PropertyDTO, "bedrooms" | "propertyType" | "location" | "furnishing" | "listingType" | "price">;

export function configurationLabel(p: Pick<PropertyDTO, "bedrooms" | "propertyType">): string {
  const type = PROPERTY_TYPE_LABELS[p.propertyType];
  if (p.bedrooms && RESIDENTIAL_TYPES.includes(p.propertyType)) return `${p.bedrooms} BHK ${type}`;
  return type;
}

export function locationLabel(location?: PropertyDTO["location"], opts: { short?: boolean } = {}): string | null {
  if (!location) return null;
  const parts = opts.short ? [location.locality ?? location.city] : [location.locality, location.city];
  const label = parts.filter(Boolean).join(", ");
  return label || null;
}

export function priceLabel(p: Summary): string {
  return formatPrice(p.price?.amount, { perMonth: p.listingType === "rent" });
}

export function furnishingLabel(value?: PropertyDTO["furnishing"]): string | null {
  return value ? FURNISHING_LABELS[value] : null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
