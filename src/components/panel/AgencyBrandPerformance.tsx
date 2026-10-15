"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ChartCard } from "@/components/panel/AgencyBrandCharts";
import { chipClass } from "@/components/panel/ds/buttons";
import { PlatformBadge } from "@/components/panel/ds/platform-icons";
import {
  AXIS_TICK,
  compactMoney,
  compactNumber,
  deltaPct,
  GOOGLE_COLOR,
  GRID,
  INK,
  META_COLOR,
  shortDay,
  TOOLTIP_CURSOR,
  TOOLTIP_STYLE,
} from "@/components/panel/ds/chart-theme";
import { formatNumber, formatTry } from "@/lib/panel/format";

type ChannelKpi = {
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
};

type Insights = {
  days: number;
  from: string;
  to: string;
  type: "lead" | "ecommerce";
  currency: string;
  current: { meta: ChannelKpi; google: ChannelKpi };
  previous: { meta: ChannelKpi; google: ChannelKpi };
  daily: Array<{
    date: string;
    metaSpend: number;
    googleSpend: number;
    metaConv: number;
    googleConv: number;
  }>;
  campaigns: Array<{
    name: string;
    provider: "meta" | "google";
    spend: number;
    conv: number;
    clicks: number;
    impr: number;
  }>;
};

const RANGE_OPTIONS = [7, 30, 90] as const;

type Platform = "all" | "meta" | "google";

const PLATFORM_OPTIONS: Array<{ id: Platform; label: string }> =
  [
    { id: "all", label: "Tümü" },
    { id: "meta", label: "Meta" },
    { id: "google", label: "Google Ads" },
  ];

const PLATFORM_NAME = { meta: "Meta", google: "Google Ads" } as const;

function hasData(k: ChannelKpi): boolean {
  return k.spend > 0 || k.impr > 0 || k.conv > 0;
}

function sum(a: ChannelKpi, b: ChannelKpi): ChannelKpi {
  return {
    spend: a.spend + b.spend,
    impr: a.impr + b.impr,
    clicks: a.clicks + b.clicks,
    conv: a.conv + b.conv,
    convValue: a.convValue + b.convValue,
  };
}

function ratio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export default function AgencyBrandPerformance({ slug }: { slug: string }) {
  const [days, setDays] = useState<number>(30);
  const [platform, setPlatform] = useState<Platform>("all");
  const [state, setState] = useState<{
    days: number;
    data: Insights | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/panel/tenants/${encodeURIComponent(slug)}/insights?days=${days}`,
      {
        signal: ctrl.signal,
        cache: "no-store",
      },
    )
      .then(async (res) => {
        const json = (await res.json()) as Insights & { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        setState({ days, data: json, error: null });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({
          days,
          data: null,
          error: err instanceof Error ? err.message : "Yüklenemedi",
        });
      });
    return () => ctrl.abort();
  }, [slug, days]);

  const loading = !state || state.days !== days;
  const data = state?.data ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {data
            ? `${shortDay(data.from)} – ${shortDay(data.to)} · önceki ${data.days} günle kıyaslı`
            : "Performans yükleniyor…"}
        </p>
        <div
          className="flex gap-2"
          role="group"
          aria-label="Performans aralığı"
        >
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={chipClass(days === d)}
            >
              Son {d} gün
            </button>
          ))}
        </div>
      </div>

      <div
        className="inline-flex flex-wrap gap-1 rounded-full bg-zinc-100 p-1"
        role="group"
        aria-label="Platform"
      >
        {PLATFORM_OPTIONS.map((o) => {
          const active = platform === o.id;
          const empty =
            data != null &&
            o.id !== "all" &&
            !hasData(data.current[o.id]) &&
            !hasData(data.previous[o.id]);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              disabled={empty}
              title={empty ? "Bu dönemde bu platformda veri yok" : undefined}
              onClick={() => setPlatform(o.id)}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-white text-[#141111] shadow-[0_1px_3px_rgba(20,17,17,0.15)]"
                  : "text-zinc-600 hover:text-[#141111]"
              }`}
            >
              {o.id !== "all" ? <PlatformBadge platform={o.id} size="md" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>

      {state?.error && !loading ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Performans yüklenemedi: {state.error}
        </p>
      ) : loading || !data ? (
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy="true"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-zinc-100"
            />
          ))}
        </div>
      ) : (
        <PerformanceBody data={data} platform={platform} />
      )}
    </div>
  );
}

