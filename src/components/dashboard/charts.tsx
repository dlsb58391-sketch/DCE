"use client";

/**
 * Dependency-free SVG charts for the earnings dashboard. Every chart is
 * responsive (viewBox + width:100%), themeable via CSS-variable colors so they
 * adapt to dark/light mode, and supports hover tooltips + optional click.
 */
import { useState, type ReactNode } from "react";

type Tip = { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[] } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-primary/20 bg-surface px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <p className="mb-0.5 font-bold text-ink">{tip.title}</p>
      {tip.rows.map((r, i) => (
        <p key={i} className="flex items-center gap-1.5 whitespace-nowrap text-muted">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ms-auto font-semibold text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function Frame({ children, tip }: { children: ReactNode; tip: Tip }) {
  return (
    <div className="relative w-full">
      {children}
      <Tooltip tip={tip} />
    </div>
  );
}

const GOLD = "var(--primary)";

/** Vertical bars. */
export function BarChart({
  data,
  color = GOLD,
  height = 200,
  format = (n) => String(n),
  onSelect,
  activeKey,
}: {
  data: { key: string; label: string; value: number; sub?: string }[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
  onSelect?: (key: string) => void;
  activeKey?: string | null;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 640;
  const H = height;
  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const bw = (innerW / n) * 0.62;
  const gap = innerW / n;

  return (
    <Frame tip={tip}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const bh = (d.value / max) * innerH;
          const x = pad.left + i * gap + (gap - bw) / 2;
          const y = pad.top + innerH - bh;
          const active = activeKey && d.key === activeKey;
          return (
            <g
              key={d.key}
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, title: d.label, rows: [{ label: d.sub || "", value: format(d.value), color }] });
              }}
              onMouseLeave={() => setTip(null)}
              onClick={() => onSelect?.(d.key)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <rect x={x} y={pad.top} width={bw} height={innerH} fill="transparent" />
              <rect x={x} y={y} width={bw} height={Math.max(1, bh)} rx={4} fill={color} opacity={active ? 1 : 0.85} />
              <text x={x + bw / 2} y={H - 10} textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/** Grouped vertical bars (e.g. revenue vs doctor earnings vs clinic profit). */
export function GroupedBars({
  data,
  series,
  height = 220,
  format = (n) => String(n),
  onSelect,
}: {
  data: { key: string; label: string; values: number[] }[];
  series: { name: string; color: string }[];
  height?: number;
  format?: (n: number) => string;
  onSelect?: (key: string) => void;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 640;
  const H = height;
  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const n = data.length || 1;
  const groupW = (innerW / n) * 0.7;
  const gap = innerW / n;
  const bw = groupW / series.length;

  return (
    <Frame tip={tip}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const gx = pad.left + i * gap + (gap - groupW) / 2;
          return (
            <g
              key={d.key}
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  title: d.label,
                  rows: series.map((s, si) => ({ label: s.name, value: format(d.values[si] || 0), color: s.color })),
                });
              }}
              onMouseLeave={() => setTip(null)}
              onClick={() => onSelect?.(d.key)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <rect x={gx} y={pad.top} width={groupW} height={innerH} fill="transparent" />
              {series.map((s, si) => {
                const v = d.values[si] || 0;
                const bh = (v / max) * innerH;
                const x = gx + si * bw;
                const y = pad.top + innerH - bh;
                return <rect key={si} x={x + 1} y={y} width={Math.max(1, bw - 2)} height={Math.max(1, bh)} rx={3} fill={s.color} />;
              })}
              <text x={gx + groupW / 2} y={H - 10} textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/** Smooth line/area chart. */
export function LineChart({
  data,
  color = GOLD,
  height = 200,
  format = (n) => String(n),
}: {
  data: { key: string; label: string; value: number }[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 640;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 28, left: 12 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const xAt = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - (v / max) * innerH;
  const pts = data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ");
  const area = `${pad.left},${pad.top + innerH} ${pts} ${xAt(n - 1)},${pad.top + innerH}`;

  return (
    <Frame tip={tip}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <polygon points={area} fill={color} opacity={0.12} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g
            key={d.key}
            onMouseMove={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, title: d.label, rows: [{ label: "", value: format(d.value), color }] });
            }}
            onMouseLeave={() => setTip(null)}
          >
            <circle cx={xAt(i)} cy={yAt(d.value)} r={3.5} fill={color} />
            <rect x={xAt(i) - gapHalf(n, innerW)} y={pad.top} width={gapHalf(n, innerW) * 2} height={innerH} fill="transparent" />
            {i % Math.ceil(n / 12) === 0 && (
              <text x={xAt(i)} y={H - 10} textAnchor="middle" className="fill-muted" style={{ fontSize: 10 }}>
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </Frame>
  );
}

function gapHalf(n: number, innerW: number) {
  return n <= 1 ? innerW / 2 : innerW / (n - 1) / 2;
}

/** Horizontal bars (e.g. Top 10 earners, earnings by operation type). */
export function HBars({
  data,
  color = GOLD,
  format = (n) => String(n),
  onSelect,
}: {
  data: { key: string; label: string; value: number; sub?: string }[];
  color?: string;
  format?: (n: number) => string;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <button
          key={d.key}
          type="button"
          onClick={() => onSelect?.(d.key)}
          className="block w-full text-start"
          style={{ cursor: onSelect ? "pointer" : "default" }}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-semibold text-ink">{d.label}</span>
            <span className="shrink-0 font-bold text-primary">{format(d.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </button>
      ))}
    </div>
  );
}

/** Donut / distribution chart. */
export function Donut({
  slices,
  size = 168,
  format = (n) => String(n),
}: {
  slices: { key: string; label: string; value: number; color: string }[];
  size?: number;
  format?: (n: number) => string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2;
  const stroke = size * 0.18;
  const radius = r - stroke / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Frame tip={tip}>
      <div className="flex items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} className="shrink-0">
          <circle cx={r} cy={r} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {total > 0 &&
            slices.map((s) => {
              const frac = s.value / total;
              const dash = frac * circ;
              const el = (
                <circle
                  key={s.key}
                  cx={r}
                  cy={r}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${r} ${r})`}
                  onMouseMove={(e) => {
                    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setTip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      title: s.label,
                      rows: [{ label: `${Math.round(frac * 100)}%`, value: format(s.value), color: s.color }],
                    });
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              );
              offset += dash;
              return el;
            })}
          <text x={r} y={r - 4} textAnchor="middle" className="fill-ink" style={{ fontSize: 15, fontWeight: 800 }}>
            {format(total)}
          </text>
          <text x={r} y={r + 14} textAnchor="middle" className="fill-muted" style={{ fontSize: 10 }}>
            total
          </text>
        </svg>
        <div className="space-y-1.5">
          {slices.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted">{s.label}</span>
              <span className="font-semibold text-ink">{format(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Small legend row for grouped charts. */
export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.name} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

export const CHART_COLORS = {
  gold: "var(--primary)",
  emerald: "#10b981",
  violet: "#8b5cf6",
  rose: "#e11d48",
  blue: "#3b82f6",
  amber: "#f59e0b",
  slate: "#64748b",
};
