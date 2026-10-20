"use client";

/**
 * Firma paneli grafik seti — "rakam yerine grafik" sunum dili.
 * StatTile (değer + delta + sparkline), CompareTrendChart (bu dönem vs önceki),
 * DonutChart (dağılım + merkez toplam + legend), LabeledBarChart (etiketli bar).
 *
 * Renk: kategorik slotlar validate_palette ile doğrulandı (5 slot, light);
 * kuyruk "Diğer" gridir. Metin hiçbir zaman seri renginde yazılmaz.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { DeltaBadge } from "./KPICard";
import { compactNumber, currencySymbol } from "./chart-theme";

export const CATEGORICAL = [
  "#0866FF",
  "#E37400",
  "#15803D",
  "#7C3AED",
  "#DB2777",
] as const;
export const OTHER_COLOR = "#A8A29E";

export function categoricalColor(i: number): string {
  return i < CATEGORICAL.length ? CATEGORICAL[i]! : OTHER_COLOR;
}

export type VizFormat = "money" | "count" | "count1" | "rate" | "duration" | "multiplier";
export type VizVariant = "light" | "navy" | "dark";

const VARIANT: Record<
  VizVariant,
  { bg: string; fg: string; muted: string; border: string; grid: string; line: string; prev: string; surface: string }
> = {
  light: {
    bg: "var(--panel-surface)",
    fg: "var(--panel-fg)",
    muted: "var(--panel-fg-secondary)",
    border: "var(--panel-border)",
    grid: "#ecebe9",
    line: "#1c2057",
    prev: "#b5b3ae",
    surface: "#ffffff",
  },
  navy: {
    bg: "#1c2057",
    fg: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    border: "#1c2057",
    grid: "rgba(255,255,255,0.14)",
    line: "#ffffff",
    prev: "rgba(255,255,255,0.45)",
    surface: "#1c2057",
  },
  dark: {
    bg: "#2a2a2a",
    fg: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    border: "#2a2a2a",
    grid: "rgba(255,255,255,0.14)",
    line: "#ffffff",
    prev: "rgba(255,255,255,0.45)",
    surface: "#2a2a2a",
  },
};

export function formatViz(kind: VizFormat, v: number, currency = "TRY"): string {
  switch (kind) {
    case "money":
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(v);
    case "count1":
      return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(v);
    case "rate":
      return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(v)}%`;
    case "duration": {
      const m = Math.floor(v / 60);
      const s = Math.round(v % 60);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    case "multiplier":
      return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(v)}x`;
    default:
      return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(v);
  }
}

function axisFormat(kind: VizFormat, currency: string) {
  return (v: number) =>
    kind === "money"
      ? `${currencySymbol(currency)}${compactNumber(v)}`
      : kind === "rate"
        ? `${v}%`
        : compactNumber(v);
}

const TIP: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e7e5e4",
  borderRadius: 10,
  fontSize: 12,
  color: "#1a1a1a",
  boxShadow: "0 8px 24px rgba(20,17,17,0.08)",
};

function CardHeader({
  title,
  right,
  variant,
}: {
  title: string;
  right?: ReactNode;
  variant: VizVariant;
}) {
  const v = VARIANT[variant];
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/95 text-[#E37400] shadow-sm">
          <BarChart3 className="size-3.5" aria-hidden strokeWidth={2.5} />
        </span>
        <h3 className="truncate text-sm font-semibold" style={{ color: v.fg }}>
          {title}
        </h3>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

function cardStyle(variant: VizVariant): CSSProperties {
  const v = VARIANT[variant];
  return { background: v.bg, color: v.fg, borderColor: v.border };
}

/* ───────────────── Sparkline ───────────────── */

