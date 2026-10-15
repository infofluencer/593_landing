"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import {
  missingProviders,
  noSpendToday,
  paymentIssue,
} from "@/lib/panel/brand-table-utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  compactMoney,
  compactNumber,
  GOOGLE_COLOR,
  GRID,
  INK,
  LEAD_COLOR,
  META_COLOR,
  SALE_COLOR,
  shortDay,
  STATUS_ERROR,
  STATUS_OK,
  TOOLTIP_CURSOR,
  TOOLTIP_STYLE,
} from "@/components/panel/ds/chart-theme";
import type { AgencyResults } from "@/lib/panel/agency-results";
import type { BrandTableRow, DailySpend } from "@/lib/panel/brand-table";
import { PACE_STATUS_META } from "@/lib/panel/budget-pacing";
import { formatTry } from "@/lib/panel/format";

const PLAN_COLOR = "#a8a29e";


/** Ayda hiç harcama yoksa boş eksen yerine açıklama. */
export function NoSpendState({ row }: { row: BrandTableRow }) {
  const last = row.lastSpendDate;
  return (
    <div className="mt-4 flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center">
      <AlertTriangle className="size-6 text-amber-600" aria-hidden />
      <p className="text-base font-semibold text-[#141111]">Bu ay harcama yok</p>
      <p className="max-w-sm text-sm text-zinc-600">
        {last
          ? `Son harcama ${last.slice(8, 10)}.${last.slice(5, 7)}.${last.slice(0, 4)} (${row.spendStoppedDays} gün önce). Senkron çalışıyorsa kampanyalar durdurulmuş ya da ödeme sorunu olabilir.`
          : "Bu markada kayıtlı harcama yok. Hesap eşleşmesini ve senkronu kontrol edin."}
      </p>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: Array<{ label: string; color: string; kind?: "bar" | "line" | "dash" }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h4 className="text-base font-semibold text-[#141111]">{title}</h4>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {legend?.length ? <Legend items={legend} /> : null}
      </div>
      {children}
    </section>
  );
}

