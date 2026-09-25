import { BarChart3, CreditCard, FolderOpen, Home, Inbox, LayoutGrid, Settings, Users } from "lucide-react";

export const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home, exact: true },
  { href: "/dashboard/properties", label: "Properties", icon: LayoutGrid },
  { href: "/dashboard/collections", label: "Collections", icon: FolderOpen },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Inbox },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export const SECONDARY_NAV = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
  { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, exact: true },
] as const;

export function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === "/dashboard/settings") return pathname.startsWith(href) && !pathname.startsWith("/dashboard/settings/billing");
  return pathname === href || pathname.startsWith(`${href}/`);
}