function PerformanceBody({
  data,
  platform,
}: {
  data: Insights;
  platform: Platform;
}) {
  const pick = (p: { meta: ChannelKpi; google: ChannelKpi }) =>
    platform === "all" ? sum(p.meta, p.google) : p[platform];
  const cur = pick(data.current);
  const prev = pick(data.previous);
  const ecommerce = data.type === "ecommerce";
  const money = (v: number) => formatTry(v, data.currency);
  const all = platform === "all";
  const showMeta = platform !== "google";
  const showGoogle = platform !== "meta";

  const daily = data.daily.map((d) => {
    const metaSpend = showMeta ? d.metaSpend : 0;
    const googleSpend = showGoogle ? d.googleSpend : 0;
    const metaConv = showMeta ? d.metaConv : 0;
    const googleConv = showGoogle ? d.googleConv : 0;
    const spend = metaSpend + googleSpend;
    const conv = metaConv + googleConv;
    return {
      date: d.date,
      label: shortDay(d.date),
      spend: Math.round(spend),
      metaSpend,
      googleSpend,
      conv: Math.round(conv * 10) / 10,
      metaConv: Math.round(metaConv * 10) / 10,
      googleConv: Math.round(googleConv * 10) / 10,
      cpa: conv > 0 ? Math.round(spend / conv) : null,
      metaCpa: metaConv > 0 ? Math.round(metaSpend / metaConv) : null,
      googleCpa: googleConv > 0 ? Math.round(googleSpend / googleConv) : null,
    };
  });

  const cpa = ratio(cur.spend, cur.conv);
  const prevCpa = ratio(prev.spend, prev.conv);
  const roas = ratio(cur.convValue, cur.spend);
  const prevRoas = ratio(prev.convValue, prev.spend);
  const ctr = ratio(cur.clicks, cur.impr);
  const prevCtr = ratio(prev.clicks, prev.impr);

  const m = data.current.meta;
  const g = data.current.google;
  const fmtConv = (v: number) => formatNumber(v, v < 10 ? 1 : 0);
  const fmtCpa = (k: ChannelKpi) => {
    const v = ratio(k.spend, k.conv);
    return v != null ? compactMoney(v, data.currency) : "—";
  };
  const fmtRoas = (k: ChannelKpi) => {
    const v = ratio(k.convValue, k.spend);
    return v != null ? `${v.toFixed(2).replace(".", ",")}x` : "—";
  };
  const fmtCtr = (k: ChannelKpi) => {
    const v = ratio(k.clicks, k.impr);
    return v != null ? `%${(v * 100).toFixed(2).replace(".", ",")}` : "—";
  };
  // Tümü görünümünde her kartın altında kanal kırılımı.
  const split = (fmt: (k: ChannelKpi) => string) =>
    all ? { meta: fmt(m), google: fmt(g) } : undefined;
  const sparkSeries = (
    metaKey: "metaSpend" | "metaConv" | "metaCpa",
    googleKey: "googleSpend" | "googleConv" | "googleCpa",
  ) => [
    ...(showMeta
      ? [{ color: META_COLOR, values: daily.map((d) => d[metaKey] ?? 0) }]
      : []),
    ...(showGoogle
      ? [{ color: GOOGLE_COLOR, values: daily.map((d) => d[googleKey] ?? 0) }]
      : []),
  ];
  const campaigns = data.campaigns
    .filter((c) => all || c.provider === platform)
    .slice(0, 10);
  const lineColor = all ? INK : platform === "meta" ? META_COLOR : GOOGLE_COLOR;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Harcama"
          value={compactMoney(cur.spend, data.currency)}
          delta={deltaPct(cur.spend, prev.spend)}
          goodWhen="neutral"
          prevText={`önceki ${compactMoney(prev.spend, data.currency)}`}
          spark={sparkSeries("metaSpend", "googleSpend")}
          split={split((k) => compactMoney(k.spend, data.currency))}
        />
        <KpiTile
          label={ecommerce ? "Satış" : "Dönüşüm"}
          value={formatNumber(cur.conv, cur.conv < 10 ? 1 : 0)}
          delta={deltaPct(cur.conv, prev.conv)}
          goodWhen="up"
          prevText={`önceki ${formatNumber(prev.conv, prev.conv < 10 ? 1 : 0)}`}
          spark={sparkSeries("metaConv", "googleConv")}
          split={split((k) => fmtConv(k.conv))}
        />
        {ecommerce ? (
          <KpiTile
            label="ROAS"
            value={roas != null ? `${roas.toFixed(2).replace(".", ",")}x` : "—"}
            delta={
              roas != null && prevRoas != null ? deltaPct(roas, prevRoas) : null
            }
            goodWhen="up"
            prevText={
              prevRoas != null
                ? `önceki ${prevRoas.toFixed(2).replace(".", ",")}x`
                : "önceki —"
            }
            split={split(fmtRoas)}
          />
        ) : (
          <KpiTile
            label="Dönüşüm başı maliyet"
            value={cpa != null ? money(cpa) : "—"}
            delta={
              cpa != null && prevCpa != null ? deltaPct(cpa, prevCpa) : null
            }
            goodWhen="down"
            prevText={prevCpa != null ? `önceki ${money(prevCpa)}` : "önceki —"}
            spark={sparkSeries("metaCpa", "googleCpa")}
            split={split(fmtCpa)}
          />
        )}
        <KpiTile
          label="Tıklama oranı (CTR)"
          value={
            ctr != null ? `%${(ctr * 100).toFixed(2).replace(".", ",")}` : "—"
          }
          delta={ctr != null && prevCtr != null ? deltaPct(ctr, prevCtr) : null}
          goodWhen="up"
          prevText={`${compactNumber(cur.clicks)} tıklama · ${compactNumber(cur.impr)} gösterim`}
          split={split(fmtCtr)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={`${ecommerce ? "Günlük satış" : "Günlük dönüşüm"}${all ? "" : ` · ${PLATFORM_NAME[platform]}`}`}
          subtitle={
            all
              ? "Panel kuralıyla sayılan dönüşümler, kanal bazında"
              : "Panel kuralıyla sayılan dönüşümler"
          }
          legend={[
            ...(showMeta ? [{ label: "Meta", color: META_COLOR }] : []),
            ...(showGoogle
              ? [{ label: "Google Ads", color: GOOGLE_COLOR }]
              : []),
          ]}
        >
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={TOOLTIP_CURSOR}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [
                    formatNumber(Number(value), 1),
                    name === "metaConv" ? "Meta" : "Google Ads",
                  ]}
                />
                {showMeta ? (
                  <Bar
                    dataKey="metaConv"
                    stackId="c"
                    fill={META_COLOR}
                    maxBarSize={18}
                    radius={showGoogle ? undefined : [4, 4, 0, 0]}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ) : null}
                {showGoogle ? (
                  <Bar
                    dataKey="googleConv"
                    stackId="c"
                    fill={GOOGLE_COLOR}
                    maxBarSize={18}
                    radius={[4, 4, 0, 0]}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={`Günlük dönüşüm başı maliyet${all ? "" : ` · ${PLATFORM_NAME[platform]}`}`}
          subtitle={
            all
              ? `Ortalama: Meta ${fmtCpa(m)} · Google ${fmtCpa(g)} · dönüşüm olmayan günler boş`
              : cpa != null
                ? `Dönem ortalaması ${money(cpa)} · dönüşüm olmayan günler boş`
                : "Bu dönemde dönüşüm yok"
          }
          legend={
            all
              ? [
                  { label: "Meta", color: META_COLOR, kind: "line" as const },
                  {
                    label: "Google Ads",
                    color: GOOGLE_COLOR,
                    kind: "line" as const,
                  },
                ]
              : [
                  { label: "Günlük", color: lineColor, kind: "line" as const },
                  ...(cpa != null
                    ? [
                        {
                          label: "Ortalama",
                          color: "#a8a29e",
                          kind: "line" as const,
                        },
                      ]
                    : []),
                ]
          }
        >
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={daily}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={compactNumber}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [
                    value == null ? "Dönüşüm yok" : money(Number(value)),
                    name === "metaCpa"
                      ? "Meta"
                      : name === "googleCpa"
                        ? "Google Ads"
                        : "Dönüşüm başı",
                  ]}
                />
                {!all && cpa != null ? (
                  <ReferenceLine y={cpa} stroke="#a8a29e" strokeWidth={2} />
                ) : null}
                {(all
                  ? (["metaCpa", "googleCpa"] as const)
                  : (["cpa"] as const)
                ).map((key) => {
                  const color =
                    key === "metaCpa"
                      ? META_COLOR
                      : key === "googleCpa"
                        ? GOOGLE_COLOR
                        : lineColor;
                  return (
                    <Line
                      key={key}
                      dataKey={key}
                      stroke={color}
                      strokeWidth={2}
                      dot={{
                        r: all ? 3.5 : 5,
                        fill: color,
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {all ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <ChannelShare current={data.current} currency={data.currency} />
          <CampaignBars campaigns={campaigns} currency={data.currency} />
        </div>
      ) : (
        <CampaignBars
          campaigns={campaigns}
          currency={data.currency}
          platformLabel={PLATFORM_NAME[platform]}
        />
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  goodWhen,
  prevText,
  spark,
  split,
}: {
  label: string;
  value: string;
  delta: number | null;
  /** neutral = artış/azalış iyi-kötü değil (harcama). */
  goodWhen: "up" | "down" | "neutral";
  prevText: string;
  spark?: Array<{ color: string; values: number[] }>;
  /** Tümü görünümünde kanal kırılımı. */
  split?: { meta: string; google: string };
}) {
  const good =
    delta == null || delta === 0 || goodWhen === "neutral"
      ? null
      : goodWhen === "up"
        ? delta > 0
        : delta < 0;
  const Icon =
    delta == null || delta === 0
      ? Minus
      : delta > 0
        ? ArrowUpRight
        : ArrowDownRight;
  const tone =
    good == null
      ? "bg-zinc-100 text-zinc-700"
      : good
        ? "bg-emerald-50 text-emerald-800"
        : "bg-rose-50 text-rose-800";

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold whitespace-nowrap text-[#141111]">
        {value}
      </p>
      {spark && spark.some((s) => s.values.some((v) => v > 0)) ? (
        <div className="mt-2">
          <MiniSpark series={spark} />
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${tone}`}
        >
          <Icon className="size-3.5" aria-hidden />
          {delta == null ? "—" : `${delta > 0 ? "+" : ""}%${delta}`}
        </span>
        <span className="text-zinc-500">{prevText}</span>
      </div>
      {split ? (
        <div className="mt-auto pt-3">
          <dl className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs">
            {(
              [
                ["Meta", split.meta, "meta"],
                ["Google", split.google, "google"],
              ] as const
            ).map(([name, v, key]) => (
              <div key={name} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-zinc-500">
                  <PlatformBadge platform={key} />
                  {name}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold text-[#141111] tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/** Mini çizgi — kanal başına bir seri, kanal renginde; ortak ölçek. */
function MiniSpark({
  series,
}: {
  series: Array<{ color: string; values: number[] }>;
}) {
  const w = 200;
  const h = 32;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      className="block h-8 w-full overflow-visible"
    >
      {series.map((s) => {
        const step = s.values.length > 1 ? w / (s.values.length - 1) : w;
        const d = s.values
          .map(
            (v, i) =>
              `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`,
          )
          .join(" ");
        return (
          <path
            key={s.color}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/** Harcama / tıklama / dönüşüm payı — iki kanal, %100 çubuklar. */
function ChannelShare({
  current,
  currency,
}: {
  current: { meta: ChannelKpi; google: ChannelKpi };
  currency: string;
}) {
  const metrics: Array<{
    key: keyof ChannelKpi;
    label: string;
    fmt: (v: number) => string;
  }> = [
    { key: "spend", label: "Harcama", fmt: (v) => compactMoney(v, currency) },
    { key: "clicks", label: "Tıklama", fmt: compactNumber },
    {
      key: "conv",
      label: "Dönüşüm",
      fmt: (v) => formatNumber(v, v < 10 ? 1 : 0),
    },
  ];
  return (
    <ChartCard
      title="Kanal payları"
      subtitle="Harcamanın ve sonucun kanallara dağılımı"
      legend={[
        { label: "Meta", color: META_COLOR },
        { label: "Google Ads", color: GOOGLE_COLOR },
      ]}
    >
      <ul className="mt-4 space-y-4">
        {metrics.map((m) => {
          const meta = current.meta[m.key];
          const google = current.google[m.key];
          const total = meta + google;
          const metaPct = total > 0 ? (meta / total) * 100 : 0;
          return (
            <li key={m.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-[#141111]">{m.label}</span>
                <span className="text-xs text-zinc-500 tabular-nums">
                  Meta {m.fmt(meta)} · Google {m.fmt(google)}
                </span>
              </div>
              {total > 0 ? (
                <div
                  className="mt-1.5 flex h-6 w-full gap-[2px] overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${m.label}: Meta %${Math.round(metaPct)}, Google %${Math.round(100 - metaPct)}`}
                >
                  {metaPct > 0 ? (
                    <span
                      className="flex items-center pl-2.5 text-xs font-semibold text-white"
                      style={{ width: `${metaPct}%`, background: META_COLOR }}
                    >
                      {metaPct >= 14 ? `%${Math.round(metaPct)}` : ""}
                    </span>
                  ) : null}
                  {metaPct < 100 ? (
                    <span
                      className="flex items-center justify-end pr-2.5 text-xs font-semibold text-[#141111]"
                      style={{
                        width: `${100 - metaPct}%`,
                        background: GOOGLE_COLOR,
                      }}
                    >
                      {100 - metaPct >= 14
                        ? `%${Math.round(100 - metaPct)}`
                        : ""}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-zinc-400">Veri yok</p>
              )}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/** En çok harcayan kampanyalar — yatay çubuk, kanal rengiyle. */
function CampaignBars({
  campaigns,
  currency,
  platformLabel,
}: {
  campaigns: Insights["campaigns"];
  currency: string;
  /** Tek platform seçiliyse başlıkta gösterilir. */
  platformLabel?: string;
}) {
  const max = Math.max(...campaigns.map((c) => c.spend), 1);
  return (
    <ChartCard
      title={`En çok harcayan kampanyalar${platformLabel ? ` · ${platformLabel}` : ""}`}
      subtitle="Dönem harcaması · sağda dönüşüm ve dönüşüm başı maliyet"
      legend={
        platformLabel
          ? []
          : [
              { label: "Meta", color: META_COLOR },
              { label: "Google Ads", color: GOOGLE_COLOR },
            ]
      }
    >
      {campaigns.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Bu dönemde kampanya harcaması yok.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {campaigns.map((c) => {
            const cpa = c.conv > 0 ? c.spend / c.conv : null;
            return (
              <li
                key={`${c.provider}:${c.name}`}
                className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3"
                title={`${c.name}\n${formatTry(c.spend, currency)} · ${formatNumber(c.conv, 1)} dönüşüm · ${compactNumber(c.clicks)} tıklama`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-[#141111]">
                    <PlatformBadge platform={c.provider} />
                    <span className="truncate">{c.name}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="h-3 rounded-r-[4px]"
                      style={{
                        width: `${Math.max((c.spend / max) * 100, 1)}%`,
                        background:
                          c.provider === "meta" ? META_COLOR : GOOGLE_COLOR,
                      }}
                    />
                    <span className="shrink-0 text-xs font-semibold text-[#141111] tabular-nums">
                      {compactMoney(c.spend, currency)}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <p className="font-semibold text-[#141111]">
                    {formatNumber(c.conv, c.conv < 10 ? 1 : 0)} dönüşüm
                  </p>
                  <p className="text-zinc-500">
                    {cpa != null
                      ? `${compactMoney(cpa, currency)} / dönüşüm`
                      : "dönüşüm yok"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