export function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; kind?: "bar" | "line" | "dash" }>;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-700">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {i.kind === "line" ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: i.color }} />
          ) : i.kind === "dash" ? (
            <span
              className="h-0.5 w-4"
              style={{
                backgroundImage: `linear-gradient(90deg, ${i.color} 60%, transparent 0)`,
                backgroundSize: "6px 2px",
              }}
            />
          ) : (
            <span className="size-3 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Ay içi kümülatif harcama: gerçekleşen (bugüne kadar), plan (doğrusal),
 * tahmin (bugünkü tempoyla ay sonuna).
 */
export function CumulativeSpendChart({
  row,
  today,
  daysInMonth,
  monthLabel,
  bare = false,
}: {
  row: BrandTableRow;
  today: string;
  daysInMonth: number;
  monthLabel: string;
  /** true: kart çerçevesi/başlık olmadan yalnızca grafik + lejant. */
  bare?: boolean;
}) {
  const month = today.slice(0, 7);
  const byDate = new Map(row.daily.map((d) => [d.date, d.meta + d.google]));
  const todayDay = Number(today.slice(8, 10));
  const dates = Array.from(
    { length: daysInMonth },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  // Kümülatif toplam — saf hesap (render içinde değişken yeniden atanmaz).
  const cumulative = dates.reduce<number[]>((acc, date, i) => {
    acc.push((acc[i - 1] ?? 0) + (i < todayDay ? (byDate.get(date) ?? 0) : 0));
    return acc;
  }, []);
  const cumAtToday = cumulative[Math.min(todayDay, daysInMonth) - 1] ?? 0;
  const data = dates.map((date, i) => {
    const day = i + 1;
    return {
      date,
      label: shortDay(date),
      actual: day <= todayDay ? Math.round(cumulative[i]) : null,
      plan: row.planned ? Math.round((row.planned * day) / daysInMonth) : null,
      projected:
        row.avgDaily != null && todayDay < daysInMonth && day >= todayDay
          ? Math.round(cumAtToday + row.avgDaily * (day - todayDay))
          : null,
    };
  });
  const pace = PACE_STATUS_META[row.paceStatus];
  const legend = [
    { label: "Gerçekleşen", color: INK, kind: "line" as const },
    ...(row.planned ? [{ label: "Plan", color: PLAN_COLOR, kind: "line" as const }] : []),
    ...(row.avgDaily != null
      ? [{ label: "Tahmin", color: INK, kind: "dash" as const }]
      : []),
  ];

  const chart = (
    <>
      {cumAtToday === 0 && !row.planned ? (
        <NoSpendState row={row} />
      ) : (
      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
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
                value == null ? "—" : formatTry(Number(value), row.currency),
                name === "actual" ? "Gerçekleşen" : name === "plan" ? "Plan" : "Tahmin",
              ]}
            />
            {row.planned ? (
              <Line
                dataKey="plan"
                stroke={PLAN_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              dataKey="projected"
              stroke={INK}
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="actual"
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
    </>
  );

  if (bare) {
    return (
      <div>
        <Legend items={legend} />
        {chart}
      </div>
    );
  }

  return (
    <ChartCard
      title={`Kümülatif harcama · ${monthLabel}`}
      subtitle={
        row.planned
          ? `${pace.label} · ay sonu tahmini ${
              row.projected != null ? formatTry(row.projected, row.currency) : "—"
            } / plan ${formatTry(row.planned, row.currency)}`
          : "Plan girilmemiş — yalnızca gerçekleşen ve tahmin"
      }
      legend={legend}
    >
      {chart}
    </ChartCard>
  );
}

/** Ajans geneli: tüm görünen markaların günlük Meta + Google harcaması. */
export function AgencyDailySpendChart({
  rows,
  currency,
  monthLabel,
  today,
  currentHour,
}: {
  rows: BrandTableRow[];
  currency: string;
  monthLabel: string;
  today: string;
  currentHour: number;
}) {
  const totals = new Map<string, DailySpend>();
  for (const r of rows) {
    if (r.currency !== currency) continue;
    for (const d of r.daily) {
      const t = totals.get(d.date) ?? { date: d.date, meta: 0, google: 0 };
      t.meta += d.meta;
      t.google += d.google;
      totals.set(d.date, t);
    }
  }
  const data = [...totals.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      label: d.date === today ? "Bugün" : shortDay(d.date),
      meta: Math.round(d.meta),
      google: Math.round(d.google),
    }));
  const sumMeta = data.reduce((s, d) => s + d.meta, 0);
  const sumGoogle = data.reduce((s, d) => s + d.google, 0);

  return (
    <ChartCard
      title={`Ajans geneli günlük harcama · ${monthLabel}`}
      subtitle={`Meta ${compactMoney(sumMeta, currency)} · Google Ads ${compactMoney(sumGoogle, currency)} · bugün saat ${String(currentHour).padStart(2, "0")}:00'a kadar`}
      legend={[
        { label: "Meta", color: META_COLOR },
        { label: "Google Ads", color: GOOGLE_COLOR },
      ]}
    >
      {data.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Bu ay harcama yok.</p>
      ) : (
        <div className="mt-3 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                cursor={TOOLTIP_CURSOR}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [
                  formatTry(Number(value), currency),
                  name === "meta" ? "Meta" : "Google Ads",
                ]}
              />
              <Bar dataKey="meta" stackId="s" fill={META_COLOR} maxBarSize={20} stroke="#fff" strokeWidth={1} />
              <Bar
                dataKey="google"
                stackId="s"
                fill={GOOGLE_COLOR}
                maxBarSize={20}
                radius={[4, 4, 0, 0]}
                stroke="#fff"
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

/**
 * Ajans geneli bugün: saat saat harcama, toplam ve para çekilmeyen markalar
 * (ödeme/hesap sorunu ya da bugün hiç harcama yok).
 */
export function AgencyTodayCard({
  rows,
  currency,
  currentHour,
  hourlySync,
  onPick,
}: {
  rows: BrandTableRow[];
  currency: string;
  currentHour: number;
  hourlySync: { running: boolean; lastSuccessAt: string | null };
  onPick: (slug: string) => void;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(hourlySync.running);
  const [error, setError] = useState<string | null>(null);

  const hours = Array.from({ length: currentHour + 1 }, (_, h) => {
    let meta = 0;
    let google = 0;
    for (const r of rows) {
      if (r.currency !== currency) continue;
      const p = r.hourly[h];
      if (p) {
        meta += p.meta;
        google += p.google;
      }
    }
    return { label: `${String(h).padStart(2, "0")}:00`, meta: Math.round(meta), google: Math.round(google) };
  });
  const total = rows
    .filter((r) => r.currency === currency)
    .reduce((s, r) => s + r.todaySpend, 0);

  const notCharged = rows
    .map((r) => ({ row: r, issue: paymentIssue(r) }))
    .filter((x) => x.issue || noSpendToday(x.row))
    .sort((a, b) => Number(Boolean(b.issue?.critical)) - Number(Boolean(a.issue?.critical)));
  const notChargedSlugs = new Set(notCharged.map((x) => x.row.slug));
  const charged = rows
    .filter((r) => r.todaySpend > 0 && !notChargedSlugs.has(r.slug))
    .sort((a, b) => b.todaySpend - a.todaySpend);
  const noData = rows
    .map((r) => ({ row: r, missing: missingProviders(r) }))
    .filter((x) => x.missing.length > 0 && !notChargedSlugs.has(x.row.slug));
  const [listTab, setListTab] = useState<"not" | "charged" | "nodata">("not");
  const maxCharged = Math.max(...charged.map((r) => r.todaySpend), 1);

  async function refresh() {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch("/api/panel/hourly-sync", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      // Arka planda çalışır — bitene kadar yokla.
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = (await (await fetch("/api/panel/hourly-sync", { cache: "no-store" })).json()) as {
          running: boolean;
        };
        if (!s.running) break;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setRefreshing(false);
    }
  }

  const updated = hourlySync.lastSuccessAt
    ? new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(hourlySync.lastSuccessAt))
    : null;

  return (
    <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-[#141111]">Bugün</h4>
          <p className="mt-0.5 text-sm text-zinc-500">
            {updated ? `Saatlik veri · son güncelleme ${updated}` : "Saatlik veri henüz çekilmedi"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#141111] px-4 text-sm font-semibold text-white transition hover:bg-[#e91825] disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          {refreshing ? "Güncelleniyor…" : "Şimdi güncelle"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      <p className="mt-3 text-3xl font-semibold text-[#141111]">
        {compactMoney(total, currency)}
        <span className="ml-2 text-sm font-normal text-zinc-500">
          saat {String(currentHour).padStart(2, "0")}:00&apos;a kadar
        </span>
      </p>

      <div className="mt-2 h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hours} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <Tooltip
              cursor={TOOLTIP_CURSOR}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [
                formatTry(Number(value), currency),
                name === "meta" ? "Meta" : "Google Ads",
              ]}
            />
            <Bar dataKey="meta" stackId="h" fill={META_COLOR} maxBarSize={14} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="google" stackId="h" fill={GOOGLE_COLOR} maxBarSize={14} radius={[3, 3, 0, 0]} stroke="#fff" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bugünkü marka listesi">
          {(
            [
              { id: "not", label: "Çekilmeyenler", n: notCharged.length, alert: true },
              { id: "charged", label: "Çekilenler", n: charged.length, alert: false },
              ...(noData.length
                ? [{ id: "nodata", label: "Veri alınamayan", n: noData.length, alert: false }]
                : []),
            ] as Array<{ id: "not" | "charged" | "nodata"; label: string; n: number; alert: boolean }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={listTab === t.id}
              onClick={() => setListTab(t.id)}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
                listTab === t.id
                  ? "border-[#141111] bg-[#141111] text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-[#141111]"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 text-xs font-bold tabular-nums ${
                  t.alert && t.n > 0
                    ? "bg-[#e91825] text-white"
                    : listTab === t.id
                      ? "bg-white/20"
                      : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {t.n}
              </span>
            </button>
          ))}
        </div>

        <ScrollList key={listTab}>
          {listTab === "not" ? (
            notCharged.length === 0 ? (
              <li className="px-2 py-2 text-sm text-emerald-700">
                Ödeme sorunu yok, tüm markalarda bugün harcama var.
              </li>
            ) : (
              notCharged.map(({ row, issue }) => (
                <BrandListItem key={row.slug} row={row} onPick={onPick}>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      issue
                        ? issue.critical
                          ? "bg-rose-600 text-white"
                          : "bg-amber-100 text-amber-900"
                        : "bg-rose-50 text-rose-800"
                    }`}
                  >
                    {issue
                      ? `${issue.provider}: ${issue.label}`
                      : `${activeChannels(row).join(" + ")} ₺0`}
                  </span>
                </BrandListItem>
              ))
            )
          ) : listTab === "charged" ? (
            charged.length === 0 ? (
              <li className="px-2 py-2 text-sm text-zinc-500">Bugün harcama yapan marka yok.</li>
            ) : (
              charged.map((row) => (
                <BrandListItem key={row.slug} row={row} onPick={onPick}>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-zinc-500 tabular-nums sm:inline">
                      {(["meta", "google"] as const)
                        .filter((p) => row.todayByProvider[p].state !== "n/a")
                        .map((p) => {
                          const t = row.todayByProvider[p];
                          const name = p === "meta" ? "Meta" : "Google";
                          // Veri gelmediyse 0 yazmak yanıltır.
                          return t.state === "ok"
                            ? `${name} ${compactMoney(t.spend, row.currency)}`
                            : `${name} —`;
                        })
                        .join(" · ")}
                    </span>
                    <span className="h-2 w-12 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-[#141111]"
                        style={{ width: `${(row.todaySpend / maxCharged) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 text-right text-sm font-semibold text-[#141111] tabular-nums">
                      {compactMoney(row.todaySpend, row.currency)}
                    </span>
                  </span>
                </BrandListItem>
              ))
            )
          ) : (
            noData.map(({ row, missing }) => (
              <BrandListItem key={row.slug} row={row} onPick={onPick}>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                  {missing.join(" + ")} verisi alınamadı
                </span>
              </BrandListItem>
            ))
          )}
        </ScrollList>
      </div>
    </section>
  );
}

/** Markanın eşleşmesi olan kanallar. */
function activeChannels(row: BrandTableRow): string[] {
  const out: string[] = [];
  if (row.todayByProvider.meta.state !== "n/a") out.push("Meta");
  if (row.todayByProvider.google.state !== "n/a") out.push("Google");
  return out.length ? out : ["Meta + Google"];
}

function BrandListItem({
  row,
  onPick,
  children,
}: {
  row: BrandTableRow;
  onPick: (slug: string) => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(row.slug)}
        className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-50"
        title="Tıklayınca tabloda markanın ayrıntısı açılır"
      >
        <span className="truncate text-sm font-medium text-[#141111] group-hover:underline">
          {row.name}
        </span>
        {children}
      </button>
    </li>
  );
}

function pctDelta(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

function DeltaBadge({
  delta,
  goodWhen,
}: {
  delta: number | null;
  goodWhen: "up" | "down";
}) {
  if (delta == null) return <span className="text-xs text-zinc-400">önceki dönem yok</span>;
  const good = delta === 0 ? null : goodWhen === "up" ? delta > 0 : delta < 0;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        good == null
          ? "bg-zinc-100 text-zinc-700"
          : good
            ? "bg-emerald-50 text-emerald-800"
            : "bg-rose-50 text-rose-800"
      }`}
    >
      {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} %{Math.abs(delta)}
    </span>
  );
}

/**
 * Ajans geneli sonuçlar: harcamanın karşılığı. Lead markaların lead'i ve
 * e-ticaret markaların satışı ayrı; geçen ayın aynı günleriyle kıyas.
 */
export function AgencyResultsCard({
  results,
  currency,
  monthLabel,
  today,
  onPick,
}: {
  results: AgencyResults;
  currency: string;
  monthLabel: string;
  today: string;
  onPick: (slug: string) => void;
}) {
  const { current: cur, previous: prev } = results;
  const cpl = cur.lead > 0 ? cur.leadSpend / cur.lead : null;
  const prevCpl = prev.lead > 0 ? prev.leadSpend / prev.lead : null;
  const roas = cur.saleSpend > 0 ? cur.saleValue / cur.saleSpend : null;
  const data = results.days.map((d) => ({
    ...d,
    label: d.date === today ? "Bugün" : shortDay(d.date),
  }));
  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h4 className="text-base font-semibold text-[#141111]">Sonuçlar · {monthLabel}</h4>
          <p className="mt-0.5 text-sm text-zinc-500">
            Harcamanın karşılığı · geçen ayın aynı günleriyle kıyaslı
          </p>
        </div>
        <Legend
          items={[
            { label: "Lead", color: LEAD_COLOR },
            { label: "Satış", color: SALE_COLOR },
          ]}
        />
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <span className="size-2.5 rounded-sm" style={{ background: LEAD_COLOR }} />
            Lead
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <span className="text-xl font-semibold text-[#141111]">{fmt(cur.lead)}</span>
            <DeltaBadge delta={pctDelta(cur.lead, prev.lead)} goodWhen="up" />
          </dd>
        </div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="text-xs font-medium text-zinc-500">Lead başı maliyet</dt>
          <dd className="mt-1 flex items-center gap-2">
            <span className="text-xl font-semibold text-[#141111]">
              {cpl != null ? compactMoney(cpl, currency) : "—"}
            </span>
            <DeltaBadge
              delta={cpl != null && prevCpl != null ? pctDelta(cpl, prevCpl) : null}
              goodWhen="down"
            />
          </dd>
        </div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <span className="size-2.5 rounded-sm" style={{ background: SALE_COLOR }} />
            Satış
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <span className="text-xl font-semibold text-[#141111]">{fmt(cur.sale)}</span>
            <DeltaBadge delta={pctDelta(cur.sale, prev.sale)} goodWhen="up" />
          </dd>
          <dd className="mt-0.5 text-xs text-zinc-500">
            {roas != null ? `ROAS ${roas.toFixed(2).replace(".", ",")}x` : "e-ticaret harcaması yok"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
            <Tooltip
              cursor={TOOLTIP_CURSOR}
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(label) =>
                label === "Bugün" ? "Bugün (09:00 / 18:00 senkronuna kadar kısmi)" : label
              }
              formatter={(value, name) => [fmt(Number(value)), name === "lead" ? "Lead" : "Satış"]}
            />
            <Bar dataKey="lead" stackId="r" fill={LEAD_COLOR} maxBarSize={18} stroke="#fff" strokeWidth={1} />
            <Bar
              dataKey="sale"
              stackId="r"
              fill={SALE_COLOR}
              maxBarSize={18}
              radius={[4, 4, 0, 0]}
              stroke="#fff"
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="text-sm font-semibold text-[#141111]">
          Maliyeti kötüleşen markalar
          <span className="ml-2 text-xs font-normal text-zinc-500">
            son 7 gün · önceki 7 güne göre dönüşüm başı maliyet
          </span>
        </p>
        {results.worsening.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">
            Son 7 günde maliyeti belirgin kötüleşen marka yok.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {results.worsening.map((w) => (
              <li key={w.slug}>
                <button
                  type="button"
                  onClick={() => onPick(w.slug)}
                  className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-50"
                  title="Tıklayınca tabloda markanın ayrıntısı açılır"
                >
                  <span className="truncate text-sm font-medium text-[#141111] group-hover:underline">
                    {w.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                    <span className="text-zinc-500">
                      {w.cpaPrev != null ? compactMoney(w.cpaPrev, w.currency) : "—"} →{" "}
                      {w.cpa7 != null ? compactMoney(w.cpa7, w.currency) : "dönüşüm yok"}
                    </span>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">
                      {w.changePct == null ? "0 dönüşüm" : `↑ %${w.changePct}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export type SyncRunPoint = {
  status: "success" | "error";
  finishedAt: string;
  durationMs: number | null;
  key: string;
  api: string;
  call: string;
};

function ymdIstanbul(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(iso),
  );
}

/** Günlük çekim sayısı — başarılı / hatalı (durum renkleri). */
export function SyncActivityChart({
  runs,
  days,
}: {
  runs: SyncRunPoint[];
  days: string[];
}) {
  const counts = new Map(days.map((d) => [d, { ok: 0, err: 0 }]));
  for (const r of runs) {
    const c = counts.get(ymdIstanbul(r.finishedAt));
    if (!c) continue;
    if (r.status === "error") c.err += 1;
    else c.ok += 1;
  }
  const data = days.map((d) => ({
    label: shortDay(d),
    ok: counts.get(d)!.ok,
    err: counts.get(d)!.err,
  }));
  const total = runs.length;
  const errors = runs.filter((r) => r.status === "error").length;
  const rate = total ? Math.round(((total - errors) / total) * 100) : null;

  return (
    <ChartCard
      title="Çekim aktivitesi"
      subtitle={
        rate != null
          ? `${total} çekim · başarı oranı %${rate}`
          : "Bu aralıkta çekim yok"
      }
      legend={[
        { label: "Başarılı", color: STATUS_OK },
        { label: "Hatalı", color: STATUS_ERROR },
      ]}
    >
      <div className="mt-3 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              cursor={TOOLTIP_CURSOR}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [
                `${value} çekim`,
                name === "ok" ? "Başarılı" : "Hatalı",
              ]}
            />
            <Bar dataKey="ok" stackId="r" fill={STATUS_OK} maxBarSize={18} stroke="#fff" strokeWidth={1} />
            <Bar
              dataKey="err"
              stackId="r"
              fill={STATUS_ERROR}
              maxBarSize={18}
              radius={[4, 4, 0, 0]}
              stroke="#fff"
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace(".", ",")} sn`;
  return `${Math.floor(s / 60)} dk ${Math.round(s % 60)} sn`;
}

/** Servis başına ortalama / en uzun çekim süresi + hata oranı. */
export function ServiceDurationChart({ runs }: { runs: SyncRunPoint[] }) {
  const map = new Map<
    string,
    { api: string; call: string; n: number; sum: number; max: number; err: number; total: number }
  >();
  for (const r of runs) {
    const m =
      map.get(r.key) ??
      { api: r.api, call: r.call, n: 0, sum: 0, max: 0, err: 0, total: 0 };
    m.total += 1;
    if (r.status === "error") m.err += 1;
    if (r.durationMs != null) {
      m.n += 1;
      m.sum += r.durationMs;
      m.max = Math.max(m.max, r.durationMs);
    }
    map.set(r.key, m);
  }
  const rows = [...map.values()]
    .filter((m) => m.n > 0)
    .map((m) => ({ ...m, avg: m.sum / m.n }))
    .sort((a, b) => b.avg - a.avg);
  const max = Math.max(...rows.map((r) => r.max), 1);

  return (
    <ChartCard
      title="Servis süreleri"
      subtitle="Ortalama çekim süresi · açık uç: en uzun · sağda hata oranı"
    >
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Süre bilgisi olan çekim yok.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li
              key={`${r.api}${r.call}`}
              className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5rem] items-center gap-3"
              title={`${r.api} · ${r.call}\nOrtalama ${formatMs(r.avg)} · en uzun ${formatMs(r.max)} · ${r.total} çekim, ${r.err} hatalı`}
            >
              <span className="truncate text-sm text-[#141111]">
                <span className="font-semibold">{r.api}</span>{" "}
                <span className="text-xs text-zinc-500">{r.call}</span>
              </span>
              <span className="relative h-3 rounded-full bg-zinc-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-zinc-300"
                  style={{ width: `${(r.max / max) * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[#141111]"
                  style={{ width: `${(r.avg / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-xs tabular-nums">
                <span className="font-semibold text-[#141111]">{formatMs(r.avg)}</span>
                <br />
                <span className={r.err ? "text-rose-700" : "text-zinc-500"}>
                  %{Math.round((r.err / r.total) * 100)} hata
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

/**
 * Sabit yükseklikli liste — altında içerik kaldıkça solma + "N marka daha"
 * butonu gösterir, böylece kaydırılabildiği belli olur.
 */
function ScrollList({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [below, setBelow] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const bottom = el.scrollTop + el.clientHeight;
      let n = 0;
      for (const li of Array.from(el.children) as HTMLElement[]) {
        if (li.offsetTop + li.offsetHeight / 2 > bottom) n += 1;
      }
      setBelow(n);
      setScrolled(el.scrollTop > 4);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div className="relative mt-2">
      <ul
        ref={ref}
        className="max-h-64 space-y-1 overflow-y-auto pr-1 [scrollbar-color:#a1a1aa_transparent] [scrollbar-width:thin]"
      >
        {children}
      </ul>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/85 to-transparent transition-opacity duration-200 ${
          below > 0 ? "opacity-100" : "opacity-0"
        }`}
      />
      {below > 0 ? (
        <button
          type="button"
          onClick={() =>
            ref.current?.scrollBy({ top: ref.current.clientHeight * 0.8, behavior: "smooth" })
          }
          className="absolute bottom-1 left-1/2 inline-flex min-h-9 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-[#141111] px-4 text-xs font-semibold text-white shadow-[0_8px_20px_-6px_rgba(20,17,17,0.5)] transition hover:bg-[#e91825]"
        >
          <ChevronDown className="size-4 animate-bounce" aria-hidden />
          {below} marka daha · kaydır
        </button>
      ) : null}
    </div>
  );
}
