"use client";

import { useRef, useState } from "react";

export interface RevenuePoint {
  /** "yyyy-mm" (IST month). */
  month: string;
  amount: number;
  count: number;
}

/** Same validated single-series mark as the broker analytics chart (dataviz validator: all checks pass on the light surface). */
const MARK = "#0d9488";
const HEIGHT = 220;
const PAD = { top: 20, right: 8, bottom: 28, left: 52 };

const inr = new Intl.NumberFormat("en-IN");

function niceMax(value: number) {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value)! * magnitude;
  return step * 4;
}

/** Axis ticks in the way Indian finance teams read them: ₹0, ₹5K, ₹1.5L, ₹2Cr. */
function compactRupees(value: number) {
  const trim = (n: number) => String(Number(n.toFixed(2)));
  if (value >= 1e7) return `₹${trim(value / 1e7)}Cr`;
  if (value >= 1e5) return `₹${trim(value / 1e5)}L`;
  if (value >= 1e3) return `₹${trim(value / 1e3)}K`;
  return `₹${value}`;
}

function monthLabel(key: string, withYear = false) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

/** Collected revenue per month: single-series columns with hover/focus tooltips and a table view. */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
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

  const values = data.map((d) => d.amount);
  const max = niceMax(Math.max(0, ...values));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? innerW / data.length : innerW;
  const barW = Math.max(2, Math.min(24, band - 2));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 48)));
  const peakIndex = values.reduce((best, v, i) => (v > (values[best] ?? -1) ? i : best), 0);
  const yOf = (v: number) => PAD.top + innerH - (v / max) * innerH;

  return (
    <div>
      <div ref={measure} className="relative" onPointerLeave={() => setActive(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label="Collected revenue per month: column chart" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 8} y={yOf(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {compactRupees(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = (d.amount / max) * innerH;
            const x = PAD.left + i * band + (band - barW) / 2;
            const y = PAD.top + innerH - h;
            const r = Math.min(4, h, barW / 2);
            return (
              <g key={d.month}>
                {d.amount > 0 && (
                  <path
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                    fill={MARK}
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={PAD.left + i * band + band / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {monthLabel(d.month)}
                  </text>
                )}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${monthLabel(d.month, true)}: ₹${inr.format(d.amount)} from ${d.count} payments`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
          {values[peakIndex]! > 0 && active === null && (
            <text x={PAD.left + peakIndex * band + band / 2} y={yOf(values[peakIndex]!) - 6} textAnchor="middle" className="fill-foreground text-[11px] font-medium tabular-nums">
              ₹{inr.format(values[peakIndex]!)}
            </text>
          )}
        </svg>
        {active !== null && data[active] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs shadow-lifted"
            style={{ left: Math.min(Math.max(PAD.left + active * band + band / 2, 70), width - 70), top: yOf(values[active]!) - 8 }}
          >
            <p className="text-sm font-semibold tabular-nums">₹{inr.format(data[active].amount)}</p>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-3 rounded-full" style={{ background: MARK }} /> {monthLabel(data[active].month, true)} · {data[active].count} payment{data[active].count === 1 ? "" : "s"}
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
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Payments</th>
                <th className="px-3 py-2 text-right font-medium">Collected</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...data].reverse().map((d) => (
                <tr key={d.month} className="border-t">
                  <td className="px-3 py-1.5">{monthLabel(d.month, true)}</td>
                  <td className="px-3 py-1.5 text-right">{d.count}</td>
                  <td className="px-3 py-1.5 text-right">₹{inr.format(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
