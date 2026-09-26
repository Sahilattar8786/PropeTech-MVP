"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DailyPoint {
  date: string;
  views: number;
  clicks: number;
  leads: number;
}

type Metric = "views" | "clicks" | "leads";
const METRICS: { key: Metric; label: string; title: string }[] = [
  { key: "views", label: "Views", title: "Property views per day" },
  { key: "clicks", label: "WhatsApp clicks", title: "WhatsApp clicks per day" },
  { key: "leads", label: "Leads", title: "New leads per day" },
];

/** Validated single-series mark colour (dataviz validator: lightness, chroma, contrast pass). */
const MARK = "#0d9488";
const HEIGHT = 200;
const PAD = { top: 16, right: 8, bottom: 28, left: 36 };

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value)! * magnitude;
  return step * 4;
}

const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00`));

/** Single-series column chart with a metric switch (never a dual axis), hover/focus tooltips and a table view. */
export function DailyChart({ data }: { data: DailyPoint[] }) {
  const [metric, setMetric] = useState<Metric>("views");
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const [showTable, setShowTable] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = (el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.current.observe(el);
  };

  const values = data.map((d) => d[metric]);
  const max = niceMax(Math.max(0, ...values));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? innerW / data.length : innerW;
  const barW = Math.max(2, Math.min(24, band - 2));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const total = values.reduce((a, b) => a + b, 0);
  const title = METRICS.find((m) => m.key === metric)!.title;
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 64)));
  const peakIndex = values.reduce((best, v, i) => (v > (values[best] ?? -1) ? i : best), 0);

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("en-IN")} in this period
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-surface p-0.5" role="tablist" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", metric === m.key ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={measure} className="relative mt-4" onPointerLeave={() => setActive(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label={`${title}: column chart`} className="block overflow-visible">
          {ticks.map((t) => {
            const y = PAD.top + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                  {Number.isInteger(t) ? t.toLocaleString("en-IN") : t.toFixed(1)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const v = d[metric];
            const h = (v / max) * innerH;
            const x = PAD.left + i * band + (band - barW) / 2;
            const y = PAD.top + innerH - h;
            const r = Math.min(4, h, barW / 2);
            return (
              <g key={d.date}>
                {v > 0 && (
                  <path
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                    fill={MARK}
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={PAD.left + i * band + band / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {dayLabel(d.date)}
                  </text>
                )}
                {/* Hit target: the full band, larger than the painted column. */}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${dayLabel(d.date)}: ${v} ${METRICS.find((m) => m.key === metric)!.label.toLowerCase()}`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
          {max > 0 && values[peakIndex]! > 0 && active === null && (
            <text
              x={PAD.left + peakIndex * band + band / 2}
              y={PAD.top + innerH - (values[peakIndex]! / max) * innerH - 6}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium tabular-nums"
            >
              {values[peakIndex]}
            </text>
          )}
        </svg>
        {active !== null && data[active] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs shadow-lifted"
            style={{ left: Math.min(Math.max(PAD.left + active * band + band / 2, 60), width - 60), top: PAD.top + innerH - (values[active]! / max) * innerH - 8 }}
          >
            <p className="text-sm font-semibold tabular-nums">{values[active]!.toLocaleString("en-IN")}</p>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-3 rounded-full" style={{ background: MARK }} /> {METRICS.find((m) => m.key === metric)!.label} · {dayLabel(data[active].date)}
            </p>
          </div>
        )}
      </div>

      <button type="button" onClick={() => setShowTable((v) => !v)} className="mt-3 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" aria-expanded={showTable}>
        {showTable ? "Hide table" : "View as table"}
      </button>
      {showTable && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Views</th>
                <th className="px-3 py-2 text-right font-medium">WhatsApp clicks</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="px-3 py-1.5">{dayLabel(d.date)}</td>
                  <td className="px-3 py-1.5 text-right">{d.views}</td>
                  <td className="px-3 py-1.5 text-right">{d.clicks}</td>
                  <td className="px-3 py-1.5 text-right">{d.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