export function Sparkline({
  values,
  color = "#1c2057",
  height = 44,
  fill = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  if (values.length < 2) return <div style={{ height }} />;
  const data = values.map((v, i) => ({ i, v }));
  const id = `sp-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fill ? 0.18 : 0} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────── StatTile ───────────────── */

/**
 * KPI kutusu: başlık + delta rozeti, büyük değer, altta sparkline.
 * value null → "Kontrol edilemedi" (asla 0 uydurulmaz).
 */
export function StatTile({
  label,
  value,
  delta,
  invert,
  values,
  color,
  variant = "light",
  hint,
  size = "md",
}: {
  label: string;
  value: string | null;
  delta?: number | null;
  /** true → artış kötü (maliyet, çıkma oranı). */
  invert?: boolean;
  values?: number[];
  color?: string;
  variant?: VizVariant;
  hint?: ReactNode;
  size?: "md" | "lg";
}) {
  const v = VARIANT[variant];
  const lineColor = color ?? v.line;
  return (
    <section
      className="rounded-panel-lg border p-4 shadow-panel sm:p-5"
      style={cardStyle(variant)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-white/95 text-[#E37400] shadow-sm">
            <BarChart3 className="size-3" aria-hidden strokeWidth={2.5} />
          </span>
          <p className="truncate text-xs font-medium" style={{ color: v.muted }}>
            {label}
          </p>
        </div>
        {value != null && delta != null && Number.isFinite(delta) ? (
          <DeltaBadge value={delta} invert={invert} />
        ) : null}
      </div>
      {value == null ? (
        <p className="mt-4 text-base font-medium" style={{ color: v.muted }}>
          Kontrol edilemedi
        </p>
      ) : (
        <p
          className={`mt-3 text-center font-semibold tracking-tight ${
            size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
          }`}
          style={{ color: v.fg }}
        >
          {value}
        </p>
      )}
      {hint ? (
        <p className="mt-1 text-center text-[11px]" style={{ color: v.muted }}>
          {hint}
        </p>
      ) : null}
      {value != null && values && values.length > 1 ? (
        <div className="mt-3">
          <Sparkline values={values} color={lineColor} />
        </div>
      ) : null}
    </section>
  );
}

/* ───────────────── CompareTrendChart ───────────────── */

export type ComparePoint = { label: string; current: number; previous: number | null };

/**
 * Bu dönem (vurgulu) vs önceki dönem (gri) çizgi. Tek eksen; önceki dönem
 * aynı gün sırasına hizalanır.
 */
export function CompareTrendChart({
  title,
  data,
  format = "count",
  currency = "TRY",
  total,
  delta,
  invert,
  variant = "navy",
  color,
  height = 230,
}: {
  title: string;
  data: ComparePoint[];
  format?: VizFormat;
  currency?: string;
  total?: number | null;
  delta?: number | null;
  invert?: boolean;
  variant?: VizVariant;
  color?: string;
  height?: number;
}) {
  const v = VARIANT[variant];
  const line = color ?? v.line;
  const hasPrev = data.some((d) => d.previous != null);
  return (
    <section
      className="rounded-panel-lg border p-4 shadow-panel sm:p-5"
      style={cardStyle(variant)}
    >
      <CardHeader
        title={title}
        variant={variant}
        right={
          <>
            {total != null ? (
              <span className="text-sm font-semibold" style={{ color: v.fg }}>
                {formatViz(format, total, currency)}
              </span>
            ) : null}
            {delta != null && Number.isFinite(delta) ? (
              <DeltaBadge value={delta} invert={invert} />
            ) : null}
          </>
        }
      />
      <div className="mt-2 flex items-center justify-center gap-5 text-[11px]" style={{ color: v.muted }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: line }} />
          Bu dönem
        </span>
        {hasPrev ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: v.prev }} />
            Önceki dönem
          </span>
        ) : null}
      </div>
      <div style={{ height }} className="mt-2 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={v.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: v.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: v.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={format === "money" ? 70 : 52}
              tickFormatter={axisFormat(format, currency)}
            />
            <Tooltip
              contentStyle={TIP}
              formatter={(val, name) => [
                formatViz(format, Number(val), currency),
                name === "current" ? "Bu dönem" : "Önceki dönem",
              ]}
              cursor={{ stroke: v.prev, strokeWidth: 1 }}
            />
            {hasPrev ? (
              <Line
                type="monotone"
                dataKey="previous"
                stroke={v.prev}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="current"
              stroke={line}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: v.surface }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/* ───────────────── DonutChart ───────────────── */

export type DonutSlice = { name: string; value: number; color?: string };

/**
 * Dağılım halkası — merkezde toplam, sağda değerli legend. En fazla 5 kromatik
 * dilim; kuyruk "Diğer" olarak gri katlanır.
 */
export function DonutChart({
  title,
  data,
  centerLabel,
  format = "count",
  currency = "TRY",
  variant = "dark",
  delta,
  invert,
  maxSlices = 5,
  height = 200,
}: {
  title: string;
  data: DonutSlice[];
  centerLabel: string;
  format?: VizFormat;
  currency?: string;
  variant?: VizVariant;
  delta?: number | null;
  invert?: boolean;
  maxSlices?: number;
  height?: number;
}) {
  const v = VARIANT[variant];
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSlices);
  const tail = sorted.slice(maxSlices);
  const slices = [
    ...head.map((d, i) => ({ ...d, color: d.color ?? categoricalColor(i) })),
    ...(tail.length
      ? [{ name: "Diğer", value: tail.reduce((s, d) => s + d.value, 0), color: OTHER_COLOR }]
      : []),
  ];
  const total = slices.reduce((s, d) => s + d.value, 0);

  return (
    <section
      className="rounded-panel-lg border p-4 shadow-panel sm:p-5"
      style={cardStyle(variant)}
    >
      <CardHeader
        title={title}
        variant={variant}
        right={
          delta != null && Number.isFinite(delta) ? (
            <DeltaBadge value={delta} invert={invert} />
          ) : null
        }
      />
      {slices.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: v.muted }}>
          Bu dönem için veri yok.
        </p>
      ) : (
        <div className="mt-3 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative mx-auto w-full max-w-[240px]" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  stroke={v.surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TIP}
                  formatter={(val, name) => [
                    `${formatViz(format, Number(val), currency)} · %${total > 0 ? Math.round((Number(val) / total) * 100) : 0}`,
                    String(name),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold" style={{ color: v.fg }}>
                {formatViz(format, total, currency)}
              </span>
              <span className="text-[11px]" style={{ color: v.muted }}>
                {centerLabel}
              </span>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm sm:min-w-[160px]">
            {slices.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-4">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span className="truncate" style={{ color: v.muted }}>
                    {d.name}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color: v.fg }}>
                  {formatViz(format, d.value, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ───────────────── LabeledBarChart ───────────────── */

export type BarDatum = { name: string; value: number };

/**
 * Tek seri bar — değer etiketi bar üstünde (dikey) ya da ucunda (yatay).
 * Uzun kategori adlarında `layout="horizontal"`.
 */
export function LabeledBarChart({
  title,
  data,
  format = "count",
  currency = "TRY",
  color = CATEGORICAL[0],
  variant = "dark",
  layout = "vertical",
  height,
  max = 10,
  delta,
  invert,
}: {
  title: string;
  data: BarDatum[];
  format?: VizFormat;
  currency?: string;
  color?: string;
  variant?: VizVariant;
  layout?: "vertical" | "horizontal";
  height?: number;
  max?: number;
  delta?: number | null;
  invert?: boolean;
}) {
  const v = VARIANT[variant];
  const rows = [...data].sort((a, b) => b.value - a.value).slice(0, max);
  const horizontal = layout === "horizontal";
  const h = height ?? (horizontal ? Math.max(160, rows.length * 34 + 24) : 240);
  const fmt = (val: number) => formatViz(format, val, currency);

  return (
    <section
      className="rounded-panel-lg border p-4 shadow-panel sm:p-5"
      style={cardStyle(variant)}
    >
      <CardHeader
        title={title}
        variant={variant}
        right={
          delta != null && Number.isFinite(delta) ? (
            <DeltaBadge value={delta} invert={invert} />
          ) : null
        }
      />
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: v.muted }}>
          Bu dönem için veri yok.
        </p>
      ) : (
        <div style={{ height: h }} className="mt-3 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={
                horizontal
                  ? { top: 4, right: 56, left: 4, bottom: 4 }
                  : { top: 22, right: 8, left: 0, bottom: 4 }
              }
              barCategoryGap={horizontal ? 6 : "22%"}
            >
              <CartesianGrid
                stroke={v.grid}
                vertical={horizontal}
                horizontal={!horizontal}
              />
              {horizontal ? (
                <>
                  <XAxis
                    type="number"
                    hide
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fill: v.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s)}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: v.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s)}
                  />
                  <YAxis
                    tick={{ fill: v.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={format === "money" ? 66 : 48}
                    tickFormatter={axisFormat(format, currency)}
                  />
                </>
              )}
              <Tooltip
                contentStyle={TIP}
                cursor={{ fill: "rgba(127,127,127,0.12)" }}
                formatter={(val) => [fmt(Number(val)), ""]}
              />
              <Bar
                dataKey="value"
                fill={color}
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={horizontal ? 22 : 56}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="value"
                  position={horizontal ? "right" : "top"}
                  formatter={(val: unknown) => fmt(Number(val))}
                  style={{ fill: v.fg, fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ───────────────── CompareBarChart ───────────────── */

/** Günlük adet (dönüşüm, sipariş): bu dönem vurgulu, önceki dönem gri. */
export function CompareBarChart({
  title,
  data,
  format = "count1",
  currency = "TRY",
  total,
  delta,
  invert,
  variant = "dark",
  color = CATEGORICAL[0],
  height = 220,
}: {
  title: string;
  data: ComparePoint[];
  format?: VizFormat;
  currency?: string;
  total?: number | null;
  delta?: number | null;
  invert?: boolean;
  variant?: VizVariant;
  color?: string;
  height?: number;
}) {
  const v = VARIANT[variant];
  const hasPrev = data.some((d) => d.previous != null);
  return (
    <section
      className="rounded-panel-lg border p-4 shadow-panel sm:p-5"
      style={cardStyle(variant)}
    >
      <CardHeader
        title={title}
        variant={variant}
        right={
          <>
            {total != null ? (
              <span className="text-sm font-semibold" style={{ color: v.fg }}>
                {formatViz(format, total, currency)}
              </span>
            ) : null}
            {delta != null && Number.isFinite(delta) ? (
              <DeltaBadge value={delta} invert={invert} />
            ) : null}
          </>
        }
      />
      <div className="mt-2 flex items-center justify-center gap-5 text-[11px]" style={{ color: v.muted }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: color }} />
          Bu dönem
        </span>
        {hasPrev ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: v.prev }} />
            Önceki dönem
          </span>
        ) : null}
      </div>
      <div style={{ height }} className="mt-2 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={v.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: v.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: v.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={format === "money" ? 66 : 44}
              tickFormatter={axisFormat(format, currency)}
            />
            <Tooltip
              contentStyle={TIP}
              cursor={{ fill: "rgba(127,127,127,0.12)" }}
              formatter={(val, name) => [
                formatViz(format, Number(val), currency),
                name === "current" ? "Bu dönem" : "Önceki dönem",
              ]}
            />
            <Bar dataKey="current" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            {hasPrev ? (
              <Bar dataKey="previous" fill={v.prev} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/* ───────────────── HeroTile ───────────────── */

/** Tek büyük rakam + sparkline (navy) — "Toplam gelir" gibi başlık metrikleri. */
export function HeroTile({
  label,
  value,
  delta,
  invert,
  values,
  variant = "navy",
}: {
  label: string;
  value: string | null;
  delta?: number | null;
  invert?: boolean;
  values?: number[];
  variant?: VizVariant;
}) {
  const v = VARIANT[variant];
  return (
    <section
      className="rounded-panel-lg border p-5 shadow-panel sm:p-6"
      style={cardStyle(variant)}
    >
      <CardHeader
        title={label}
        variant={variant}
        right={
          value != null && delta != null && Number.isFinite(delta) ? (
            <DeltaBadge value={delta} invert={invert} />
          ) : null
        }
      />
      <p
        className="mt-4 text-center text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ color: value == null ? v.muted : v.fg }}
      >
        {value ?? "Kontrol edilemedi"}
      </p>
      {value != null && values && values.length > 1 ? (
        <div className="mx-auto mt-4 max-w-2xl">
          <Sparkline values={values} color={v.line} height={70} fill={false} />
        </div>
      ) : null}
    </section>
  );
}
