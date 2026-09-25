import { cn } from "@/lib/utils";

/**
 * Architectural illustrations used for product mockups and as image placeholders.
 * Deliberately calm and flat — the product UI is the hero, not stock photography.
 */
export type IllustrationVariant = "tower" | "villa" | "office" | "interior" | "plot" | "courtyard";

const PALETTES = [
  { sky: "#e8efe9", far: "#cfdcd3", mid: "#9fb8ab", near: "#5f7f72", accent: "#f4d9a8", glass: "#dfe8e4" },
  { sky: "#eef0f3", far: "#d7dce4", mid: "#aab4c3", near: "#66758b", accent: "#f1d3b3", glass: "#e3e8ef" },
  { sky: "#f3eee6", far: "#e3d7c6", mid: "#c7b198", near: "#8a735c", accent: "#b7d2c8", glass: "#efe7dc" },
];

export function PropertyIllustration({
  variant = "tower",
  tone = 0,
  className,
  label,
}: {
  variant?: IllustrationVariant;
  tone?: number;
  className?: string;
  label?: string;
}) {
  const p = PALETTES[Math.abs(tone) % PALETTES.length]!;
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn("h-full w-full", className)}>
      <rect width="400" height="300" fill={p.sky} />
      <circle cx="320" cy="70" r="34" fill={p.accent} opacity=".7" />
      {variant === "tower" && (
        <g>
          <rect x="30" y="140" width="70" height="160" fill={p.far} />
          <rect x="300" y="120" width="80" height="180" fill={p.far} />
          <rect x="130" y="50" width="140" height="250" rx="3" fill={p.mid} />
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 4 }).map((__, col) => (
              <rect key={`${row}-${col}`} x={144 + col * 31} y={66 + row * 28} width="22" height="16" rx="2" fill={p.glass} opacity={(row + col) % 3 === 0 ? 1 : 0.75} />
            )),
          )}
          <rect x="120" y="280" width="160" height="20" fill={p.near} />
          <rect x="185" y="262" width="30" height="38" fill={p.near} />
        </g>
      )}
      {variant === "villa" && (
        <g>
          <rect x="0" y="235" width="400" height="65" fill={p.far} />
          <path d="M70 160 200 95l130 65v120H70z" fill={p.mid} />
          <path d="M55 165 200 88l145 77" fill="none" stroke={p.near} strokeWidth="12" strokeLinejoin="round" />
          <rect x="95" y="185" width="60" height="45" rx="3" fill={p.glass} />
          <rect x="245" y="185" width="60" height="45" rx="3" fill={p.glass} />
          <rect x="178" y="200" width="44" height="80" rx="3" fill={p.near} />
          <circle cx="40" cy="230" r="28" fill={p.near} opacity=".55" />
          <circle cx="365" cy="225" r="32" fill={p.near} opacity=".45" />
        </g>
      )}
      {variant === "office" && (
        <g>
          <rect x="20" y="110" width="110" height="190" fill={p.far} />
          <rect x="150" y="40" width="200" height="260" fill={p.mid} />
          {Array.from({ length: 10 }).map((_, row) => (
            <rect key={row} x="162" y={52 + row * 24} width="176" height="14" fill={p.glass} opacity={row % 2 ? 0.7 : 0.95} />
          ))}
          <rect x="220" y="270" width="60" height="30" fill={p.near} />
        </g>
      )}
      {variant === "interior" && (
        <g>
          <rect x="0" y="210" width="400" height="90" fill={p.far} />
          <rect x="40" y="40" width="150" height="130" rx="4" fill={p.glass} stroke={p.mid} strokeWidth="6" />
          <line x1="115" y1="40" x2="115" y2="170" stroke={p.mid} strokeWidth="5" />
          <rect x="220" y="150" width="150" height="60" rx="10" fill={p.mid} />
          <rect x="232" y="125" width="126" height="38" rx="10" fill={p.near} opacity=".8" />
          <rect x="60" y="225" width="120" height="10" rx="5" fill={p.near} opacity=".5" />
          <circle cx="330" cy="80" r="22" fill={p.accent} />
          <rect x="327" y="100" width="6" height="50" fill={p.near} opacity=".6" />
        </g>
      )}
      {variant === "plot" && (
        <g>
          <path d="M0 190 Q200 150 400 185 V300 H0z" fill={p.far} />
          <path d="M60 220 L340 205 L370 290 L30 295z" fill={p.mid} opacity=".8" />
          <path d="M60 220 L340 205 L370 290 L30 295z" fill="none" stroke={p.near} strokeWidth="3" strokeDasharray="10 8" />
          <circle cx="90" cy="175" r="18" fill={p.near} opacity=".5" />
          <circle cx="310" cy="170" r="22" fill={p.near} opacity=".5" />
        </g>
      )}
      {variant === "courtyard" && (
        <g>
          <rect x="30" y="100" width="340" height="200" fill={p.mid} />
          <rect x="140" y="160" width="120" height="140" fill={p.far} />
          {Array.from({ length: 3 }).map((_, i) => (
            <rect key={i} x={50 + i * 110} y="118" width="80" height="26" rx="3" fill={p.glass} />
          ))}
          <circle cx="200" cy="240" r="34" fill={p.near} opacity=".5" />
          <rect x="30" y="92" width="340" height="12" fill={p.near} />
        </g>
      )}
    </svg>
  );
}
