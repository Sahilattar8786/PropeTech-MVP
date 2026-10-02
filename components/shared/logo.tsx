import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config/site";

/** Brand colours of the mark. Fixed on purpose: broker sites override `--brand`, the logo must not change. */
export const BRAND_INK = "#111827";
export const BRAND_BLUE = "#2F80ED";

/** Mark geometry ("ticks become rooftops"), shared with the generated icons and OG image. */
export const MARK_VIEWBOX = { width: 102, height: 46 } as const;
export const MARK_ROOFS = ["M6 40 33 6l27 34", "M42 40 69 6l27 34"] as const;
export const MARK_WINDOWS = [
  { x: 26.5, y: 24, width: 13, height: 15.5 },
  { x: 62.5, y: 24, width: 13, height: 15.5 },
] as const;
const MOAT = 0.75;

/**
 * Two read-receipt ticks turned into rooftops. The first roof uses `currentColor` (ink by default,
 * white on dark backgrounds via `tone="inverse"`); the second is always read-receipt blue.
 */
export function LogoMark({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  const mask = useId();
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
      aria-hidden
      className={cn("h-4 w-auto shrink-0", tone === "inverse" ? "text-white" : "text-[#111827]", className)}
    >
      {/* userSpaceOnUse: the default mask region is the stroke-less bbox and would clip the round apexes. */}
      <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={MARK_VIEWBOX.width} height={MARK_VIEWBOX.height}>
        <rect width={MARK_VIEWBOX.width} height={MARK_VIEWBOX.height} fill="white" />
        {MARK_WINDOWS.map((w) => (
          <rect key={w.x} x={w.x - MOAT} y={w.y - MOAT} width={w.width + MOAT * 2} height={w.height + MOAT * 2} rx={2.2} fill="black" />
        ))}
      </mask>
      <g mask={`url(#${mask})`} fill="none" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK_ROOFS[0]} stroke="currentColor" />
        <path d={MARK_ROOFS[1]} stroke={BRAND_BLUE} />
      </g>
      <rect {...MARK_WINDOWS[0]} rx={1.5} fill="currentColor" />
      <rect {...MARK_WINDOWS[1]} rx={1.5} fill={BRAND_BLUE} />
    </svg>
  );
}

/** Square app icon (ink tile, white + blue roofs) — avatars, chat headers, anywhere a square is needed. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-[28%] bg-[#111827]", className)} aria-hidden>
      <LogoMark tone="inverse" className="h-auto w-[72%]" />
    </span>
  );
}

/** Mark + lowercase wordmark, as on the brand board. */
export function Logo({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-baseline gap-2.5 text-foreground", className)} aria-label={`${siteConfig.name} home`}>
      <LogoMark className="h-[15px]" />
      {!compact && <span className="font-heading text-[22px] leading-none font-semibold tracking-[-0.02em]">{siteConfig.name.toLowerCase()}</span>}
    </Link>
  );
}
